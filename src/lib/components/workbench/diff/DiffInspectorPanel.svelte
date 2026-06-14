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
	import {
		createInProgressAnalysis,
		mergeVisibleDiffAnalysis
	} from '$lib/workbench/diff-analysis-state';

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
	let loadedKey: string | null = null;

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
		nextScopeKey: string,
		forceRefresh: boolean
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

		const request: AnalysisRequest = {
			hideWhitespace: nextHideWhitespace,
			projectId,
			requestVersion: nextRequestVersion,
			snapshot: nextDiff,
			threadId
		};

		// On automatic reloads, reuse a cached review for the current diff instead of
		// forcing a new sidecar job. Only the explicit "Refresh review" action forces a run.
		if (!forceRefresh) {
			try {
				const cached = await controller.loadDiffAnalysis(projectId, threadId, nextHideWhitespace);
				if (nextRequestVersion !== requestVersion) {
					return;
				}
				if (cached.fingerprint === nextDiff.fingerprint && cached.status !== 'pending') {
					diffAnalysis = mergeVisibleDiffAnalysis(diffAnalysis, cached);
					return;
				}
			} catch {
				if (nextRequestVersion !== requestVersion) {
					return;
				}
				// Fall through to starting a fresh review when the cache lookup fails.
			}
		}

		void refreshDiffAnalysisNow(request);
	}

	$effect(() => {
		applyScopeState(scopeKey);
	});

	$effect(() => {
		if (!project) {
			loadedKey = null;
			diff = null;
			diffAnalysis = null;
			diffError = null;
			diffAnalysisError = null;
			return;
		}

		const projectId = project.id;
		const threadId = thread?.id ?? null;
		const nextHideWhitespace = hideWhitespace;
		const nextScopeKey = scopeKey;
		const nextKey = `${projectId}\u0000${threadId ?? ''}\u0000${nextHideWhitespace ? '1' : '0'}\u0000${nextScopeKey}`;

		// Only reset and reload when the meaningful inputs change. Without this guard the
		// effect re-fires on every controller snapshot (i.e. every agent edit), which resets
		// the panel and restarts the AI review in an endless starting -> loading -> in-progress loop.
		if (nextKey === loadedKey) {
			return;
		}
		loadedKey = nextKey;

		const nextRequestVersion = requestVersion + 1;
		requestVersion = nextRequestVersion;

		diffAnalysis = null;
		void reloadDiffPanel(
			projectId,
			threadId,
			nextHideWhitespace,
			nextRequestVersion,
			nextScopeKey,
			false
		);
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
					diffAnalysis = mergeVisibleDiffAnalysis(diffAnalysis, nextAnalysis);
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
		diffAnalysis = createInProgressAnalysis(request.snapshot, diffAnalysis);
		try {
			const nextAnalysis = await controller.refreshDiffAnalysis(
				request.projectId,
				request.threadId,
				request.hideWhitespace
			);
			if (!isCurrentRequest(request)) {
				return;
			}
			diffAnalysis = mergeVisibleDiffAnalysis(diffAnalysis, nextAnalysis);
		} catch (error) {
			if (!isCurrentRequest(request)) {
				return;
			}
			diffAnalysisError = error instanceof Error ? error.message : String(error);
		}
	}

	function handleRefreshReview() {
		if (!project) {
			return;
		}
		// Explicit refresh re-fetches the latest diff snapshot and forces a fresh run so the
		// patch view and the review stay consistent with the current working tree.
		const nextRequestVersion = requestVersion + 1;
		requestVersion = nextRequestVersion;
		diffAnalysisError = null;
		diffAnalysis = null;
		void reloadDiffPanel(
			project.id,
			thread?.id ?? null,
			hideWhitespace,
			nextRequestVersion,
			scopeKey,
			true
		);
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
	onRefreshAnalysis={handleRefreshReview}
	onReviewModeChange={handleReviewModeChange}
	onToggleCollapse={handleToggleCollapsed}
	onToggleViewed={handleToggleViewed}
	onToggleWhitespace={handleToggleWhitespace}
	{project}
	{reviewMode}
	{viewedFileIds}
/>
