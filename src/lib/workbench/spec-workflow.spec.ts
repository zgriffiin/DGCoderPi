import { describe, expect, it } from 'vitest';
import { SPEC_WORKFLOW_STEPS } from './spec-workflow';

describe('spec workflow', () => {
	it('runs from understanding through ship', () => {
		expect(SPEC_WORKFLOW_STEPS.map((step) => step.label)).toEqual([
			'Understand',
			'Requirements',
			'Design',
			'Tasks',
			'Implement',
			'Review',
			'Ship'
		]);
	});

	it('keeps Kiro-style planning steps non-executing', () => {
		const planningPrompts = SPEC_WORKFLOW_STEPS.filter((step) =>
			['Requirements', 'Design', 'Tasks'].includes(step.label)
		).map((step) => step.prompt);

		expect(planningPrompts.every((prompt) => prompt.includes('implement yet'))).toBe(true);
	});
});
