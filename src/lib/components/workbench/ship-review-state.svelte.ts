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

	function currentScopeKey() {
		return scopeKey(activeProject()?.id ?? null, activeThread()?.id ?? null);
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
		await controller.sendPrompt(threadId, buildShipSlicePrompt(), mode);
		setScoped(projectId, threadId, createIdleShipReview());
	}

	return {
		get projectRunning() {
			return projectHasRunningShipReview(reviews, activeProject()?.id ?? null);
		},
		get review() {
			return reviews[currentScopeKey()] ?? createIdleShipReview();
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
			if (!project || !thread || scoped(project.id, thread.id).status === 'reviewing') return;
			await runAction(async () => {
				const requestId = nextRequestId(project.id, thread.id);
				setScoped(project.id, thread.id, createReviewingShipReview(project.id, thread.id));
				const result = await runShipReviewGate(
					controller,
					project.id,
					thread.id,
					() => currentRequestId(project.id, thread.id) === requestId
				);
				if (currentRequestId(project.id, thread.id) !== requestId) return;
				if (!result) {
					await sendShipPrompt(project.id, thread.id, thread.status);
					return;
				}
				setScoped(project.id, thread.id, result);
				if (result.status === 'needs-decision') setInspectorMode();
			});
		}
	};
}
