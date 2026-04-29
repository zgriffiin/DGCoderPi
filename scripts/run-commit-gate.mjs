import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { captureCommand, fail, runCheckedStep } from './lib/process.mjs';

function listStagedFiles() {
	const result = captureCommand('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM']);
	return result.stdout
		.split(/\r?\n/)
		.map((file) => file.trim())
		.filter(Boolean);
}

function hashFile(filePath) {
	if (!existsSync(filePath)) {
		return null;
	}

	return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function snapshotFiles(filePaths) {
	return new Map(filePaths.map((filePath) => [filePath, hashFile(filePath)]));
}

function filterLintableFiles(filePaths) {
	return filePaths.filter((filePath) => /\.(?:[cm]?js|[cm]?ts|svelte)$/i.test(filePath));
}

function findReformattedFiles(beforeSnapshot) {
	const changed = [];

	for (const [filePath, beforeHash] of beforeSnapshot.entries()) {
		const afterHash = hashFile(filePath);

		if (beforeHash !== afterHash) {
			changed.push(filePath);
		}
	}

	return changed;
}

const stagedFiles = listStagedFiles();
const stagedSnapshot = snapshotFiles(stagedFiles);
const lintableStagedFiles = filterLintableFiles(stagedFiles);

if (stagedFiles.length > 0) {
	runCheckedStep('Formatting staged files', 'pnpm', [
		'exec',
		'prettier',
		'--write',
		...stagedFiles
	]);
}

const reformattedFiles = findReformattedFiles(stagedSnapshot);

if (reformattedFiles.length > 0) {
	fail(
		`Formatter updated staged files. Review and restage them before committing:\n- ${reformattedFiles.join('\n- ')}`
	);
}

if (lintableStagedFiles.length > 0) {
	runCheckedStep('Linting staged files', 'pnpm', ['exec', 'eslint', ...lintableStagedFiles]);
}

runCheckedStep('Running runtime policy gate', 'pnpm', ['policy:runtime']);
runCheckedStep('Running type gate', 'pnpm', ['check']);
runCheckedStep('Running fallow commit gate', 'pnpm', ['fallow:commit']);
