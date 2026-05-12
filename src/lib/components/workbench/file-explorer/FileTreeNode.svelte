<script lang="ts">
	import CaretDown from 'carbon-icons-svelte/lib/CaretDown.svelte';
	import CaretRight from 'carbon-icons-svelte/lib/CaretRight.svelte';
	import Document from 'carbon-icons-svelte/lib/Document.svelte';
	import Folder from 'carbon-icons-svelte/lib/Folder.svelte';
	import type { DirectoryEntry } from './file-explorer-api';
	import { readDirectory } from './file-explorer-api';
	import FileTreeNode from './FileTreeNode.svelte';

	type Props = {
		depth: number;
		entry: DirectoryEntry;
		onContextMenu: (entry: DirectoryEntry, x: number, y: number) => void;
		onSelect: (entry: DirectoryEntry) => void;
		refreshSignal: number;
		selectedPath: string | null;
	};

	let { depth, entry, onContextMenu, onSelect, refreshSignal, selectedPath }: Props = $props();

	let expanded = $state(false);
	let children = $state<DirectoryEntry[]>([]);
	let loading = $state(false);
	let loaded = $state(false);

	// Watch refreshSignal — if this folder is expanded, re-read its children
	$effect(() => {
		const _signal = refreshSignal;
		if (_signal > 0 && loaded && expanded && entry.isDirectory) {
			void refreshChildren();
		}
	});

	async function refreshChildren() {
		try {
			children = await readDirectory(entry.path);
		} catch {
			// keep existing
		}
	}

	async function toggle() {
		if (!entry.isDirectory) {
			onSelect(entry);
			return;
		}

		if (!loaded) {
			loading = true;
			try {
				children = await readDirectory(entry.path);
				loaded = true;
			} catch {
				children = [];
			} finally {
				loading = false;
			}
		}
		expanded = !expanded;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggle();
		}
		if (event.key === 'ArrowRight' && entry.isDirectory && !expanded) {
			event.preventDefault();
			toggle();
		}
		if (event.key === 'ArrowLeft' && entry.isDirectory && expanded) {
			event.preventDefault();
			expanded = false;
		}
	}

	function handleRightClick(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		onContextMenu(entry, event.clientX, event.clientY);
	}

	const isSelected = $derived(selectedPath === entry.path);
</script>

<div
	class="file-tree-node"
	class:file-tree-node--selected={isSelected}
	class:file-tree-node--directory={entry.isDirectory}
	role="treeitem"
	aria-expanded={entry.isDirectory ? expanded : undefined}
	aria-selected={isSelected}
	tabindex="0"
	style="padding-left: {depth * 1}rem"
	onclick={toggle}
	onkeydown={handleKeydown}
	oncontextmenu={handleRightClick}
>
	<span class="file-tree-node__icon">
		{#if entry.isDirectory}
			{#if expanded}
				<CaretDown size={14} />
			{:else}
				<CaretRight size={14} />
			{/if}
		{:else}
			<Document size={14} />
		{/if}
	</span>
	<span class="file-tree-node__icon file-tree-node__type-icon">
		{#if entry.isDirectory}
			<Folder size={14} />
		{/if}
	</span>
	<span class="file-tree-node__name">{entry.name}</span>
	{#if loading}
		<span class="file-tree-node__loading">…</span>
	{/if}
</div>

{#if entry.isDirectory && expanded && children.length > 0}
	<div role="group">
		{#each children as child (child.path)}
			<FileTreeNode
				depth={depth + 1}
				entry={child}
				{onContextMenu}
				{onSelect}
				{refreshSignal}
				{selectedPath}
			/>
		{/each}
	</div>
{/if}
