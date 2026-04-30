import type { AppSnapshot, ProjectRecord, ThreadRecord } from '$lib/types/workbench';

export function buildComposerHint(snapshot: AppSnapshot, thread: ThreadRecord | null) {
	if (!thread) {
		return 'Pick a thread before sending.';
	}
	if (snapshot.models.length === 0) {
		return 'No models available. Configure a provider in Settings.';
	}

	return 'Ask the agent to inspect or change.';
}

export function findActiveProject(projects: ProjectRecord[], selectedProjectId: string) {
	return projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
}

export function newestThread(threads: ThreadRecord[]) {
	return (
		[...threads].sort((left, right) => latestUserTimestamp(right) - latestUserTimestamp(left))[0] ??
		null
	);
}

export function resolveProjectSelection(snapshot: AppSnapshot, currentSelection: string) {
	if (!snapshot.projects[0]) {
		return '';
	}

	if (!currentSelection) {
		return snapshot.selectedProjectId ?? snapshot.projects[0].id;
	}

	return snapshot.projects.some((project) => project.id === currentSelection)
		? currentSelection
		: snapshot.projects[0].id;
}

export function resolveThreadSelection(
	snapshot: AppSnapshot,
	project: ProjectRecord | null,
	currentSelection: string
) {
	if (!project?.threads[0]) {
		return '';
	}

	if (!currentSelection) {
		return snapshot.selectedThreadId ?? newestThread(project.threads)?.id ?? project.threads[0].id;
	}

	return project.threads.some((thread) => thread.id === currentSelection)
		? currentSelection
		: (newestThread(project.threads)?.id ?? project.threads[0].id);
}

export function findActiveThread(project: ProjectRecord | null, selectedThreadId: string) {
	if (!project) {
		return null;
	}

	return (
		project.threads.find((thread) => thread.id === selectedThreadId) ??
		newestThread(project.threads)
	);
}

function latestUserTimestamp(thread: ThreadRecord) {
	const latestUserMessage = [...thread.messages]
		.reverse()
		.find((message) => message.role === 'user');
	return latestUserMessage?.timestampMs ?? thread.updatedAtMs;
}
