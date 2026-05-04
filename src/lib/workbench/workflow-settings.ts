import type { ResponseVerbosity, ReviewPolicy, WorkflowSettings } from '$lib/types/workbench';

export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
	blockTaskAdvanceOnReviewFindings: true,
	responseVerbosity: 'full',
	reviewPolicy: 'fallback'
};

function reviewPolicyGuidance(reviewPolicy: ReviewPolicy) {
	if (reviewPolicy === 'off') {
		return 'External review tooling is disabled for this user or session. Do not stop solely because CodeRabbit or another external review tool is unavailable. Still run repo validations, perform direct review, and fix any user-supplied review findings.';
	}

	if (reviewPolicy === 'required') {
		return 'Configured external review tooling is required in this environment. Treat tool unavailability or unresolved correctness findings from that tool as blocking unless the user explicitly waives them.';
	}

	return 'Configured external review tooling is preferred but not mandatory. Use it when available; otherwise use the strongest available fallback review path and continue.';
}

function responseVerbosityGuidance(responseVerbosity: ResponseVerbosity) {
	if (responseVerbosity === 'lite') {
		return 'Visible responses should be very terse: current task, blocker list, command result, next action. Skip recap unless asked.';
	}

	if (responseVerbosity === 'ultra') {
		return 'Visible responses may be more detailed, but still lead with blockers, findings, and next action before any narrative.';
	}

	return 'Visible responses should be concise but complete: blockers first, then findings, then next action. Avoid long recaps and giant file inventories unless asked.';
}

function resolveWorkflowSettings(settings?: WorkflowSettings | null) {
	return settings ?? DEFAULT_WORKFLOW_SETTINGS;
}

export function workflowSettingsGuidance(settings?: WorkflowSettings | null) {
	const resolved = resolveWorkflowSettings(settings);
	return [
		'Runtime workflow settings for this run:',
		`- Review policy: ${resolved.reviewPolicy}. ${reviewPolicyGuidance(resolved.reviewPolicy)}`,
		`- Response verbosity: ${resolved.responseVerbosity}. ${responseVerbosityGuidance(resolved.responseVerbosity)}`,
		`- Block task advance on review findings: ${resolved.blockTaskAdvanceOnReviewFindings ? 'enabled' : 'disabled'}. ${
			resolved.blockTaskAdvanceOnReviewFindings
				? 'Do not advance to later tasks or later spec stages while unresolved blocker findings remain on the current slice.'
				: 'You may report blocker findings without the UI locking later stages, but unresolved correctness issues still require explicit user acceptance before counting the slice complete.'
		}`
	].join('\n');
}

export function shipPromptReviewPolicyInstruction(settings?: WorkflowSettings | null) {
	const resolved = resolveWorkflowSettings(settings);
	if (resolved.reviewPolicy === 'off') {
		return '6. Review all available PR feedback and direct review findings before merging. External review tooling is disabled for this user or machine, so do not block on it.';
	}

	if (resolved.reviewPolicy === 'required') {
		return '6. Review all PR feedback and configured review-tool findings, and address each one before merging. If the configured review tool is unavailable, stop and report that blocker.';
	}

	return '6. Review all PR feedback and configured review-tool findings, and address each one before merging.';
}

export function shipPromptReviewPolicyFallback(settings?: WorkflowSettings | null) {
	const resolved = resolveWorkflowSettings(settings);
	if (resolved.reviewPolicy === 'required') {
		return '- Configured external review tooling is mandatory here. Do not continue to merge without it unless the user explicitly waives that requirement.';
	}

	if (resolved.reviewPolicy === 'off') {
		return '- External review tooling is disabled here. Use the strongest available direct review path instead of stopping on that absence.';
	}

	return '- If a configured review tool is unavailable for this user or machine, say so once, use the strongest available fallback review path, and continue until only a true merge blocker remains.';
}
