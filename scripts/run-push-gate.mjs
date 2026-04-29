import { captureCommand, runCheckedStep } from './lib/process.mjs';

function listCommittedFiles() {
	const result = captureCommand('git', [
		'diff',
		'--name-only',
		'--diff-filter=ACM',
		'origin/main...HEAD'
	]);
	return result.stdout
		.split(/\r?\n/)
		.map((file) => file.trim())
		.filter(Boolean);
}

function filterLintableFiles(filePaths) {
	return filePaths.filter((filePath) =>
		/\.(?:[cm]?js|[cm]?ts|json|md|svelte|css|ya?ml)$/i.test(filePath)
	);
}

const committedFiles = listCommittedFiles();
const lintableCommittedFiles = filterLintableFiles(committedFiles);

const steps = [
	['Running type gate', 'pnpm', ['check']],
	['Running UI test gate', 'pnpm', ['test']],
	['Running fallow audit', 'pnpm', ['fallow:audit']],
	['Running Rust gate', 'pnpm', ['rust:check']],
	['Running local CodeRabbit review', 'pnpm', ['coderabbit:review']]
];

if (lintableCommittedFiles.length > 0) {
	steps.splice(
		1,
		0,
		[
			'Checking committed formatting',
			'pnpm',
			['exec', 'prettier', '--check', ...lintableCommittedFiles]
		],
		['Linting committed files', 'pnpm', ['exec', 'eslint', ...lintableCommittedFiles]]
	);
}

steps.splice(steps.length > 1 ? 2 : 1, 0, [
	'Running runtime policy gate',
	'pnpm',
	['policy:runtime']
]);

for (const [label, command, args] of steps) {
	runCheckedStep(label, command, args);
}
