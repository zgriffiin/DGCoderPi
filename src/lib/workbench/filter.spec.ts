import { describe, expect, it } from 'vitest';
import { filterProjects } from './filter';
import type { ProjectRecord } from '$lib/types/workbench';

function buildProject(): ProjectRecord {
	return {
		branch: 'main',
		id: 'project-1',
		name: 'Desktop Workbench',
		path: 'C:\\Repos\\desktop-workbench',
		threads: [
			{
				activities: [],
				attachments: [],
				branch: 'feature/queue-aware-ui',
				id: 'thread-1',
				lastError: null,
				messages: [
					{
						id: 'message-1',
						role: 'assistant',
						status: 'ready',
						text: 'Queue state is durable across restarts.',
						timestampMs: 1
					}
				],
				modelKey: null,
				queue: [],
				reasoningLevel: 'medium',
				status: 'completed',
				title: 'Queue-aware thread',
				updatedAtMs: 1
			},
			{
				activities: [],
				attachments: [],
				branch: 'feature/attachments',
				id: 'thread-2',
				lastError: null,
				messages: [
					{
						id: 'message-2',
						role: 'user',
						status: 'ready',
						text: 'Parse the attached spreadsheet.',
						timestampMs: 2
					}
				],
				modelKey: null,
				queue: [],
				reasoningLevel: 'medium',
				status: 'idle',
				title: 'Attachment parsing',
				updatedAtMs: 2
			}
		]
	};
}

describe('filterProjects', () => {
	it('returns the original projects when the query is blank', () => {
		const projects = [buildProject()];

		expect(filterProjects(projects, '   ')).toEqual(projects);
	});

	it('keeps only matching threads when the project matches through thread content', () => {
		const filtered = filterProjects([buildProject()], 'spreadsheet');

		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.threads).toHaveLength(1);
		expect(filtered[0]?.threads[0]?.id).toBe('thread-2');
	});
});
