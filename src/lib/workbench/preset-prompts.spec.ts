import { describe, expect, it } from 'vitest';
import { buildShipSlicePrompt } from './preset-prompts';

describe('buildShipSlicePrompt', () => {
	it('authorizes the full PR merge and cleanup lifecycle', () => {
		expect.assertions(6);

		const prompt = buildShipSlicePrompt();

		expect(prompt).toContain('explicit authorization to commit, push');
		expect(prompt).toContain('merge it when green');
		expect(prompt).toContain('verify the PR is merged/closed');
		expect(prompt).toContain('delete the merged local feature branch');
		expect(prompt).toContain('do not commit unrelated user work');
		expect(prompt).toContain('Do not stop after validation');
	});
});
