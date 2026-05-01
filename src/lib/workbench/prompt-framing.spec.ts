import { describe, expect, it } from 'vitest';
import { formatPromptText } from '../../../sidecar/prompt-format.mjs';

describe('prompt framing', () => {
	it('prepends intent guidance before user text', () => {
		const prompt = formatPromptText(
			'Summarize the diff.',
			[],
			'Intent: Review. Lead with findings.'
		);

		expect(prompt).toBe('Intent: Review. Lead with findings.\n\nSummarize the diff.');
	});

	it('keeps intent guidance ahead of attachment context', () => {
		const prompt = formatPromptText(
			'Use this file.',
			[{ mimeType: 'text/markdown', name: 'README.md', path: 'C:/repo/README.md' }],
			'Intent: Understand. Explain flow.'
		);

		expect(prompt).toContain('Intent: Understand. Explain flow.\n\nUse this file.');
		expect(prompt).toContain('Attached files:');
	});
});
