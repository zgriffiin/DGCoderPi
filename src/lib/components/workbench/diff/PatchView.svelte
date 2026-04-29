<script lang="ts">
	import { tick } from 'svelte';
	import { Button, Tag } from 'carbon-components-svelte';
	import DiffFileList from './DiffFileList.svelte';
	import DiffHunk from './DiffHunk.svelte';
	import type { ProjectDiffFile, ProjectDiffSnapshot } from '$lib/types/workbench';

	type Props = {
		collapsedFileIds: string[];
		diff: ProjectDiffSnapshot;
		hideWhitespace: boolean;
		jumpTargetHunkId: string | null;
		onJumpHandled: () => void;
		onSelectFile: (fileId: string) => void;
		onToggleCollapse: (fileId: string) => void;
		onToggleViewed: (fileId: string) => void;
		onToggleWhitespace: () => void;
		selectedFileId: string | null;
		viewedFileIds: string[];
	};

	let {
		collapsedFileIds,
		diff,
		hideWhitespace,
		jumpTargetHunkId,
		onJumpHandled,
		onSelectFile,
		onToggleCollapse,
		onToggleViewed,
		onToggleWhitespace,
		selectedFileId,
		viewedFileIds
	}: Props = $props();

	let keyboardTargetId = $state<string | null>(null);

	const flattenedTargets = $derived.by(() => {
		const targets: string[] = [];
		for (const file of diff.files) {
			targets.push(fileTargetId(file.id));
			if (collapsedFileIds.includes(file.id)) {
				continue;
			}
			for (const hunk of file.hunks) {
				targets.push(hunkTargetId(hunk.id));
			}
		}
		return targets;
	});

	$effect(() => {
		if (!selectedFileId) {
			return;
		}
		keyboardTargetId = fileTargetId(selectedFileId);
	});

	$effect(() => {
		if (!jumpTargetHunkId) {
			return;
		}
		keyboardTargetId = hunkTargetId(jumpTargetHunkId);
		void scrollToAnchor(hunkAnchorId(jumpTargetHunkId)).then(() => {
			onJumpHandled();
		});
	});

	function isCollapsed(fileId: string) {
		return collapsedFileIds.includes(fileId);
	}

	function hunkAnchorId(hunkId: string) {
		return `diff-hunk-${encodeURIComponent(hunkId)}`;
	}

	function fileAnchorId(fileId: string) {
		return `diff-file-${encodeURIComponent(fileId)}`;
	}

	function hunkTargetId(hunkId: string) {
		return `hunk:${hunkId}`;
	}

	function fileTargetId(fileId: string) {
		return `file:${fileId}`;
	}

	async function scrollToAnchor(anchorId: string) {
		await tick();
		document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function handleFileSelect(fileId: string) {
		onSelectFile(fileId);
		keyboardTargetId = fileTargetId(fileId);
		void scrollToAnchor(fileAnchorId(fileId));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!['ArrowDown', 'ArrowUp', 'j', 'k'].includes(event.key)) {
			return;
		}
		event.preventDefault();
		if (flattenedTargets.length === 0) {
			return;
		}

		const currentIndex = keyboardTargetId
			? flattenedTargets.indexOf(keyboardTargetId)
			: Math.max(0, flattenedTargets.indexOf(selectedFileId ? fileTargetId(selectedFileId) : ''));
		const nextIndex =
			event.key === 'ArrowUp' || event.key === 'k'
				? Math.max(0, currentIndex - 1)
				: Math.min(flattenedTargets.length - 1, currentIndex + 1);
		const nextTarget = flattenedTargets[Math.max(0, nextIndex)];
		keyboardTargetId = nextTarget;
		if (nextTarget.startsWith('file:')) {
			const fileId = nextTarget.slice('file:'.length);
			onSelectFile(fileId);
			void scrollToAnchor(fileAnchorId(fileId));
			return;
		}
		const hunkId = nextTarget.slice('hunk:'.length);
		void scrollToAnchor(hunkAnchorId(hunkId));
	}

	function viewedCount() {
		return diff.files.filter((file) => viewedFileIds.includes(file.id)).length;
	}

	function fileTagType(file: ProjectDiffFile) {
		if (file.isBinary) {
			return 'purple';
		}
		if (file.isTooLarge) {
			return 'warm-gray';
		}
		if (file.isGenerated) {
			return 'cool-gray';
		}
		return 'outline';
	}
</script>

<div class="patch-view">
	<div class="patch-view__toolbar">
		<div class="patch-view__summary">
			<p>{viewedCount()} of {diff.files.length} viewed</p>
			<span>{diff.stats.additions} additions, {diff.stats.deletions} deletions</span>
		</div>
		<Button kind="ghost" size="small" onclick={onToggleWhitespace}>
			{hideWhitespace ? 'Show whitespace' : 'Hide whitespace'}
		</Button>
	</div>

	<DiffFileList
		files={diff.files}
		onSelectFile={handleFileSelect}
		{onToggleViewed}
		{selectedFileId}
		{viewedFileIds}
	/>

	<div
		aria-label="Patch review"
		class="patch-view__body"
		role="listbox"
		tabindex="0"
		onkeydown={handleKeydown}
	>
		{#each diff.files as file (file.id)}
			<section
				id={fileAnchorId(file.id)}
				class="patch-file"
				data-selected={selectedFileId === file.id ? 'true' : undefined}
			>
				<header class="patch-file__header">
					<div class="patch-file__title">
						<h3>{file.path}</h3>
						<div class="patch-file__tags">
							<Tag type="outline">{file.status}</Tag>
							{#if file.originalPath}
								<Tag type="cool-gray">from {file.originalPath}</Tag>
							{/if}
							{#if file.isBinary}
								<Tag type={fileTagType(file)}>binary</Tag>
							{/if}
							{#if file.isGenerated}
								<Tag type={fileTagType(file)}>generated</Tag>
							{/if}
							{#if file.isTooLarge}
								<Tag type={fileTagType(file)}>too large</Tag>
							{/if}
						</div>
					</div>
					<div class="patch-file__actions">
						<span>+{file.additions} / -{file.deletions}</span>
						<button type="button" class="diff-link-button" onclick={() => onToggleViewed(file.id)}>
							{viewedFileIds.includes(file.id) ? 'Viewed' : 'Mark viewed'}
						</button>
						<button
							type="button"
							class="diff-link-button"
							onclick={() => onToggleCollapse(file.id)}
						>
							{isCollapsed(file.id) ? 'Expand' : 'Collapse'}
						</button>
					</div>
				</header>

				{#if isCollapsed(file.id)}
					<div class="patch-file__empty">
						<p>File diff collapsed.</p>
					</div>
				{:else if file.isBinary}
					<div class="patch-file__empty">
						<p>Binary diff preview is unavailable.</p>
					</div>
				{:else if file.isTooLarge}
					<div class="patch-file__empty">
						<p>Patch is too large to render in the inspector.</p>
					</div>
				{:else if file.hunks.length === 0}
					<div class="patch-file__empty">
						<p>No exact patch lines are available for this file.</p>
					</div>
				{:else}
					<div class="patch-file__hunks">
						{#each file.hunks as hunk (hunk.id)}
							<DiffHunk
								anchorId={hunkAnchorId(hunk.id)}
								{hunk}
								isSelected={keyboardTargetId === hunkTargetId(hunk.id)}
							/>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	</div>
</div>
