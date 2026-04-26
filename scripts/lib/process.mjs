import { spawnSync } from 'node:child_process';

function buildInvocation(command, args) {
	if (process.platform === 'win32' && command === 'pnpm') {
		return {
			command: 'cmd.exe',
			args: ['/d', '/s', '/c', 'pnpm', ...args]
		};
	}

	return { command, args };
}

export function captureCommand(command, args, options = {}) {
	const invocation = buildInvocation(command, args);
	const result = spawnSync(invocation.command, invocation.args, {
		cwd: process.cwd(),
		encoding: 'utf8',
		shell: false,
		...options
	});

	if (result.error) {
		throw result.error;
	}

	return {
		status: result.status ?? 0,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? ''
	};
}

export function runCheckedStep(label, command, args, options = {}) {
	console.log(`\n[gate] ${label}`);

	const invocation = buildInvocation(command, args);
	const result = spawnSync(invocation.command, invocation.args, {
		cwd: process.cwd(),
		stdio: 'inherit',
		shell: false,
		...options
	});

	if (result.error) {
		throw result.error;
	}

	if ((result.status ?? 0) !== 0) {
		process.exit(result.status ?? 1);
	}
}

export function fail(message) {
	console.error(`\n${message}`);
	process.exit(1);
}
