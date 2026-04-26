import type { ProjectRecord } from '$lib/types/workbench';

function normalizeQuery(value: string) {
	return value.trim().toLowerCase();
}

function includesQuery(source: string, query: string) {
	return source.toLowerCase().includes(query);
}

export function filterProjects(projects: ProjectRecord[], query: string) {
	const normalizedQuery = normalizeQuery(query);

	if (!normalizedQuery) {
		return projects;
	}

	return projects
		.map((project) => {
			const projectMatches =
				includesQuery(project.name, normalizedQuery) ||
				includesQuery(project.path, normalizedQuery) ||
				includesQuery(project.branch, normalizedQuery);

			if (projectMatches) {
				return project;
			}

			const matchingThreads = project.threads.filter((thread) => {
				return (
					includesQuery(thread.title, normalizedQuery) ||
					includesQuery(thread.branch, normalizedQuery) ||
					includesQuery(thread.status, normalizedQuery) ||
					thread.messages.some((message) => includesQuery(message.text, normalizedQuery))
				);
			});

			return matchingThreads.length > 0 ? { ...project, threads: matchingThreads } : null;
		})
		.filter((project): project is ProjectRecord => project !== null);
}
