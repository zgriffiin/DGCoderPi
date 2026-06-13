import { describe, expect, it } from 'vitest';
import type { DiffAnalysis } from '$lib/types/workbench';
import { buildShipReviewFixPrompt, projectHasRunningShipReview } from './ship-review';

describe('buildShipReviewFixPrompt', () => {
	it('grounds the fix request in every ship review risk', () => {
		expect.assertions(9);

		const prompt = buildShipReviewFixPrompt({
			changeBrief: [],
			continuationToken: null,
			error: null,
			fingerprint: 'sha256:test',
			focusQueue: [
				{
					file: 'src/App.svelte',
					hunkId: 'src/App.svelte:10:1:4',
					priority: 'high',
					reason: 'Stepper wiring changed core navigation.'
				}
			],
			impact: [],
			modelKey: 'openai::gpt-5.5',
			partial: false,
			progress: 100,
			risks: [
				{
					confidence: 'medium',
					detail: 'Narrow viewport layout may regress.',
					evidence: [
						{
							endLine: 42,
							file: 'src/app.css',
							hunkId: 'src/app.css:28:1:14',
							startLine: 28
						}
					],
					level: 'high',
					title: 'Potential responsive/layout regression',
					whyItMatters: 'Small-screen users may lose access to workflow controls.'
				}
			],
			status: 'complete',
			suggestedFollowUps: [],
			updatedAtMs: 1
		} satisfies DiffAnalysis);

		expect(prompt).toContain('Fix the 1 ship review issue before shipping.');
		expect(prompt).toContain('Potential responsive/layout regression');
		expect(prompt).toContain('Narrow viewport layout may regress.');
		expect(prompt).toContain('src/app.css lines 28-42 [src/app.css:28:1:14]');
		expect(prompt).toContain('Small-screen users may lose access to workflow controls.');
		expect(prompt).toContain('src/App.svelte (high): Stepper wiring changed core navigation.');
		expect(prompt).toContain('Rerun the diff review or ship gate after fixes');
		expect(prompt).toContain('continue the full Ship workflow');
		expect(prompt).toContain('merge/close the PR, and clean up the local branch');
	});
});

describe('projectHasRunningShipReview', () => {
	it('detects an active ship review anywhere in the project', () => {
		expect.assertions(3);

		expect(
			projectHasRunningShipReview(
				{
					'a::one': {
						analysis: null,
						error: null,
						projectId: 'project-a',
						status: 'reviewing',
						threadId: 'one'
					}
				},
				'project-a'
			)
		).toBe(true);
		expect(
			projectHasRunningShipReview(
				{
					'a::one': {
						analysis: null,
						error: null,
						projectId: 'project-a',
						status: 'needs-decision',
						threadId: 'one'
					}
				},
				'project-a'
			)
		).toBe(false);
		expect(projectHasRunningShipReview({}, 'project-a')).toBe(false);
	});
});
