import { mkdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.cwd();
const debugPort = '9333';
const runId = process.env.DGCODER_PI_TEST_RUN_ID ?? 'default';
const dataDir = path.join(repoRoot, `.playwright-desktop-${runId}`);

rmSync(dataDir, { force: true, recursive: true });
mkdirSync(dataDir, { recursive: true });

const child = spawn('cmd.exe', ['/d', '/s', '/c', 'pnpm tauri:dev'], {
	cwd: repoRoot,
	env: {
		...process.env,
		DGCODER_PI_DATA_DIR: dataDir,
		PATH: `${path.join(process.env.USERPROFILE ?? '', '.cargo', 'bin')};${process.env.PATH ?? ''}`,
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
