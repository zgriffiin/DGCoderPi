import { describe, expect, it } from 'vitest';
import { referenceWorkbenchData } from '$lib/data/reference-workspace';
import { filterProjects } from '$lib/workbench/filter';

describe('filterProjects', () => {
	it('returns all projects for an empty query', () => {
		expect(filterProjects(referenceWorkbenchData.projects, '')).toHaveLength(
			referenceWorkbenchData.projects.length
		);
	});

	it('keeps only matching threads when the project itself does not match', () => {
		const results = filterProjects(referenceWorkbenchData.projects, 'specification');

		expect(results).toHaveLength(1);
		expect(results[0].threads).toHaveLength(1);
		expect(results[0].threads[0].id).toBe('spec-mode');
	});

	it('returns the full project when the project metadata matches', () => {
		const results = filterProjects(referenceWorkbenchData.projects, 'prompt-lab');

		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('prompt-lab');
		expect(results[0].threads).toHaveLength(1);
	});
});
