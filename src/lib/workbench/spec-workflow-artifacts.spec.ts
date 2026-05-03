import { describe, expect, it } from 'vitest';
import type { ThreadRecord } from '$lib/types/workbench';
import { SPEC_WORKFLOW_STEPS } from '$lib/workbench/spec-workflow';
import { latestSpecArtifactFallbackText } from '$lib/workbench/spec-workflow-artifacts';

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

describe('spec workflow artifacts', () => {
	it('returns the latest stage artifact text from thread messages', () => {
		const thread = buildThread([
			{
				id: 'm1',
				role: 'assistant',
				status: 'ready',
				text: '# Tasks\nold\n\n## Tasks Gate\nStatus: PASS',
				timestampMs: 1
			},
			{
				id: 'm2',
				role: 'assistant',
				status: 'ready',
				text: 'Preamble\n\n# Tasks\nlatest\n\n## Tasks Gate\nStatus: PASS',
				timestampMs: 2
			}
		]);

		expect(latestSpecArtifactFallbackText(thread, SPEC_WORKFLOW_STEPS[4])).toBe(
			'# Tasks\nlatest\n\n## Tasks Gate\nStatus: PASS'
		);
	});

	it('uses the stage-specific heading when available', () => {
		const thread = buildThread([
			{
				id: 'm1',
				role: 'assistant',
				status: 'ready',
				text: 'Intro\n\n# Context Map\n## Repository shape\n- src\n\n## Understand Gate\nStatus: PASS',
				timestampMs: 1
			}
		]);

		expect(latestSpecArtifactFallbackText(thread, SPEC_WORKFLOW_STEPS[1])).toBe(
			'# Context Map\n## Repository shape\n- src\n\n## Understand Gate\nStatus: PASS'
		);
	});

	it('returns null when the stage has no assistant output yet', () => {
		const thread = buildThread([
			{
				id: 'm1',
				role: 'assistant',
				status: 'ready',
				text: '# Review\n## Review Gate\nStatus: PASS',
				timestampMs: 1
			}
		]);

		expect(latestSpecArtifactFallbackText(thread, SPEC_WORKFLOW_STEPS[0])).toBeNull();
	});
});
