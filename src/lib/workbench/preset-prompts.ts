export function buildShipSlicePrompt() {
	return [
		'We are done with this slice. Take it across the finish line and merge it cleanly to main.',
		'',
		'Required workflow:',
		'1. Run every required local validation for this repo before commit. Include formatter, lint, type checks, tests, Rust checks when touched, the fallow gates, and the local CodeRabbit review step required by AGENTS.md.',
		'2. Fix every failure or review finding you hit. Do not ignore, defer, or hand-wave any blocking issue.',
		'3. Once clean, create a focused commit for the slice with a clear commit message.',
		'4. Push the branch.',
		'5. Create or update the PR targeting `main` with a concise summary of what changed and how it was validated.',
		'6. Review all PR feedback, including CodeRabbit findings, and address each one before merging.',
		'7. Merge only after the branch is green and review findings are resolved.',
		'',
		'Execution rules:',
		'- Keep the worktree clean except for changes required to finish this slice.',
		'- If something blocks the merge, stop and report the exact blocker and the next best action.',
		'- Do not leave the work half-shipped. Either complete the merge or clearly explain why it cannot be completed.'
	].join('\n');
}
