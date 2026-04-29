import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { captureCommand, fail } from './lib/process.mjs';

function escapeShellArg(value) {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function parseJsonLines(rawText) {
	return rawText
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.flatMap((line) => {
			try {
				return [JSON.parse(line)];
			} catch {
				return [];
			}
		});
}

function parseRetryDelayMs(waitTime) {
	if (typeof waitTime !== 'string' || waitTime.trim().length === 0) {
		return 90_000;
	}

	let totalSeconds = 0;
	for (const [, valueText, unit] of waitTime.matchAll(
		/(\d+)\s+(hour|hours|minute|minutes|second|seconds)/gi
	)) {
		const value = Number.parseInt(valueText, 10);
		if (Number.isNaN(value)) {
			continue;
		}

		if (unit.toLowerCase().startsWith('hour')) {
			totalSeconds += value * 3600;
		} else if (unit.toLowerCase().startsWith('minute')) {
			totalSeconds += value * 60;
		} else {
			totalSeconds += value;
		}
	}

	return (totalSeconds > 0 ? totalSeconds : 90) * 1000 + 5_000;
}

function windowsPathToWslPath(value) {
	const normalized = value.replace(/\\/g, '/');
	const pathMatch = normalized.match(/^([A-Za-z]):\/(.*)$/);

	if (!pathMatch) {
		return null;
	}

	const [, driveLetter, restOfPath] = pathMatch;
	return `/mnt/${driveLetter.toLowerCase()}/${restOfPath}`;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBaseBranch() {
	const result = captureCommand('git', ['symbolic-ref', 'refs/remotes/origin/HEAD']);
	const remoteHead = result.status === 0 ? result.stdout.trim() : '';

	return remoteHead.split('/').at(-1) || 'main';
}

function isAvailable(command, args, options = {}) {
	try {
		return captureCommand(command, args, options).status === 0;
	} catch {
		return false;
	}
}

function buildWslRunner() {
	const hasCr = captureCommand('wsl.exe', ['bash', '-lc', 'command -v cr >/dev/null'], {
		shell: false
	});

	if (hasCr.status !== 0) {
		fail(
			'CodeRabbit CLI was not found on Windows and is also not installed in WSL. Install it first and run `cr auth login`.'
		);
	}

	const wslPath = windowsPathToWslPath(process.cwd());
	if (!wslPath) {
		fail(
			'CodeRabbit CLI was not found on Windows and the WSL fallback could not convert the current workspace path. Install CodeRabbit CLI directly or configure it in WSL, then run `cr auth login`.'
		);
	}

	let gitEnvironment = '';
	try {
		const gitFilePath = path.resolve('.git');
		const gitMetadata = statSync(gitFilePath);
		if (gitMetadata.isFile()) {
			const gitFile = readFileSync(gitFilePath, 'utf8');
			const gitDirLine = gitFile
				.split(/\r?\n/)
				.map((line) => line.trim())
				.find((line) => line.toLowerCase().startsWith('gitdir:'));
			const gitDirWindowsPath = gitDirLine?.slice('gitdir:'.length).trim();
			const gitDirResolvedPath = gitDirWindowsPath
				? path.isAbsolute(gitDirWindowsPath)
					? gitDirWindowsPath
					: path.resolve(path.dirname(gitFilePath), gitDirWindowsPath)
				: null;
			const gitDirWslPath = gitDirResolvedPath ? windowsPathToWslPath(gitDirResolvedPath) : null;

			if (gitDirWslPath) {
				gitEnvironment = `export GIT_DIR=${escapeShellArg(gitDirWslPath)} GIT_WORK_TREE=${escapeShellArg(wslPath)} && `;
			}
		}
	} catch {
		// Ignore git metadata probing errors and fall back to the default WSL cwd behavior.
	}

	return {
		label: 'WSL cr',
		run(args) {
			const joinedArgs = args.map(escapeShellArg).join(' ');
			const command = `cd ${escapeShellArg(wslPath)} && ${gitEnvironment}cr ${joinedArgs}`;

			return captureCommand('wsl.exe', ['bash', '-lc', command], { shell: false });
		}
	};
}

function resolveRunner() {
	if (isAvailable('cr', ['--help'])) {
		return {
			label: 'cr',
			run(args) {
				return captureCommand('cr', args);
			}
		};
	}

	if (process.platform === 'win32') {
		if (isAvailable('wsl.exe', ['--status'], { shell: false })) {
			return buildWslRunner();
		}
	}

	fail(
		'CodeRabbit CLI is required before push. Install it first. On Windows, the official docs recommend running the CLI from WSL.'
	);
}

function assertAuthenticated(runner) {
	const result = runner.run(['auth', 'status', '--agent']);
	const rawOutput = `${result.stdout}\n${result.stderr}`;
	const events = parseJsonLines(rawOutput);
	const authEvent = events.find((event) => typeof event.authenticated === 'boolean');

	if (result.status !== 0 || authEvent?.authenticated === false) {
		fail('CodeRabbit CLI is not authenticated. Run `cr auth login` first.');
	}

	if (/not authenticated|login required|unauthenticated/i.test(rawOutput)) {
		fail('CodeRabbit CLI is not authenticated. Run `cr auth login` first.');
	}
}

function formatFinding(finding) {
	const location = finding.fileName || finding.path || 'unknown file';
	const severity = finding.severity || 'unknown';
	const detail =
		finding.message ||
		finding.title ||
		finding.description ||
		finding.codegenInstructions ||
		'No detail provided.';

	return `- [${severity}] ${location}: ${detail}`;
}

async function runReviewWithRetry(runner, args) {
	const maxAttempts = 3;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const result = runner.run(args);
		const rawOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
		const events = parseJsonLines(rawOutput);
		const findings = events.filter((event) => event.type === 'finding');
		const errorEvent = events.find((event) => event.type === 'error');

		if (
			errorEvent?.message &&
			/No files found for review/i.test(errorEvent.message) &&
			(result.status ?? 0) !== 0
		) {
			return { errorEvent, findings, noFiles: true, result };
		}

		const isRecoverableRateLimit =
			errorEvent?.errorType === 'rate_limit' && errorEvent.recoverable === true;

		if (isRecoverableRateLimit && attempt < maxAttempts) {
			const delayMs = parseRetryDelayMs(errorEvent.metadata?.waitTime);
			console.log(
				`[gate] CodeRabbit rate limited. Waiting ${Math.ceil(delayMs / 1000)}s before retry ${attempt + 1}/${maxAttempts}.`
			);
			await sleep(delayMs);
			continue;
		}

		return { errorEvent, findings, noFiles: false, result };
	}
}

const baseBranch = resolveBaseBranch();
const runner = resolveRunner();

console.log(`\n[gate] Running CodeRabbit review with ${runner.label} against ${baseBranch}`);
assertAuthenticated(runner);

const {
	errorEvent,
	findings,
	noFiles,
	result: reviewResult
} = await runReviewWithRetry(runner, [
	'review',
	'--agent',
	'--type',
	'committed',
	'--base',
	baseBranch,
	'--config',
	'AGENTS.md',
	'.coderabbit.yaml'
]);

if (noFiles) {
	console.log('[gate] CodeRabbit found no committed changes to review.');
	process.exit(0);
}

if (reviewResult.status !== 0) {
	fail(
		errorEvent?.message ||
			reviewResult.stderr ||
			reviewResult.stdout ||
			'CodeRabbit CLI review failed.'
	);
}

if (findings.length > 0) {
	fail(
		`CodeRabbit reported findings that must be fixed before push:\n${findings
			.map(formatFinding)
			.join('\n')}`
	);
}

console.log('[gate] CodeRabbit reported no local findings.');
