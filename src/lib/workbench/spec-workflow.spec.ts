import { describe, expect, it } from 'vitest';
import { SPEC_WORKFLOW_STEPS } from './spec-workflow';

describe('spec workflow', () => {
	it('runs from intent through ship', () => {
		expect(SPEC_WORKFLOW_STEPS.map((step) => step.label)).toEqual([
			'Intent',
			'Understand',
			'Requirements',
			'Design',
			'Tasks',
			'Implement',
			'Review',
			'Ship'
		]);
	});

	it('uses stable stage numbers and artifact names', () => {
		expect(SPEC_WORKFLOW_STEPS.map((step) => [step.stage, step.artifact])).toEqual([
			[0, 'intent.md'],
			[1, 'context.md'],
			[2, 'requirements.md'],
			[3, 'design.md'],
			[4, 'tasks.md'],
			[5, 'patch plus implementation-log.md'],
			[6, 'review.md'],
			[7, 'ship.md']
		]);
	});

	it('keeps Kiro-style planning steps non-executing', () => {
		const planningPrompts = SPEC_WORKFLOW_STEPS.filter((step) =>
			['Intent', 'Understand', 'Requirements', 'Design', 'Tasks'].includes(step.label)
		).map((step) => step.prompt);

		expect(planningPrompts.every((prompt) => prompt.includes('Do not modify code'))).toBe(true);
	});

	it('requires traceability and stage gates in every prompt', () => {
		for (const step of SPEC_WORKFLOW_STEPS) {
			expect(step.prompt).toContain('trace.md');
			expect(step.prompt).toContain(step.gateLabel);
			expect(step.prompt).toContain('User approval required');
		}
	});

	it('preserves requirement-to-design-to-task coverage controls', () => {
		const allPrompts = SPEC_WORKFLOW_STEPS.map((step) => step.prompt).join('\n');

		expect(allPrompts).toContain('Requirement ID -> Design section ID -> Task ID');
		expect(allPrompts).toContain('Every requirement has validation');
		expect(allPrompts).toContain('Every requirement has design coverage');
		expect(allPrompts).toContain('Every design decision links to requirements');
	});
});
