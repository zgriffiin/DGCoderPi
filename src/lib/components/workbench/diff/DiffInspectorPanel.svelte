<script module lang="ts">
	type DiffReviewMode = 'ai-review' | 'patch-view';

	const collapsedFileIdsByScope: Record<string, string[]> = {};
	const hideWhitespaceByScope: Record<string, boolean> = {};
	const reviewModeByScope: Record<string, DiffReviewMode> = {};
	const viewedFileIdsByScope: Record<string, string[]> = {};

	function toggleScopedList(
		state: Record<string, string[]>,
		scopeKey: string,
		value: string
	): string[] {
		const current = state[scopeKey] ?? [];
		state[scopeKey] = current.includes(value)
			? current.filter((entry) => entry !== value)
			: [...current, value];
		return state[scopeKey];
	}
</script>

<script lang="ts">
	import DiffInspector from './DiffInspector.svelte';
	import type {
		DiffAnalysis,
		ProjectDiffSnapshot,
		ProjectRecord,
		ThreadRecord
	} from '$lib/types/workbench';
	import type { WorkbenchController } from '$lib/workbench/controller';

	type Props = {
		controller: WorkbenchController;
		onClose: () => void;
		project: ProjectRecord | null;
		thread: ThreadRecord | null;
	};

	type AnalysisRequest = {
		hideWhitespace: boolean;
		projectId: string;
		requestVersion: number;
		snapshot: ProjectDiffSnapshot;
		threadId: string | null;
	};

	let { controller, onClose, project, thread }: Props = $props();

	let diff = $state<ProjectDiffSnapshot | null>(null);
	let diffAnalysis = $state<DiffAnalysis | null>(null);
	let diffAnalysisError = $state<string | null>(null);
	let diffError = $state<string | null>(null);
	let diffLoading = $state(false);
	let collapsedFileIds = $state<string[]>([]);
	let hideWhitespace = $state(false);
	let reviewMode = $state<DiffReviewMode>('ai-review');
	let viewedFileIds = $state<string[]>([]);
	let requestVersion = 0;

	const scopeKey = $derived(thread?.id ?? project?.id ?? 'global');

	function applyScopeState(nextScopeKey: string) {
		hideWhitespace = hideWhitespaceByScope[nextScopeKey] ?? false;
		reviewMode = reviewModeByScope[nextScopeKey] ?? 'ai-review';
		viewedFileIds = viewedFileIdsByScope[nextScopeKey] ?? [];
		collapsedFileIds = collapsedFileIdsByScope[nextScopeKey] ?? [];
	}

	function persistDefaultReviewMode(nextScopeKey: string, nextDiff: ProjectDiffSnapshot) {
		if (nextDiff.files.length === 0 || reviewModeByScope[nextScopeKey]) {
			return;
		}

		reviewModeByScope[nextScopeKey] = 'ai-review';
		reviewMode = 'ai-review';
	}

	function inProgressAnalysis(snapshot: ProjectDiffSnapshot): DiffAnalysis {
		return {
			changeBrief: [],
			continuationToken: null,
			error: null,
			fingerprint: snapshot.fingerprint,
			focusQueue: [],
			impact: [],
			modelKey: '',
			partial: false,
			progress: 0,
			risks: [],
			status: 'in-progress',
			suggestedFollowUps: [],
			updatedAtMs: Date.now()
		};
	}

	async function loadDiffSnapshot(
		projectId: string,
		nextHideWhitespace: boolean,
		nextRequestVersion: number,
		nextScopeKey: string
	) {
		diffLoading = true;
		diffError = null;
		diffAnalysisError = null;
		try {
			const nextDiff = await controller.loadProjectDiff(projectId, nextHideWhitespace);
			if (nextRequestVersion !== requestVersion) {
				return null;
			}
			diff = nextDiff;
			persistDefaultReviewMode(nextScopeKey, nextDiff);
			return nextDiff;
		} catch (error) {
			if (nextRequestVersion !== requestVersion) {
				return null;
			}
			diff = null;
			diffError = error instanceof Error ? error.message : String(error);
			return null;
		} finally {
			if (nextRequestVersion === requestVersion) {
				diffLoading = false;
			}
		}
	}

	async function reloadDiffPanel(
		projectId: string,
		threadId: string | null,
		nextHideWhitespace: boolean,
		nextRequestVersion: number,
		nextScopeKey: string
	) {
		const nextDiff = await loadDiffSnapshot(
			projectId,
			nextHideWhitespace,
			nextRequestVersion,
			nextScopeKey
		);
		if (!nextDiff?.gitAvailable || nextDiff.files.length === 0) {
			diffAnalysis = null;
			return;
		}
		void refreshDiffAnalysisNow({
			hideWhitespace: nextHideWhitespace,
			projectId,
			requestVersion: nextRequestVersion,
			snapshot: nextDiff,
			threadId
		});
	}

	$effect(() => {
		applyScopeState(scopeKey);
	});

	$effect(() => {
		if (!project) {
			diff = null;
			diffAnalysis = null;
			diffError = null;
			diffAnalysisError = null;
			return;
		}

		const nextRequestVersion = requestVersion + 1;
		requestVersion = nextRequestVersion;
		const projectId = project.id;
		const threadId = thread?.id ?? null;
		const nextHideWhitespace = hideWhitespace;
		const nextScopeKey = scopeKey;

		diffAnalysis = null;
		void reloadDiffPanel(projectId, threadId, nextHideWhitespace, nextRequestVersion, nextScopeKey);
	});

	$effect(() => {
		if (
			!project ||
			!diff ||
			(diffAnalysis?.status !== 'in-progress' &&
				diffAnalysis?.status !== 'pending' &&
				!diffAnalysis?.partial)
		) {
			return;
		}

		const currentProjectId = project.id;
		const currentThreadId = thread?.id ?? null;
		const currentHideWhitespace = hideWhitespace;

		const interval = window.setInterval(() => {
			void controller
				.loadDiffAnalysis(currentProjectId, currentThreadId, currentHideWhitespace)
				.then((nextAnalysis) => {
					if (
						project?.id !== currentProjectId ||
						(thread?.id ?? null) !== currentThreadId ||
						hideWhitespace !== currentHideWhitespace
					) {
						return;
					}
					diffAnalysis = nextAnalysis;
				})
				.catch((error) => {
					if (
						project?.id !== currentProjectId ||
						(thread?.id ?? null) !== currentThreadId ||
						hideWhitespace !== currentHideWhitespace
					) {
						return;
					}
					diffAnalysisError = error instanceof Error ? error.message : String(error);
				});
		}, 1500);

		return () => window.clearInterval(interval);
	});

	function handleReviewModeChange(mode: DiffReviewMode) {
		reviewMode = mode;
		reviewModeByScope[scopeKey] = mode;
	}

	function handleToggleViewed(fileId: string) {
		viewedFileIds = [...toggleScopedList(viewedFileIdsByScope, scopeKey, fileId)];
	}

	function handleToggleCollapsed(fileId: string) {
		collapsedFileIds = [...toggleScopedList(collapsedFileIdsByScope, scopeKey, fileId)];
	}

	function handleToggleWhitespace() {
		hideWhitespace = !hideWhitespace;
		hideWhitespaceByScope[scopeKey] = hideWhitespace;
	}

	function currentAnalysisRequest(): AnalysisRequest | null {
		if (!project?.id || !diff) {
			return null;
		}
		return {
			hideWhitespace,
			projectId: project.id,
			requestVersion,
			snapshot: diff,
			threadId: thread?.id ?? null
		};
	}

	function isCurrentRequest(request: AnalysisRequest) {
		return request.requestVersion === requestVersion;
	}

	async function refreshDiffAnalysisNow(request = currentAnalysisRequest()) {
		if (!request) {
			return;
		}
		diffAnalysisError = null;
		diffAnalysis = inProgressAnalysis(request.snapshot);
		try {
			const nextAnalysis = await controller.refreshDiffAnalysis(
				request.projectId,
				request.threadId,
				request.hideWhitespace
			);
			if (!isCurrentRequest(request)) {
				return;
			}
			diffAnalysis = nextAnalysis;
		} catch (error) {
			if (!isCurrentRequest(request)) {
				return;
			}
			diffAnalysisError = error instanceof Error ? error.message : String(error);
		}
	}
</script>

<DiffInspector
	analysis={diffAnalysis}
	analysisRequestError={diffAnalysisError}
	{collapsedFileIds}
	{diff}
	{diffError}
	{diffLoading}
	{hideWhitespace}
	{onClose}
	onRefreshAnalysis={refreshDiffAnalysisNow}
	onReviewModeChange={handleReviewModeChange}
	onToggleCollapse={handleToggleCollapsed}
	onToggleViewed={handleToggleViewed}
	onToggleWhitespace={handleToggleWhitespace}
	{project}
	{reviewMode}
	{viewedFileIds}
/>
