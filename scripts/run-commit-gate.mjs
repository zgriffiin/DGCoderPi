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

runCheckedStep('Formatting workspace', 'pnpm', ['format']);

const reformattedFiles = findReformattedFiles(stagedSnapshot);

if (reformattedFiles.length > 0) {
	fail(
		`Formatter updated staged files. Review and restage them before committing:\n- ${reformattedFiles.join('\n- ')}`
	);
}

runCheckedStep('Running lint gate', 'pnpm', ['lint']);
runCheckedStep('Running type gate', 'pnpm', ['check']);
runCheckedStep('Running fallow commit gate', 'pnpm', ['fallow:commit']);
