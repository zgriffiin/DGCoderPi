import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
const debugPort = '9333';
const appPort = '5182';
const runId = `${Date.now()}`;
const runtimeEnv = {
	...process.env,
	DGCODER_PI_TEST_RUN_ID: runId
};

function runWindowsPortCleanup() {
	if (process.platform !== 'win32') {
		return;
	}

	spawnSync('taskkill', ['/IM', 'dgcoder-pi.exe', '/T', '/F'], { stdio: 'ignore' });
	for (const port of [debugPort, appPort]) {
		spawnSync(
			'cmd.exe',
			[
				'/d',
				'/s',
				'/c',
				`for /f "tokens=5" %a in ('netstat -ano ^| findstr ":${port}" ^| findstr "LISTENING"') do taskkill /PID %a /T /F >nul 2>nul`
			],
			{ stdio: 'ignore' }
		);
	}
}

function stopRuntime(runtimeProcess) {
	if (!runtimeProcess?.pid) {
		return;
	}

	if (process.platform === 'win32') {
		spawnSync('taskkill', ['/PID', String(runtimeProcess.pid), '/T', '/F'], { stdio: 'ignore' });
		return;
	}

	if (!runtimeProcess.killed) {
		runtimeProcess.kill('SIGTERM');
	}
}

runWindowsPortCleanup();

const runtime = spawn('node', ['scripts/start-desktop-test-runtime.mjs'], {
	cwd: process.cwd(),
	env: runtimeEnv,
	stdio: 'inherit'
});

process.on('SIGINT', () => stopRuntime(runtime));
process.on('SIGTERM', () => stopRuntime(runtime));

const debugUrl = `http://127.0.0.1:${debugPort}/json/version`;

async function waitForDesktopRuntime(url, timeoutMs) {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (runtime.exitCode !== null) {
			throw new Error(`Desktop runtime exited before ${url} became available.`);
		}

		try {
			const response = await fetch(url);
			if (response.ok) {
				return;
			}
		} catch (error) {
			void error;
		}

		await delay(1_000);
	}

	throw new Error(`Timed out waiting for ${url}.`);
}

try {
	await waitForDesktopRuntime(debugUrl, 180_000);
} catch (error) {
	stopRuntime(runtime);
	throw error;
}

const result = spawnSync(
	'pnpm',
	['exec', 'playwright', 'test', '--config', 'playwright.desktop.config.ts'],
	{
		cwd: process.cwd(),
		env: runtimeEnv,
		shell: process.platform === 'win32',
		stdio: 'inherit'
	}
);

stopRuntime(runtime);

if (result.error) {
	throw result.error;
}

process.exit(result.status ?? 1);
