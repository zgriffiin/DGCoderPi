export function buildShipSlicePrompt() {
	return [
		'We are done with this slice. Take it across the finish line and merge it cleanly to main.',
		'This Ship action is explicit authorization to commit, push, create or update the PR, merge it when green, close the PR through merge, and clean up local branch state for this slice.',
		'',
		'Required workflow:',
		'1. Run every required local validation for this repo before commit. Include formatter, lint, type checks, tests, Rust checks when touched, the fallow gates, and the local CodeRabbit review step required by AGENTS.md.',
		'2. Fix every failure or review finding you hit. Do not ignore, defer, or hand-wave any blocking issue.',
		'3. Inspect the worktree before staging. Include only changes required for this slice; do not commit unrelated user work.',
		'4. Once clean, create a focused commit for the slice with a clear commit message.',
		'5. Push the branch.',
		'6. Create or update the PR targeting `main` with a concise summary of what changed and how it was validated.',
		'7. Review all PR feedback, including CodeRabbit findings, and address each one before merging.',
		'8. Merge only after the branch is green and review findings are resolved, then verify the PR is merged/closed.',
		'9. Clean up local branch state after merge: switch back to the updated target branch and delete the merged local feature branch when it is safe to do so.',
		'',
		'Execution rules:',
		'- Keep the worktree clean except for changes required to finish this slice.',
		'- Do not stop after validation, review fixes, commit, push, or PR creation if merge and cleanup are still possible.',
		'- Do not ask for confirmation solely because push, PR merge, or post-merge cleanup is required by this Ship action.',
		'- If something blocks the merge, stop and report the exact blocker and the next best action.',
		'- Do not leave the work half-shipped. Either complete the merge or clearly explain why it cannot be completed.'
	].join('\n');
}
