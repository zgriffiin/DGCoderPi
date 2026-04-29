import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fail, runCheckedStep } from './lib/process.mjs';

function resolveCargoCommand() {
	if (process.platform !== 'win32') {
		return 'cargo';
	}

	const cargoPath = join(homedir(), '.cargo', 'bin', 'cargo.exe');
	return existsSync(cargoPath) ? cargoPath : 'cargo';
}

const cargo = resolveCargoCommand();
const cargoEnv = Object.fromEntries(
	Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
);

try {
	runCheckedStep(
		'Checking Rust format',
		cargo,
		['fmt', '--manifest-path', 'src-tauri/Cargo.toml', '--check'],
		{ env: cargoEnv }
	);
	runCheckedStep(
		'Running Rust clippy',
		cargo,
		['clippy', '--manifest-path', 'src-tauri/Cargo.toml', '--all-targets', '--', '-D', 'warnings'],
		{ env: cargoEnv }
	);
	runCheckedStep('Running Rust tests', cargo, ['test', '--manifest-path', 'src-tauri/Cargo.toml'], {
		env: cargoEnv
	});
} catch {
	fail(
		'Rust toolchain is required for the push gate. Install Rust or restart the shell so cargo is available.'
	);
}
