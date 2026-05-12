<script lang="ts">
	import type { DirectoryEntry } from './file-explorer-api';
	import { readDirectory } from './file-explorer-api';
	import FileTreeNode from './FileTreeNode.svelte';

	type Props = {
		onBackgroundContextMenu: (x: number, y: number) => void;
		onContextMenu: (entry: DirectoryEntry, x: number, y: number) => void;
		onSelect: (entry: DirectoryEntry) => void;
		projectPath: string;
		refreshSignal: number;
		selectedPath: string | null;
	};

	let {
		onBackgroundContextMenu,
		onContextMenu,
		onSelect,
		projectPath,
		refreshSignal,
		selectedPath
	}: Props = $props();

	let entries = $state<DirectoryEntry[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastLoadedPath = $state('');

	$effect(() => {
		// Load on initial mount or when projectPath changes
		if (projectPath && projectPath !== lastLoadedPath) {
			loadRoot(projectPath);
		}
	});

	$effect(() => {
		// Refresh when signal changes (access refreshSignal to track it)
		const _signal = refreshSignal;
		if (_signal > 0 && projectPath) {
			void refreshEntries();
		}
	});

	async function loadRoot(path: string) {
		loading = true;
		error = null;
		lastLoadedPath = path;
		try {
			entries = await readDirectory(path);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			entries = [];
		} finally {
			loading = false;
		}
	}

	async function refreshEntries() {
		if (!projectPath) return;
		try {
			entries = await readDirectory(projectPath);
		} catch {
			// keep existing
		}
	}

	function handleBackgroundContext(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			event.preventDefault();
			event.stopPropagation();
			onBackgroundContextMenu(event.clientX, event.clientY);
		}
	}
</script>

<div
	class="file-tree"
	role="tree"
	tabindex="-1"
	aria-label="Project files"
	oncontextmenu={handleBackgroundContext}
>
	{#if loading}
		<div class="file-tree__status">Loading…</div>
	{:else if error}
		<div class="file-tree__status file-tree__status--error">{error}</div>
	{:else if entries.length === 0}
		<div class="file-tree__status">Empty directory</div>
	{:else}
		{#each entries as entry (entry.path)}
			<FileTreeNode depth={0} {entry} {onContextMenu} {onSelect} {refreshSignal} {selectedPath} />
		{/each}
	{/if}
</div>
