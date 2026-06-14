import type { ProjectRecord, ThreadRecord } from '$lib/types/workbench';
import { buildShipSlicePrompt } from '$lib/workbench/preset-prompts';
import type { WorkbenchController } from '$lib/workbench/controller';
import {
	createIdleShipReview,
	createReviewingShipReview,
	projectHasRunningShipReview,
	runShipReviewGate,
	shipReviewScopeMatches
} from '$lib/workbench/ship-review';

type ShipReviewScopeMap = Record<string, ReturnType<typeof createIdleShipReview>>;

type ShipReviewSliceContext = {
	controller: WorkbenchController;
	currentRequestId: (projectId: string, threadId: string) => number;
	nextRequestId: (projectId: string, threadId: string) => number;
	scoped: (projectId: string, threadId: string) => ReturnType<typeof createIdleShipReview>;
	setScoped: (
		projectId: string,
		threadId: string,
		nextReview: ReturnType<typeof createIdleShipReview>
	) => void;
	sendShipPrompt: (
		projectId: string,
		threadId: string,
		status: ThreadRecord['status']
	) => Promise<void>;
	setInspectorMode: () => void;
};

async function runShipReviewSlice(
	context: ShipReviewSliceContext,
	project: ProjectRecord,
	thread: ThreadRecord
) {
	if (context.scoped(project.id, thread.id).status === 'reviewing') return;
	const requestId = context.nextRequestId(project.id, thread.id);
	const isCurrent = () => context.currentRequestId(project.id, thread.id) === requestId;
	context.setScoped(project.id, thread.id, createReviewingShipReview(project.id, thread.id));
	try {
		const result = await runShipReviewGate(context.controller, project.id, thread.id, isCurrent);
		if (!isCurrent()) return;
		if (!result) {
			await context.sendShipPrompt(project.id, thread.id, thread.status);
			return;
		}
		context.setScoped(project.id, thread.id, result);
		if (result.status === 'needs-decision') context.setInspectorMode();
	} catch (error) {
		// Reset out of the reviewing state on failure so the thread is not left permanently locked.
		if (isCurrent()) context.setScoped(project.id, thread.id, createIdleShipReview());
		throw error;
	}
}

export function createShipReviewState(
	controller: WorkbenchController,
	activeProject: () => ProjectRecord | null,
	activeThread: () => ThreadRecord | null,
	setInspectorMode: () => void,
	runAction: (action: () => Promise<void>) => Promise<void>
) {
	let reviews = $state<ShipReviewScopeMap>({});
	let requestIds = $state<Record<string, number>>({});

	function scopeKey(projectId: string | null, threadId: string | null) {
		return `${projectId ?? ''}::${threadId ?? ''}`;
	}

	function scoped(projectId: string | null, threadId: string | null) {
		return reviews[scopeKey(projectId, threadId)] ?? createIdleShipReview();
	}

	function setScoped(
		projectId: string | null,
		threadId: string | null,
		nextReview: ReturnType<typeof createIdleShipReview>
	) {
		reviews = { ...reviews, [scopeKey(projectId, threadId)]: nextReview };
	}

	function nextRequestId(projectId: string | null, threadId: string | null) {
		const key = scopeKey(projectId, threadId);
		const nextId = (requestIds[key] ?? 0) + 1;
		requestIds = { ...requestIds, [key]: nextId };
		return nextId;
	}

	function currentRequestId(projectId: string | null, threadId: string | null) {
		return requestIds[scopeKey(projectId, threadId)] ?? 0;
	}

	async function sendShipPrompt(
		projectId: string,
		threadId: string,
		status: ThreadRecord['status']
	) {
		if (!shipReviewScopeMatches(scoped(projectId, threadId), projectId, threadId)) {
			return;
		}

		const mode = status === 'running' ? 'follow-up' : 'prompt';
		try {
			await controller.sendPrompt(threadId, buildShipSlicePrompt(), mode);
		} finally {
			setScoped(projectId, threadId, createIdleShipReview());
		}
	}

	return {
		get projectRunning() {
			return projectHasRunningShipReview(reviews, activeProject()?.id ?? null);
		},
		get review() {
			return scoped(activeProject()?.id ?? null, activeThread()?.id ?? null);
		},
		hasRunningProject(projectId: string | null) {
			return projectHasRunningShipReview(reviews, projectId);
		},
		continue: async () => {
			const thread = activeThread();
			const projectId = activeProject()?.id ?? null;
			if (!thread || !projectId) return;
			if (!shipReviewScopeMatches(scoped(projectId, thread.id), projectId, thread.id)) {
				setScoped(projectId, thread.id, createIdleShipReview());
				return;
			}
			await runAction(async () => sendShipPrompt(projectId, thread.id, thread.status));
		},
		dismiss: async () => {
			const project = activeProject();
			const thread = activeThread();
			if (!project || !thread) return;
			nextRequestId(project.id, thread.id);
			setScoped(project.id, thread.id, createIdleShipReview());
		},
		slice: async () => {
			const project = activeProject();
			const thread = activeThread();
			if (!project || !thread) return;
			await runAction(() =>
				runShipReviewSlice(
					{
						controller,
						currentRequestId,
						nextRequestId,
						scoped,
						setScoped,
						sendShipPrompt,
						setInspectorMode
					},
					project,
					thread
				)
			);
		}
	};
}
