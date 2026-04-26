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

	const pathMatch = process
		.cwd()
		.replace(/\\/g, '/')
		.match(/^([A-Za-z]):\/(.*)$/);

	if (!pathMatch) {
		fail(
			'CodeRabbit CLI was not found on Windows and the WSL fallback could not convert the current workspace path. Install CodeRabbit CLI directly or configure it in WSL, then run `cr auth login`.'
		);
	}

	const [, driveLetter, restOfPath] = pathMatch;
	const wslPath = `/mnt/${driveLetter.toLowerCase()}/${restOfPath}`;

	return {
		label: 'WSL cr',
		run(args) {
			const joinedArgs = args.map(escapeShellArg).join(' ');
			const command = `cd ${escapeShellArg(wslPath)} && cr ${joinedArgs}`;

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
	const events = parseJsonLines(result.stdout);
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

const baseBranch = resolveBaseBranch();
const runner = resolveRunner();

console.log(`\n[gate] Running CodeRabbit review with ${runner.label} against ${baseBranch}`);
assertAuthenticated(runner);

const reviewResult = runner.run([
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

const findings = parseJsonLines(reviewResult.stdout).filter((event) => event.type === 'finding');
const errorEvent = parseJsonLines(reviewResult.stdout).find((event) => event.type === 'error');

if (
	errorEvent?.message &&
	/No files found for review/i.test(errorEvent.message) &&
	(reviewResult.status ?? 0) !== 0
) {
	console.log('[gate] CodeRabbit found no committed changes to review.');
	process.exit(0);
}

if (reviewResult.status !== 0) {
	fail(reviewResult.stderr || reviewResult.stdout || 'CodeRabbit CLI review failed.');
}

if (findings.length > 0) {
	fail(
		`CodeRabbit reported findings that must be fixed before push:\n${findings
			.map(formatFinding)
			.join('\n')}`
	);
}

console.log('[gate] CodeRabbit reported no local findings.');
