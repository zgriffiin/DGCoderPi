<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Button } from 'carbon-components-svelte';
	import Close from 'carbon-icons-svelte/lib/Close.svelte';
	import type { DirectoryEntry } from './file-explorer-api';
	import {
		copyEntry,
		createDirectory,
		deleteEntry,
		readFileContent,
		relativePath,
		renameEntry,
		writeFileContent,
		fileName,
		parentPath,
		joinPath
	} from './file-explorer-api';
	import FileEditor from './FileEditor.svelte';
	import FileTree from './FileTree.svelte';

	type Props = {
		onClose: () => void;
		projectPath: string;
	};

	type TreeMenuState =
		| { kind: 'entry'; entry: DirectoryEntry; x: number; y: number }
		| { kind: 'background'; x: number; y: number };

	let { onClose, projectPath }: Props = $props();

	let selectedEntry = $state<DirectoryEntry | null>(null);
	let treeMenu = $state<TreeMenuState | null>(null);
	let clipboard = $state<{ entry: DirectoryEntry; mode: 'copy' | 'cut' } | null>(null);
	let renaming = $state<{ entry: DirectoryEntry; value: string } | null>(null);
	let newItemPrompt = $state<{ kind: 'file' | 'folder'; dir: string; value: string } | null>(null);
	let renameInput = $state<HTMLInputElement | null>(null);
	let newItemInput = $state<HTMLInputElement | null>(null);
	let refreshToken = $state(0);

	function triggerRefresh() {
		refreshToken++;
	}

	function handleSelect(entry: DirectoryEntry) {
		if (!entry.isDirectory) {
			selectedEntry = entry;
		}
	}

	function handleTreeContextMenu(entry: DirectoryEntry, x: number, y: number) {
		treeMenu = { kind: 'entry', entry, x, y };
	}

	function handleBackgroundContextMenu(x: number, y: number) {
		treeMenu = { kind: 'background', x, y };
	}

	function closeTreeMenu() {
		treeMenu = null;
	}

	// --- Resolve target directory for an action ---
	function menuTargetDir(): string {
		if (!treeMenu) return projectPath;
		if (treeMenu.kind === 'background') return projectPath;
		return treeMenu.entry.isDirectory ? treeMenu.entry.path : parentPath(treeMenu.entry.path);
	}

	// --- Tree context menu actions ---

	function treeMenuOpen() {
		if (!treeMenu || treeMenu.kind !== 'entry' || treeMenu.entry.isDirectory) return;
		selectedEntry = treeMenu.entry;
		closeTreeMenu();
	}

	function treeMenuCut() {
		if (!treeMenu || treeMenu.kind !== 'entry') return;
		clipboard = { entry: treeMenu.entry, mode: 'cut' };
		closeTreeMenu();
	}

	function treeMenuCopy() {
		if (!treeMenu || treeMenu.kind !== 'entry') return;
		clipboard = { entry: treeMenu.entry, mode: 'copy' };
		closeTreeMenu();
	}

	async function treeMenuPaste() {
		if (!clipboard) return;
		const targetDir = menuTargetDir();
		const sourceName = fileName(clipboard.entry.path);
		let destName = sourceName;

		// If pasting in the same directory, generate a "Copy of" name
		const sourceDir = parentPath(clipboard.entry.path);
		if (
			targetDir.replace(/\\/g, '/') === sourceDir.replace(/\\/g, '/') &&
			clipboard.mode === 'copy'
		) {
			const ext = sourceName.includes('.') ? '.' + sourceName.split('.').pop() : '';
			const base = ext ? sourceName.slice(0, -ext.length) : sourceName;
			destName = `${base} - Copy${ext}`;
		}

		const destination = joinPath(targetDir, destName);

		try {
			if (clipboard.mode === 'copy') {
				await copyEntry(clipboard.entry.path, destination);
			} else {
				await renameEntry(clipboard.entry.path, destination);
				clipboard = null;
			}
			triggerRefresh();
		} catch {
			// ignore
		}
		closeTreeMenu();
	}

	async function treeMenuRename() {
		if (!treeMenu || treeMenu.kind !== 'entry') return;
		renaming = { entry: treeMenu.entry, value: fileName(treeMenu.entry.path) };
		closeTreeMenu();
		await tick();
		renameInput?.focus();
		renameInput?.select();
	}

	async function commitRename() {
		if (!renaming) return;
		const newName = renaming.value.trim();
		if (!newName || newName === fileName(renaming.entry.path)) {
			renaming = null;
			return;
		}
		const dir = parentPath(renaming.entry.path);
		const destination = joinPath(dir, newName);
		try {
			await renameEntry(renaming.entry.path, destination);
			if (selectedEntry?.path === renaming.entry.path) {
				selectedEntry = { ...selectedEntry, path: destination, name: newName };
			}
			triggerRefresh();
		} catch {
			// ignore
		}
		renaming = null;
	}

	function cancelRename() {
		renaming = null;
	}

	async function treeMenuDelete() {
		if (!treeMenu || treeMenu.kind !== 'entry') return;
		const entry = treeMenu.entry;
		closeTreeMenu();
		const confirmed = window.confirm(`Delete "${fileName(entry.path)}"? This cannot be undone.`);
		if (!confirmed) return;
		try {
			await deleteEntry(entry.path);
			if (selectedEntry?.path === entry.path) {
				selectedEntry = null;
			}
			triggerRefresh();
		} catch {
			// ignore
		}
	}

	async function treeMenuNewFile() {
		const dir = menuTargetDir();
		closeTreeMenu();
		newItemPrompt = { kind: 'file', dir, value: '' };
		await tick();
		newItemInput?.focus();
	}

	async function treeMenuNewFolder() {
		const dir = menuTargetDir();
		closeTreeMenu();
		newItemPrompt = { kind: 'folder', dir, value: '' };
		await tick();
		newItemInput?.focus();
	}

	async function commitNewItem() {
		if (!newItemPrompt) return;
		const name = newItemPrompt.value.trim();
		if (!name) {
			newItemPrompt = null;
			return;
		}
		const fullPath = joinPath(newItemPrompt.dir, name);
		try {
			if (newItemPrompt.kind === 'folder') {
				await createDirectory(fullPath);
			} else {
				await writeFileContent(fullPath, '');
			}
			triggerRefresh();
		} catch {
			// ignore
		}
		newItemPrompt = null;
	}

	function cancelNewItem() {
		newItemPrompt = null;
	}

	function handleNewItemKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitNewItem();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			cancelNewItem();
		}
	}

	async function treeMenuCopyPath() {
		if (!treeMenu || treeMenu.kind !== 'entry') return;
		await navigator.clipboard.writeText(treeMenu.entry.path);
		closeTreeMenu();
	}

	async function treeMenuCopyRelativePath() {
		if (!treeMenu || treeMenu.kind !== 'entry') return;
		const rel = relativePath(treeMenu.entry.path, projectPath);
		await navigator.clipboard.writeText(rel);
		closeTreeMenu();
	}

	async function treeMenuCopyFileContent() {
		if (!treeMenu || treeMenu.kind !== 'entry' || treeMenu.entry.isDirectory) return;
		try {
			const text = await readFileContent(treeMenu.entry.path);
			await navigator.clipboard.writeText(text);
		} catch {
			// ignore
		}
		closeTreeMenu();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (treeMenu) {
				closeTreeMenu();
				event.preventDefault();
				return;
			}
			if (renaming) {
				cancelRename();
				event.preventDefault();
				return;
			}
			if (newItemPrompt) {
				cancelNewItem();
				event.preventDefault();
				return;
			}
			event.preventDefault();
			onClose();
		}
	}

	function handleRenameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitRename();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			cancelRename();
		}
	}

	onMount(() => {
		function suppressNativeMenu(event: Event) {
			event.preventDefault();
		}
		document.addEventListener('contextmenu', suppressNativeMenu, true);
		return () => {
			document.removeEventListener('contextmenu', suppressNativeMenu, true);
		};
	});

	$effect(() => {
		if (!treeMenu) return;
		function handleClickOutside() {
			treeMenu = null;
		}
		window.addEventListener('pointerdown', handleClickOutside);
		return () => window.removeEventListener('pointerdown', handleClickOutside);
	});
