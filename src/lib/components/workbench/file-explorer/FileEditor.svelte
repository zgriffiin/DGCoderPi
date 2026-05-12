<script lang="ts">
	import { Button, Tag } from 'carbon-components-svelte';
	import Save from 'carbon-icons-svelte/lib/Save.svelte';
	import { readFileContent, writeFileContent, relativePath, fileName } from './file-explorer-api';

	type Props = {
		filePath: string;
		projectRoot: string;
	};

	let { filePath, projectRoot }: Props = $props();

	let content = $state('');
	let originalContent = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let saveSuccess = $state(false);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let gutterEl = $state<HTMLDivElement | null>(null);
	let editorBodyEl = $state<HTMLDivElement | null>(null);
	let contextMenu = $state<{ x: number; y: number } | null>(null);

	const isDirty = $derived(content !== originalContent);
	const relPath = $derived(relativePath(filePath, projectRoot));
	const name = $derived(fileName(filePath));
	const lineCount = $derived(content.split('\n').length);
	const hasSelection = $derived(
		textareaEl ? textareaEl.selectionStart !== textareaEl.selectionEnd : false
	);

	$effect(() => {
		if (filePath) {
			loadFile(filePath);
		}
	});

	$effect(() => {
		if (!contextMenu) return;
		function handleClickOutside() {
			contextMenu = null;
		}
		window.addEventListener('pointerdown', handleClickOutside);
		return () => window.removeEventListener('pointerdown', handleClickOutside);
	});

	$effect(() => {
		const el = editorBodyEl;
		if (!el) return;
		function onContext(event: MouseEvent) {
			event.preventDefault();
			event.stopPropagation();
			contextMenu = { x: event.clientX, y: event.clientY };
		}
		el.addEventListener('contextmenu', onContext);
		return () => el.removeEventListener('contextmenu', onContext);
	});

	async function loadFile(path: string) {
		loading = true;
		error = null;
		saveSuccess = false;
		try {
			const text = await readFileContent(path);
			content = text;
			originalContent = text;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			content = '';
			originalContent = '';
		} finally {
			loading = false;
		}
	}

	async function handleSave() {
		saving = true;
		error = null;
		saveSuccess = false;
		try {
			await writeFileContent(filePath, content);
			originalContent = content;
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 2000);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}

	function closeMenu() {
		contextMenu = null;
	}

	async function menuCopy() {
		if (!textareaEl) return;
		const selected = content.slice(textareaEl.selectionStart, textareaEl.selectionEnd);
		if (selected) {
			await navigator.clipboard.writeText(selected);
		}
		closeMenu();
	}

	async function menuCut() {
		if (!textareaEl) return;
		const start = textareaEl.selectionStart;
		const end = textareaEl.selectionEnd;
		const selected = content.slice(start, end);
		if (selected) {
			await navigator.clipboard.writeText(selected);
			content = content.slice(0, start) + content.slice(end);
			await Promise.resolve();
			textareaEl.selectionStart = start;
			textareaEl.selectionEnd = start;
		}
		closeMenu();
	}

	async function menuPaste() {
		if (!textareaEl) return;
		try {
			const text = await navigator.clipboard.readText();
			const start = textareaEl.selectionStart;
			const end = textareaEl.selectionEnd;
			content = content.slice(0, start) + text + content.slice(end);
			await Promise.resolve();
			const newPos = start + text.length;
			textareaEl.selectionStart = newPos;
			textareaEl.selectionEnd = newPos;
			textareaEl.focus();
		} catch {
			// clipboard read denied
		}
		closeMenu();
	}

	function menuSelectAll() {
		if (!textareaEl) return;
		textareaEl.select();
		textareaEl.focus();
		closeMenu();
	}

	function menuSave() {
		if (isDirty) {
			handleSave();
		}
		closeMenu();
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			if (isDirty) {
				handleSave();
			}
		}
	}

	function handleScroll() {
		if (textareaEl && gutterEl) {
			gutterEl.scrollTop = textareaEl.scrollTop;
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="file-editor" onkeydown={handleKeydown}>
	<header class="file-editor__header">
		<div class="file-editor__title">
			<h3>{name}</h3>
			<span class="file-editor__path" title={filePath}>{relPath}</span>
			{#if isDirty}
				<Tag size="sm" type="high-contrast">Modified</Tag>
			{/if}
			{#if saveSuccess}
				<Tag size="sm" type="green">Saved</Tag>
			{/if}
		</div>
		<div class="file-editor__actions">
			<Button
				disabled={!isDirty || saving}
				icon={Save}
				kind="primary"
				size="small"
				on:click={handleSave}
			>
				{saving ? 'Saving…' : 'Save'}
			</Button>
		</div>
	</header>

	{#if error}
		<div class="file-editor__error">{error}</div>
	{/if}

	{#if loading}
		<div class="file-editor__loading">Loading file…</div>
	{:else}
		<div class="file-editor__body" bind:this={editorBodyEl}>
			<div class="file-editor__gutter" bind:this={gutterEl} aria-hidden="true">
				<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
				{#each Array(lineCount) as _, i (i)}
					<span class="file-editor__line-number">{i + 1}</span>
				{/each}
			</div>
			<textarea
				bind:this={textareaEl}
				class="file-editor__textarea"
				spellcheck="false"
				bind:value={content}
				aria-label={`Edit ${name}`}
				onscroll={handleScroll}
			></textarea>
		</div>
	{/if}

	{#if contextMenu}
		<div
			class="file-editor__context-menu"
			role="menu"
			tabindex="-1"
			style="left: {contextMenu.x}px; top: {contextMenu.y}px"
			onpointerdown={(e) => e.stopPropagation()}
		>
			<button role="menuitem" type="button" disabled={!hasSelection} onclick={menuCut}>
				Cut
				<span class="file-editor__context-menu-shortcut">Ctrl+X</span>
			</button>
			<button role="menuitem" type="button" disabled={!hasSelection} onclick={menuCopy}>
				Copy
				<span class="file-editor__context-menu-shortcut">Ctrl+C</span>
			</button>
			<button role="menuitem" type="button" onclick={menuPaste}>
				Paste
				<span class="file-editor__context-menu-shortcut">Ctrl+V</span>
			</button>
			<hr />
			<button role="menuitem" type="button" onclick={menuSelectAll}>
				Select all
				<span class="file-editor__context-menu-shortcut">Ctrl+A</span>
			</button>
			<hr />
			<button role="menuitem" type="button" disabled={!isDirty} onclick={menuSave}>
				Save
				<span class="file-editor__context-menu-shortcut">Ctrl+S</span>
			</button>
		</div>
	{/if}
</div>
