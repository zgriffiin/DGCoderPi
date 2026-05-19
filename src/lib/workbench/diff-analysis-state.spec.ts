import { describe, expect, it } from 'vitest';
import type { DiffAnalysis, ProjectDiffSnapshot } from '$lib/types/workbench';
import {
	createInProgressAnalysis,
	hasDiffReviewContent,
	mergeVisibleDiffAnalysis
} from './diff-analysis-state';

const snapshot = {
	branch: 'main',
	files: [],
	fingerprint: 'sha256:test',
	generatedAtMs: 1,
	gitAvailable: true,
	stats: { additions: 1, deletions: 0, filesChanged: 1 }
} satisfies ProjectDiffSnapshot;

function analysis(overrides: Partial<DiffAnalysis> = {}): DiffAnalysis {
	return {
		changeBrief: [],
		continuationToken: null,
		error: null,
		fingerprint: 'sha256:test',
		focusQueue: [],
		impact: [],
		modelKey: 'openai::gpt-5.5',
		partial: false,
		progress: 0,
		risks: [],
		status: 'pending',
		suggestedFollowUps: [],
		updatedAtMs: 1,
		...overrides
	};
}

describe('diff analysis state', () => {
	it('preserves visible review content when a refresh starts for the same diff', () => {
		expect.assertions(3);

		const current = analysis({
			changeBrief: [{ detail: 'Updated import flow.', evidence: [], title: 'Import changes' }],
			progress: 50,
			status: 'in-progress'
		});

		const next = createInProgressAnalysis(snapshot, current);

		expect(next.status).toBe('in-progress');
		expect(next.progress).toBe(0);
		expect(next.changeBrief).toEqual(current.changeBrief);
	});

	it('keeps rendered sections when a stale in-progress poll has no content', () => {
		expect.assertions(3);

		const current = analysis({
			risks: [
				{
					confidence: 'medium',
					detail: 'Export can be blocked incorrectly.',
					evidence: [],
					level: 'medium',
					title: 'Export guard risk',
					whyItMatters: 'Users may be unable to ship.'
				}
			],
			progress: 50,
			status: 'in-progress'
		});
		const stale = analysis({ progress: 0, status: 'in-progress', updatedAtMs: 2 });

		const merged = mergeVisibleDiffAnalysis(current, stale);

		expect(hasDiffReviewContent(merged)).toBe(true);
		expect(merged.progress).toBe(0);
		expect(merged.risks).toEqual(current.risks);
	});

	it('normalizes completed analysis progress to 100%', () => {
		expect.assertions(2);

		const merged = mergeVisibleDiffAnalysis(null, analysis({ progress: 50, status: 'complete' }));

		expect(merged.progress).toBe(100);
		expect(merged.partial).toBe(false);
	});
});
