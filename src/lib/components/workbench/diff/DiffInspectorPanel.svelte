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
		project: ProjectRecord | null;
		thread: ThreadRecord | null;
	};

	let { controller, project, thread }: Props = $props();

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

	async function loadAnalysis(
		projectId: string,
		threadId: string | null,
		nextHideWhitespace: boolean,
		nextRequestVersion: number
	) {
		try {
			const loaded = await controller.loadDiffAnalysis(projectId, threadId, nextHideWhitespace);
			if (nextRequestVersion !== requestVersion) {
				return;
			}
			diffAnalysis = loaded;
			if (loaded.status === 'pending' || loaded.status === 'failed') {
				const refreshed = await controller.refreshDiffAnalysis(
					projectId,
					threadId,
					nextHideWhitespace
				);
				if (nextRequestVersion !== requestVersion) {
					return;
				}
				diffAnalysis = refreshed;
			}
		} catch (error) {
			if (nextRequestVersion !== requestVersion) {
				return;
			}
			diffAnalysisError = error instanceof Error ? error.message : String(error);
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

		await loadAnalysis(projectId, threadId, nextHideWhitespace, nextRequestVersion);
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

		void reloadDiffPanel(projectId, threadId, nextHideWhitespace, nextRequestVersion, scopeKey);
	});

	$effect(() => {
		if (!project || !thread || thread.status === 'running') {
			return;
		}

		const currentProjectId = project.id;
		const currentThreadId = thread.id;
		const currentHideWhitespace = hideWhitespace;

		const timeout = window.setTimeout(() => {
			void controller
				.refreshDiffAnalysis(currentProjectId, currentThreadId, currentHideWhitespace)
				.then((nextAnalysis) => {
					if (
						project?.id !== currentProjectId ||
						thread?.id !== currentThreadId ||
						hideWhitespace !== currentHideWhitespace
					) {
						return;
					}
					diffAnalysis = nextAnalysis;
				})
				.catch(() => {
					return;
				});
		}, 1200);

		return () => window.clearTimeout(timeout);
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

	async function refreshDiffAnalysisNow() {
		if (!project || !diff) {
			return;
		}
		diffAnalysisError = null;
		try {
			diffAnalysis = await controller.refreshDiffAnalysis(
				project.id,
				thread?.id ?? null,
				hideWhitespace
			);
		} catch (error) {
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
	onRefreshAnalysis={refreshDiffAnalysisNow}
	onReviewModeChange={handleReviewModeChange}
	onToggleCollapse={handleToggleCollapsed}
	onToggleViewed={handleToggleViewed}
	onToggleWhitespace={handleToggleWhitespace}
	{project}
	{reviewMode}
	{viewedFileIds}
/>