</script>

<div
	class="file-explorer-overlay"
	role="dialog"
	aria-label="File explorer"
	tabindex="-1"
	onkeydown={handleKeydown}
>
	<header class="file-explorer-overlay__header">
		<h2>File Explorer</h2>
		{#if clipboard}
			<span class="file-explorer-overlay__clipboard-hint">
				{clipboard.mode === 'cut' ? 'Cut' : 'Copied'}: {fileName(clipboard.entry.path)}
			</span>
		{/if}
		<Button icon={Close} iconDescription="Close" kind="ghost" size="small" on:click={onClose} />
	</header>

	<div class="file-explorer-overlay__body">
		<aside class="file-explorer-overlay__tree">
			<FileTree
				onBackgroundContextMenu={handleBackgroundContextMenu}
				onContextMenu={handleTreeContextMenu}
				onSelect={handleSelect}
				{projectPath}
				refreshSignal={refreshToken}
				selectedPath={selectedEntry?.path ?? null}
			/>
		</aside>

		<main class="file-explorer-overlay__editor">
			{#if selectedEntry}
				<FileEditor filePath={selectedEntry.path} projectRoot={projectPath} />
			{:else}
				<div class="file-explorer-overlay__placeholder">
					<p>Select a file from the tree to view or edit it.</p>
					<p>Right-click any file or folder for actions.</p>
				</div>
			{/if}
		</main>
	</div>

	{#if renaming}
		<div class="file-explorer-rename-overlay">
			<div class="file-explorer-rename-dialog">
				<label for="rename-input">Rename to:</label>
				<input
					bind:this={renameInput}
					id="rename-input"
					type="text"
					bind:value={renaming.value}
					onkeydown={handleRenameKeydown}
					onblur={commitRename}
				/>
			</div>
		</div>
	{/if}

	{#if newItemPrompt}
		<div class="file-explorer-rename-overlay">
			<div class="file-explorer-rename-dialog">
				<label for="new-item-input">
					{newItemPrompt.kind === 'folder' ? 'New folder name:' : 'New file name:'}
				</label>
				<input
					bind:this={newItemInput}
					id="new-item-input"
					type="text"
					bind:value={newItemPrompt.value}
					onkeydown={handleNewItemKeydown}
					onblur={commitNewItem}
				/>
			</div>
		</div>
	{/if}

	{#if treeMenu}
		<div
			class="file-editor__context-menu"
			role="menu"
			tabindex="-1"
			style="left: {treeMenu.x}px; top: {treeMenu.y}px"
			onpointerdown={(e) => e.stopPropagation()}
		>
			{#if treeMenu.kind === 'entry' && !treeMenu.entry.isDirectory}
				<button role="menuitem" type="button" onclick={treeMenuOpen}> Open </button>
				<hr />
			{/if}
			{#if treeMenu.kind === 'entry'}
				<button role="menuitem" type="button" onclick={treeMenuCut}> Cut </button>
				<button role="menuitem" type="button" onclick={treeMenuCopy}> Copy </button>
			{/if}
			<button role="menuitem" type="button" disabled={!clipboard} onclick={treeMenuPaste}>
				Paste
			</button>
			<hr />
			<button role="menuitem" type="button" onclick={treeMenuNewFile}> New file </button>
			<button role="menuitem" type="button" onclick={treeMenuNewFolder}> New folder </button>
			{#if treeMenu.kind === 'entry'}
				<hr />
				<button role="menuitem" type="button" onclick={treeMenuRename}> Rename </button>
				<button role="menuitem" type="button" onclick={treeMenuDelete}> Delete </button>
				<hr />
				<button role="menuitem" type="button" onclick={treeMenuCopyRelativePath}>
					Copy relative path
				</button>
				<button role="menuitem" type="button" onclick={treeMenuCopyPath}> Copy full path </button>
				{#if !treeMenu.entry.isDirectory}
					<button role="menuitem" type="button" onclick={treeMenuCopyFileContent}>
						Copy file contents
					</button>
				{/if}
			{/if}
		</div>
	{/if}
</div>
