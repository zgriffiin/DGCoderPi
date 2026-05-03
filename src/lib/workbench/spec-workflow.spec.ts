import { describe, expect, it } from 'vitest';
import { buildSpecWorkflowRunRequest, SPEC_WORKFLOW_STEPS } from './spec-workflow';

describe('spec workflow structure', () => {
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
			[5, 'implementation-log.md'],
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

describe('spec workflow prompt guards', () => {
	it('makes implement stage execute sequentially without waiting for another approval', () => {
		const implementStep = SPEC_WORKFLOW_STEPS.find((step) => step.label === 'Implement');
		expect(implementStep).toBeTruthy();
		expect(implementStep?.prompt).toContain('Execution is already approved');
		expect(implementStep?.prompt).toContain('Do not stop after producing a plan');
		expect(implementStep?.prompt).toContain('Work sequentially, one task at a time');
		expect(implementStep?.prompt).toContain('prefer Playwright UI coverage');
		expect(implementStep?.prompt).toContain('No scaffold-only completion');
		expect(implementStep?.prompt).toContain(
			'launch the real app and prove the actual workflow in the UI'
		);
		expect(implementStep?.prompt).toContain(
			'Product fidelity verdict: production-real, partial, or scaffold-only'
		);
		expect(implementStep?.prompt).toContain('Do not introduce non-production-only stand-ins');
	});

	it('pushes design and tasks toward real product slices instead of scaffolding', () => {
		const designStep = SPEC_WORKFLOW_STEPS.find((step) => step.label === 'Design');
		const tasksStep = SPEC_WORKFLOW_STEPS.find((step) => step.label === 'Tasks');

		expect(designStep?.prompt).toContain('real end-user workflow');
		expect(designStep?.prompt).toContain('## User workflow and UI states');
		expect(tasksStep?.prompt).toContain('Prefer user-visible vertical slices');
		expect(tasksStep?.prompt).toContain('Task type: user-visible slice or enabling-only');
		expect(tasksStep?.prompt).toContain('Expected visible behavior');
	});

	it('makes review and ship fail on product-fidelity gaps, not just broken code', () => {
		const reviewStep = SPEC_WORKFLOW_STEPS.find((step) => step.label === 'Review');
		const shipStep = SPEC_WORKFLOW_STEPS.find((step) => step.label === 'Ship');

		expect(reviewStep?.prompt).toContain('product fidelity');
		expect(reviewStep?.prompt).toContain('placeholder UI');
		expect(reviewStep?.prompt).toContain('## Product fidelity audit');
		expect(shipStep?.prompt).toContain('materially below the approved user workflow');
		expect(shipStep?.prompt).toContain('product fidelity is adequate for the approved scope');
	});
});

describe('spec workflow prompt rendering', () => {
	it('renders stage prompts with concrete context instead of raw placeholders', () => {
		const prompt = buildSpecWorkflowRunRequest(SPEC_WORKFLOW_STEPS[0], {
			hasPriorUserMessages: false,
			workspaceRoot: 'C:/repo/workspace'
		}).promptGuidance;

		expect(prompt).toContain('Workspace root C:/repo/workspace');
		expect(prompt).toContain('ask the user to describe the requested change');
		expect(prompt).not.toContain('{workspace_root}');
		expect(prompt).not.toContain('{user_request}');
	});

	it('builds concise run requests for stage execution', () => {
		const request = buildSpecWorkflowRunRequest(SPEC_WORKFLOW_STEPS[2], {
			hasPriorUserMessages: true,
			workspaceRoot: 'C:/repo/workspace'
		});

		expect(request.text).toContain('Run the Requirements stage');
		expect(request.text).toContain('Requirements Gate');
		expect(request.text).not.toContain('{');
		expect(request.promptGuidance).toContain('requirements.md');
		expect(request.promptGuidance).toContain('the approved intent.md content already established');
	});

	it('builds implement run requests that tell the agent to continue through all slices', () => {
		const request = buildSpecWorkflowRunRequest(SPEC_WORKFLOW_STEPS[5], {
			hasPriorUserMessages: true,
			workspaceRoot: 'C:/repo/workspace'
		});

		expect(request.text).toContain('Execute all approved in-scope tasks sequentially');
		expect(request.text).toContain('Do not stop after planning');
		expect(request.text).toContain('Do not count scaffold-only progress as completion');
		expect(request.promptGuidance).toContain('Continue until every selected task is complete');
	});
});
