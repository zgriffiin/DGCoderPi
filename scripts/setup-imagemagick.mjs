import { spawnSync } from 'node:child_process';
import { access, copyFile, cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const RESOURCE_DIR = path.resolve('src-tauri', 'resources', 'imagemagick', 'windows');
const METADATA_PATH = path.join(RESOURCE_DIR, 'metadata.json');

async function main() {
	if (process.platform !== 'win32') {
		console.log('[imagemagick] Skipping setup outside Windows.');
		return;
	}

	if (!(await shouldRefresh())) {
		console.log('[imagemagick] Vendored ImageMagick already present.');
		return;
	}

	const install = await resolveInstall();
	try {
		await vendorInstalledDir(install.path, install.metadata);
		console.log(`[imagemagick] Vendored ImageMagick from ${install.metadata.source}.`);
	} finally {
		await install.cleanup();
	}
}

async function shouldRefresh() {
	try {
		await access(path.join(RESOURCE_DIR, 'magick.exe'));
		return process.argv.includes('--refresh');
	} catch {
		return true;
	}
}

async function resolveInstall() {
	const downloadedInstall = await attemptWingetDownload();
	if (downloadedInstall) {
		return downloadedInstall;
	}

	const installedDir = findInstalledDir();
	if (installedDir) {
		return {
			cleanup: async () => {},
			metadata: {
				source: 'local-install',
				sourcePath: installedDir
			},
			path: installedDir
		};
	}

	throw new Error(
		'Unable to vendor ImageMagick automatically. Install winget or ImageMagick and rerun pnpm setup:imagemagick.'
	);
}

async function attemptWingetDownload() {
	if (!commandAvailable('winget')) {
		console.warn(
			'[imagemagick] winget is not available; checking for an existing local install instead.'
		);
		return null;
	}

	let tempRoot = null;
	try {
		tempRoot = await mkdtemp(path.join(os.tmpdir(), 'dgcoder-imagemagick-'));
		runChecked('winget', [
			'download',
			'--id',
			'ImageMagick.Q16',
			'-e',
			'--accept-package-agreements',
			'--accept-source-agreements',
			'--download-directory',
			tempRoot,
			'--skip-dependencies',
			'--disable-interactivity'
		]);

		const downloadPath = await findDownloadedPackage(tempRoot);
		const extractedDir = await extractInstallDirectory(downloadPath, tempRoot);
		return {
			cleanup: async () => {
				await rm(tempRoot, { force: true, recursive: true });
			},
			metadata: {
				source: 'winget-download',
				sourcePackage: path.basename(downloadPath)
			},
			path: extractedDir
		};
	} catch (error) {
		console.warn(`[imagemagick] ${error instanceof Error ? error.message : String(error)}`);
		if (tempRoot) {
			await rm(tempRoot, { force: true, recursive: true });
		}
		return null;
	}
}

async function findDownloadedPackage(tempRoot) {
	const names = await readdir(tempRoot);
	const packageName = names.find(
		(name) => name.endsWith('.appx') || name.endsWith('.msix') || name.endsWith('.msixbundle')
	);
	if (!packageName) {
		throw new Error('winget did not download an ImageMagick APPX or MSIX package.');
	}
	return path.join(tempRoot, packageName);
}

async function extractInstallDirectory(downloadPath, tempRoot) {
	const bundleExtractDir = path.join(tempRoot, 'bundle');
	await extractArchive(downloadPath, bundleExtractDir);

	const bundleMagickPath = path.join(bundleExtractDir, 'magick.exe');
	try {
		await access(bundleMagickPath);
		return bundleExtractDir;
	} catch {
		// Most downloads are bundles, so continue into the packaged app payload lookup.
	}

	const installPackagePath = await resolveInstallPackage(bundleExtractDir, downloadPath);
	const installExtractDir = path.join(tempRoot, 'install');
	await extractArchive(installPackagePath, installExtractDir);

	try {
		await access(path.join(installExtractDir, 'magick.exe'));
		return installExtractDir;
	} catch {
		throw new Error('The downloaded ImageMagick package did not contain magick.exe.');
	}
}

async function resolveInstallPackage(bundleExtractDir, downloadPath) {
	const packageName = packageNameForArchitecture();
	const packagePath = path.join(bundleExtractDir, packageName);
	try {
		await access(packagePath);
		return packagePath;
	} catch {
		if (downloadPath.endsWith('.appx')) {
			return downloadPath;
		}
		throw new Error(`The ImageMagick bundle did not contain ${packageName}.`);
	}
}

function packageNameForArchitecture() {
	if (process.arch === 'arm64') {
		return 'main-arm64.appx';
	}
	return 'main-x64.appx';
}

async function extractArchive(archivePath, destinationDir) {
	await mkdir(destinationDir, { recursive: true });
	const archiveZipPath = path.join(destinationDir, `${path.basename(archivePath)}.zip`);
	await copyFile(archivePath, archiveZipPath);
	try {
		runChecked('powershell', [
			'-NoProfile',
			'-Command',
			`Expand-Archive -LiteralPath '${escapePowerShellLiteral(archiveZipPath)}' -DestinationPath '${escapePowerShellLiteral(destinationDir)}' -Force`
		]);
	} finally {
		await rm(archiveZipPath, { force: true });
	}
}

function escapePowerShellLiteral(value) {
	return value.replaceAll("'", "''");
}

function commandAvailable(command) {
	const result = spawnSync('where', [command], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	});
	return result.status === 0;
}

function findInstalledDir() {
	const result = spawnSync(
		'powershell',
		[
			'-NoProfile',
			'-Command',
			[
				'$roots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}) | Where-Object { $_ }',
				"$dirs = foreach ($root in $roots) { Get-ChildItem -Path $root -Directory -Filter 'ImageMagick*' -ErrorAction SilentlyContinue }",
				"$match = $dirs | Where-Object { Test-Path (Join-Path $_.FullName 'magick.exe') } | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName",
				'if ($match) { Write-Output $match }'
			].join('; ')
		],
		{
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}
	);
	if (result.status !== 0) {
		return null;
	}

	const installedDir = result.stdout.trim();
	return installedDir ? installedDir : null;
}

async function vendorInstalledDir(installedDir, metadata) {
	await rm(RESOURCE_DIR, { force: true, recursive: true });
	await mkdir(RESOURCE_DIR, { recursive: true });
	await cp(installedDir, RESOURCE_DIR, { force: true, recursive: true });
	await writeFile(
		METADATA_PATH,
		JSON.stringify(
			{
				...metadata,
				sourcedAt: new Date().toISOString()
			},
			null,
			2
		)
	);
}

function runChecked(command, args) {
	const result = spawnSync(command, args, {
		encoding: 'utf8',
		shell: false,
		stdio: 'inherit'
	});
	if (result.status === 0) {
		return;
	}

	throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}.`);
}

main().catch((error) => {
	console.error(
		'[imagemagick] Setup failed:',
		error instanceof Error ? error.message : String(error)
	);
	process.exit(1);
});
