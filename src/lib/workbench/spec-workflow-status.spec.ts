import { describe, expect, it } from 'vitest';
import type { ThreadRecord, WorkflowSettings } from '$lib/types/workbench';
import { SPEC_WORKFLOW_STEPS } from './spec-workflow';
import { specWorkflowAdvanceState } from './spec-workflow-status';

const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
	blockTaskAdvanceOnReviewFindings: true,
	responseVerbosity: 'full',
	reviewPolicy: 'fallback'
};

function threadWithAssistantMessage(text: string): ThreadRecord {
	return {
		activities: [],
		attachments: [],
		branch: 'main',
		id: 'thread-1',
		intent: 'implement',
		lastError: null,
		lastUserMessageAtMs: 0,
		messages: [
			{
				id: 'assistant-1',
				role: 'assistant',
				status: 'ready',
				text,
				timestampMs: 1
			}
		],
		modelKey: null,
		queue: [],
		reasoningLevel: 'medium',
		status: 'idle',
		title: 'Test thread',
		updatedAtMs: 1
	};
}

describe('spec workflow advance lock', () => {
	it('blocks later stages when implement output still has blocker findings', () => {
		const thread = threadWithAssistantMessage(`
# Implementation Result
## Blocking findings
- workers/generation/generateBlueprint.ts: fabricated support still inferred by array position
## Implementation Gate
Status: FAIL
`);

		expect(
			specWorkflowAdvanceState(thread, SPEC_WORKFLOW_STEPS, DEFAULT_WORKFLOW_SETTINGS)
		).toEqual({
			blocked: true,
			blockingStepLabel: 'Implement',
			reason: 'Implement still has unresolved blocker findings'
		});
	});

	it('does not block when the setting is disabled', () => {
		const thread = threadWithAssistantMessage(`
# Review
## Must-fix findings
### REV-001
Issue: unresolved issue
## Review Gate
Status: FAIL
`);

		expect(
			specWorkflowAdvanceState(thread, SPEC_WORKFLOW_STEPS, {
				...DEFAULT_WORKFLOW_SETTINGS,
				blockTaskAdvanceOnReviewFindings: false
			})
		).toEqual({
			blocked: false,
			blockingStepLabel: null,
			reason: null
		});
	});
});
