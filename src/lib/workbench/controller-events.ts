import type { Writable } from 'svelte/store';
import type { AppEvent, AppSnapshot, AppUpdate } from '$lib/types/workbench';
import type { WorkbenchState } from '$lib/workbench/controller-state';

function applySelection(
	snapshot: AppSnapshot,
	selectedProjectId: string | null,
	selectedThreadId: string | null
) {
	Object.assign(snapshot, { selectedProjectId, selectedThreadId });
}

function upsertProject(snapshot: AppSnapshot, project: AppSnapshot['projects'][number]) {
	const index = snapshot.projects.findIndex((entry) => entry.id === project.id);
	if (index === -1) {
		snapshot.projects = [...snapshot.projects, project];
		return;
	}

	snapshot.projects = snapshot.projects.map((entry, currentIndex) =>
		currentIndex === index ? project : entry
	);
}

function upsertThread(
	snapshot: AppSnapshot,
	projectId: string,
	thread: AppSnapshot['projects'][number]['threads'][number]
) {
	snapshot.projects = snapshot.projects.map((project) => {
		if (project.id !== projectId) {
			return project;
		}

		const threadIndex = project.threads.findIndex((entry) => entry.id === thread.id);
		const threads =
			threadIndex === -1
				? [...project.threads, thread]
				: project.threads.map((entry, index) => (index === threadIndex ? thread : entry));
		return { ...project, threads };
	});
}

function reorderProjects(snapshot: AppSnapshot, projectIds: string[]) {
	const projectById = new Map(snapshot.projects.map((project) => [project.id, project]));
	const orderedProjects = projectIds
		.map((projectId) => projectById.get(projectId))
		.filter((project): project is NonNullable<typeof project> => Boolean(project));
	const remainingProjects = snapshot.projects.filter((project) => !projectIds.includes(project.id));
	snapshot.projects = [...orderedProjects, ...remainingProjects];
}

function cloneSnapshotShell(snapshot: AppSnapshot): AppSnapshot {
	return {
		...snapshot,
		health: { ...snapshot.health },
		integrations: {
			codex: { ...snapshot.integrations.codex }
		},
		models: [...snapshot.models],
		projects: snapshot.projects.map((project) => ({
			...project,
			threads: [...project.threads]
		})),
		settings: {
			...snapshot.settings,
			features: { ...snapshot.settings.features },
			providers: [...snapshot.settings.providers]
		}
	};
}

function applyEventToSnapshot(snapshot: AppSnapshot, event: AppEvent) {
	if (event.type === 'project-upserted') {
		upsertProject(snapshot, event.project);
		applySelection(snapshot, event.selectedProjectId, event.selectedThreadId);
		return;
	}

	if (event.type === 'project-order-changed') {
		reorderProjects(snapshot, event.projectIds);
		applySelection(snapshot, event.selectedProjectId, event.selectedThreadId);
		return;
	}

	if (event.type === 'project-removed') {
		snapshot.projects = snapshot.projects.filter((project) => project.id !== event.projectId);
		applySelection(snapshot, event.selectedProjectId, event.selectedThreadId);
		return;
	}

	if (event.type === 'thread-upserted') {
		upsertThread(snapshot, event.projectId, event.thread);
		applySelection(snapshot, event.selectedProjectId, event.selectedThreadId);
		return;
	}

	if (event.type === 'settings-updated') snapshot.settings = event.settings;
	if (event.type === 'models-updated') snapshot.models = event.models;
	if (event.type === 'health-updated') snapshot.health = event.health;
	if (event.type === 'integrations-updated') snapshot.integrations = event.integrations;
}

export function createUpdateApplier(store: Writable<WorkbenchState>) {
	return (update: AppUpdate) => {
		store.update((state) => {
			const snapshot = cloneSnapshotShell(state.snapshot);
			for (const event of update.events) {
				applyEventToSnapshot(snapshot, event);
			}
			return {
				...state,
				error: null,
				heartbeatPending: false,
				lastSnapshotAtMs: Date.now(),
				runtimeAvailable: true,
				snapshot
			};
		});
	};
}
