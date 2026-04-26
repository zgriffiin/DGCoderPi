import { runCheckedStep } from './lib/process.mjs';

const steps = [
	['Running type gate', 'pnpm', ['check']],
	['Running lint gate', 'pnpm', ['lint']],
	['Running UI test gate', 'pnpm', ['test']],
	['Running fallow audit', 'pnpm', ['fallow:audit']],
	['Running Rust gate', 'pnpm', ['rust:check']],
	['Running local CodeRabbit review', 'pnpm', ['coderabbit:review']]
];

for (const [label, command, args] of steps) {
	runCheckedStep(label, command, args);
}
