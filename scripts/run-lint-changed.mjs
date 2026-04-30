import { existsSync } from 'node:fs';
import { filterLintableFiles, filterPrettierFiles } from './lib/file-filters.mjs';
import { captureCommand, runCheckedStep } from './lib/process.mjs';

function listFiles(args) {
	const result = captureCommand('git', args);
	return result.stdout
		.split(/\r?\n/)
		.map((file) => file.trim())
		.filter(Boolean);
}

function listChangedFiles() {
	const unstaged = listFiles(['diff', '--name-only', '--diff-filter=ACMRTUXB']);
	const staged = listFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB']);
	const untracked = listFiles(['ls-files', '--others', '--exclude-standard']);
	const unique = new Set([...unstaged, ...staged, ...untracked]);
	return [...unique].filter((filePath) => existsSync(filePath));
}

const changedFiles = listChangedFiles();
const prettierFiles = filterPrettierFiles(changedFiles);
const eslintFiles = filterLintableFiles(changedFiles);

if (prettierFiles.length > 0) {
	runCheckedStep('Checking formatting on changed files', 'pnpm', [
		'exec',
		'prettier',
		'--check',
		...prettierFiles
	]);
}

if (eslintFiles.length > 0) {
	runCheckedStep('Linting changed files', 'pnpm', ['exec', 'eslint', ...eslintFiles]);
}

runCheckedStep('Running runtime policy gate', 'pnpm', ['policy:runtime']);
