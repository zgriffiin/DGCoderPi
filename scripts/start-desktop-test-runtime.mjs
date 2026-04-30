import { mkdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.cwd();
const debugPort = '9333';
const runtimeRoot = path.resolve(repoRoot, 'tests', 'runtime');
const runId = process.env.DGCODER_PI_TEST_RUN_ID ?? 'default';
const tauriDevCleanup = process.env.TAURI_DEV_CLEANUP ?? 'true';

if (!/^[A-Za-z0-9_-]+$/.test(runId)) {
	console.error(
		'DGCODER_PI_TEST_RUN_ID must contain only letters, numbers, underscores, or dashes.'
	);
	process.exit(1);
}

const dataDir = path.join(runtimeRoot, `playwright-desktop-${runId}`);
const resolvedDataDir = path.resolve(dataDir);

if (resolvedDataDir !== runtimeRoot && !resolvedDataDir.startsWith(`${runtimeRoot}${path.sep}`)) {
	console.error('Resolved test runtime directory escaped tests/runtime.');
	process.exit(1);
}

rmSync(resolvedDataDir, { force: true, recursive: true });
mkdirSync(resolvedDataDir, { recursive: true });

const child = spawn('cmd.exe', ['/d', '/s', '/c', 'pnpm tauri:dev'], {
	cwd: repoRoot,
	env: {
		...process.env,
		DGCODER_PI_DATA_DIR: resolvedDataDir,
		PATH: `${path.join(process.env.USERPROFILE ?? '', '.cargo', 'bin')};${process.env.PATH ?? ''}`,
		TAURI_DEV_CLEANUP: tauriDevCleanup,
		WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort}`
	},
	stdio: 'inherit'
});

child.on('exit', (code) => {
	process.exit(code ?? 0);
});

process.on('SIGINT', () => {
	child.kill('SIGINT');
});

process.on('SIGTERM', () => {
	child.kill('SIGTERM');
});
