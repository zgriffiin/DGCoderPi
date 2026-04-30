<script lang="ts">
	import { Tag } from 'carbon-components-svelte';
	import Close from 'carbon-icons-svelte/lib/Close.svelte';
	import AiReviewPanel from './AiReviewPanel.svelte';
	import DiffModeToggle from './DiffModeToggle.svelte';
	import PatchView from './PatchView.svelte';
	import type { DiffAnalysis, ProjectDiffSnapshot, ProjectRecord } from '$lib/types/workbench';

	type DiffReviewMode = 'ai-review' | 'patch-view';

	type Props = {
		analysis: DiffAnalysis | null;
		analysisRequestError: string | null;
		collapsedFileIds: string[];
		diff: ProjectDiffSnapshot | null;
		diffError: string | null;
		diffLoading: boolean;
		hideWhitespace: boolean;
		onClose: () => void;
		onRefreshAnalysis: () => void;
		onReviewModeChange: (mode: DiffReviewMode) => void;
		onToggleCollapse: (fileId: string) => void;
		onToggleViewed: (fileId: string) => void;
		onToggleWhitespace: () => void;
		project: ProjectRecord | null;
		reviewMode: DiffReviewMode;
		viewedFileIds: string[];
	};

	let {
		analysis,
		analysisRequestError,
		collapsedFileIds,
		diff,
		diffError,
		diffLoading,
		hideWhitespace,
		onClose,
		onRefreshAnalysis,
		onReviewModeChange,
		onToggleCollapse,
		onToggleViewed,
		onToggleWhitespace,
		project,
		reviewMode,
		viewedFileIds
	}: Props = $props();

	let jumpTargetHunkId = $state<string | null>(null);
	let selectedFileId = $state<string | null>(null);

	$effect(() => {
		if (!diff?.files.length) {
			selectedFileId = null;
			return;
		}
		if (selectedFileId && diff.files.some((file) => file.id === selectedFileId)) {
			return;
		}
		selectedFileId = diff.files[0]?.id ?? null;
	});

	function handleJumpToHunk(hunkId: string) {
		jumpTargetHunkId = hunkId;
		onReviewModeChange('patch-view');
	}
</script>

<div class="diff-inspector">
	<div class="diff-inspector__toolbar">
		<div class="diff-inspector__title">
			<p>{project?.name ?? 'Project'}</p>
			<span>
				{#if diff}
					{diff.stats.filesChanged} files, {diff.stats.additions} additions, {diff.stats.deletions}
					deletions
				{:else}
					{diffLoading ? 'Loading diff' : 'No diff loaded'}
				{/if}
			</span>
		</div>
		<Tag type="cool-gray">{diff?.branch ?? project?.branch ?? 'unknown'}</Tag>
		<button
			aria-label="Close diff inspector"
			class="diff-inspector__close"
			type="button"
			onclick={onClose}
		>
			<Close size={16} />
		</button>
		<DiffModeToggle mode={reviewMode} onChange={onReviewModeChange} />
	</div>

	<div class="diff-inspector__body">
		{#if diffLoading}
			<div class="empty-panel">
				<p>Loading diff</p>
			</div>
		{:else if diffError}
			<div class="empty-panel">
				<p>{diffError}</p>
			</div>
		{:else if !diff}
			<div class="empty-panel">
				<p>No diff loaded</p>
			</div>
		{:else if !diff.gitAvailable}
			<div class="empty-panel">
				<p>Git status unavailable</p>
			</div>
		{:else if reviewMode === 'ai-review'}
			<AiReviewPanel
				{analysis}
				{diff}
				onJumpToHunk={handleJumpToHunk}
				onRefresh={onRefreshAnalysis}
				requestError={analysisRequestError}
			/>
		{:else}
			<PatchView
				{collapsedFileIds}
				{diff}
				{hideWhitespace}
				{jumpTargetHunkId}
				onJumpHandled={() => {
					jumpTargetHunkId = null;
				}}
				onSelectFile={(fileId) => {
					selectedFileId = fileId;
				}}
				{onToggleCollapse}
				{onToggleViewed}
				{onToggleWhitespace}
				{selectedFileId}
				{viewedFileIds}
			/>
		{/if}
	</div>
</div>
