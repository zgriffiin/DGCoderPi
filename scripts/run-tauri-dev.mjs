import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const appPort = '5182';
const allowedImages = new Set(['node.exe']);
const debugExePath = path.resolve('src-tauri', 'target', 'debug', 'dgcoder-pi.exe');
const forwardedArgs = process.argv.slice(2);
const shouldCleanupDevRuntime =
	process.env.TAURI_DEV_CLEANUP === 'true' || process.env.CI === 'true';

function listWindowsListeningPids(port) {
	const result = spawnSync(
		'cmd.exe',
		[
			'/d',
			'/s',
			'/c',
			`for /f "tokens=5" %a in ('netstat -ano ^| findstr ":${port} " ^| findstr "LISTENING"') do @echo %a`
		],
		{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
	);
	if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
		return [];
	}

	return result.stdout
		.split(/\r?\n/)
		.map((value) => value.trim())
		.filter(Boolean);
}

function getWindowsImageName(pid) {
	const result = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	});
	if (result.error || typeof result.stdout !== 'string') {
		return null;
	}

	const firstLine = result.stdout
		.split(/\r?\n/)
		.map((value) => value.trim())
		.find(Boolean);
	if (!firstLine) {
		return null;
	}

	const match = firstLine.match(/^"([^"]+)"/);
	return match?.[1]?.toLowerCase() ?? null;
}

function cleanupDevPort() {
	if (process.platform !== 'win32' || !shouldCleanupDevRuntime) {
		return;
	}

	for (const pid of listWindowsListeningPids(appPort)) {
		const imageName = getWindowsImageName(pid);
		if (!imageName || !allowedImages.has(imageName)) {
			continue;
		}

		spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
	}
}

function cleanupDebugAppExe() {
	if (process.platform !== 'win32' || !shouldCleanupDevRuntime) {
		return;
	}

	const escapedPath = debugExePath.replace(/'/g, "''");
	spawnSync(
		'powershell',
		[
			'-NoProfile',
			'-Command',
			`Get-Process dgcoder-pi -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '${escapedPath}' } | Stop-Process -Force`
		],
		{ stdio: 'ignore' }
	);
}

cleanupDevPort();
cleanupDebugAppExe();

const child = spawn('pnpm', ['tauri:dev:raw', ...forwardedArgs], {
	cwd: process.cwd(),
	env: process.env,
	shell: process.platform === 'win32',
	stdio: 'inherit'
});

child.on('error', (error) => {
	console.error('[tauri-dev] Failed to start pnpm tauri:dev:raw.', error);
	process.exit(1);
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
