import { describe, expect, it } from 'vitest';
import type { ThreadRecord } from '$lib/types/workbench';
import { SPEC_WORKFLOW_STEPS } from '$lib/workbench/spec-workflow';
import { specWorkflowStageStatus } from '$lib/workbench/spec-workflow-status';

function buildThread(messages: ThreadRecord['messages']): ThreadRecord {
	return {
		activities: [],
		attachments: [],
		branch: 'main',
		id: 'thread-1',
		intent: 'plan',
		lastError: null,
		lastUserMessageAtMs: 0,
		messages,
		modelKey: null,
		queue: [],
		reasoningLevel: 'off',
		status: 'idle',
		title: 'Thread',
		updatedAtMs: 0
	};
}

describe('spec workflow stage status', () => {
	it('stays pending when no matching stage response exists', () => {
		const status = specWorkflowStageStatus(buildThread([]), SPEC_WORKFLOW_STEPS[0]);

		expect(status.coverage.label).toBe('Intent coverage: pending');
		expect(status.blocking.label).toBe('Blocking questions: pending');
	});

	it('marks coverage ready and blockers clear on PASS responses', () => {
		const thread = buildThread([
			{
				id: 'm1',
				role: 'assistant',
				status: 'ready',
				text: `# Tasks\n## Tasks Gate\nStatus: PASS\nChecks:\nblocking questions resolved or listed: Yes`,
				timestampMs: 1
			}
		]);

		const status = specWorkflowStageStatus(thread, SPEC_WORKFLOW_STEPS[4]);

		expect(status.coverage.label).toBe('Task coverage: ready');
		expect(status.coverage.tone).toBe('green');
		expect(status.blocking.label).toBe('Blocking questions: clear');
		expect(status.blocking.tone).toBe('green');
	});

	it('marks failed stages as needing work and blockers open when listed', () => {
		const thread = buildThread([
			{
				id: 'm1',
				role: 'assistant',
				status: 'ready',
				text: `# Design\n## Open questions\nBlocking questions:\nShould the cache be reset?\n## Design Gate\nStatus: FAIL`,
				timestampMs: 1
			}
		]);

		const status = specWorkflowStageStatus(thread, SPEC_WORKFLOW_STEPS[3]);

		expect(status.coverage.label).toBe('Design coverage: needs work');
		expect(status.coverage.tone).toBe('red');
		expect(status.blocking.label).toBe('Blocking questions: open');
		expect(status.blocking.tone).toBe('warm-gray');
	});
});
