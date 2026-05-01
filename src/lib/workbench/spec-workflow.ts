import type { ThreadIntent } from '$lib/types/workbench';

export type SpecWorkflowStep = {
	artifact: string;
	body: string;
	intent: ThreadIntent;
	label: string;
	prompt: string;
};

export const SPEC_WORKFLOW_STEPS: SpecWorkflowStep[] = [
	{
		artifact: 'Context map',
		body: 'Repository shape, affected systems, constraints, risks, and unknowns.',
		intent: 'understand',
		label: 'Understand',
		prompt: [
			'Help me understand this workspace before we write a spec.',
			'',
			'Map the relevant architecture, files, data flow, constraints, and risks for the change I am considering.',
			'Call out assumptions and open questions separately. Do not change code.'
		].join('\n')
	},
	{
		artifact: 'requirements.md',
		body: 'User stories, functional behavior, edge cases, and EARS-style acceptance criteria.',
		intent: 'plan',
		label: 'Requirements',
		prompt: [
			'Draft requirements for this feature in a spec-driven workflow.',
			'',
			'Include user stories, functional requirements, edge cases, error handling, and testable acceptance criteria. Prefer EARS-style acceptance criteria when it fits. Do not design or implement yet.'
		].join('\n')
	},
	{
		artifact: 'design.md',
		body: 'Architecture, component boundaries, data flow, contracts, persistence, and validation.',
		intent: 'plan',
		label: 'Design',
		prompt: [
			'Create the technical design for the approved requirements.',
			'',
			'Cover architecture, runtime boundaries, UI behavior, data flow, persistence, API or IPC contracts, error handling, testing strategy, and tradeoffs. Do not implement yet.'
		].join('\n')
	},
	{
		artifact: 'tasks.md',
		body: 'Ordered implementation tasks with dependencies, validation, and requirement traceability.',
		intent: 'plan',
		label: 'Tasks',
		prompt: [
			'Break the approved design into executable implementation tasks.',
			'',
			'Make each task scoped, ordered, traceable to requirements, and clear about validation. Include UI workflow proof where behavior is user-visible. Do not implement yet.'
		].join('\n')
	},
	{
		artifact: 'Patch',
		body: 'Scoped code changes against the approved tasks and repo constraints.',
		intent: 'implement',
		label: 'Implement',
		prompt: [
			'Implement the approved task list for this spec.',
			'',
			'Work sequentially, keep changes scoped, follow the repo runtime and testing policy, and validate user-visible behavior through the real UI when applicable.'
		].join('\n')
	},
	{
		artifact: 'Review report',
		body: 'Findings-first review, regressions, missing tests, and required fixups.',
		intent: 'review',
		label: 'Review',
		prompt: [
			'Review the current implementation against the spec and repo policy.',
			'',
			'Lead with concrete findings ordered by severity. Check requirements coverage, regressions, missing validation, UI behavior, and release blockers.'
		].join('\n')
	},
	{
		artifact: 'Ship plan',
		body: 'Final validation, commit, push, PR, and review-feedback closure.',
		intent: 'ship',
		label: 'Ship',
		prompt: [
			'Prepare this completed spec slice for shipping.',
			'',
			'Run the required local gates, fix failures, summarize validation, prepare a focused commit and PR, and stop with exact blockers if anything prevents shipping.'
		].join('\n')
	}
];
