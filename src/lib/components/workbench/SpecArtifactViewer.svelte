<script lang="ts">
	import DOMPurify from 'isomorphic-dompurify';
	import { marked } from 'marked';
	import { Tag } from 'carbon-components-svelte';
	import type { SpecArtifactDocument } from '$lib/types/workbench';
	import { renderMarkdown } from './markdown-render';

	type Props = {
		artifact: string | null;
		document: SpecArtifactDocument | null;
		error: string | null;
		fallbackText: string | null;
		loading: boolean;
	};

	let { artifact, document, error, fallbackText, loading }: Props = $props();
	const renderedBody = $derived.by(() => {
		const sourceText = document?.text ?? fallbackText;
		return sourceText ? renderMarkdown(sourceText, marked, DOMPurify) : null;
	});
</script>

<section class="spec-artifact-viewer inspector-block" aria-live="polite">
	<div class="inspector-item">
		<div class="inspector-item__header">
			<p>Artifact Viewer</p>
			{#if artifact}
				<Tag size="sm" type="cool-gray">{artifact}</Tag>
			{/if}
		</div>

		{#if loading}
			<p>Loading artifact…</p>
		{:else if error}
			<p>{error}</p>
		{:else if document?.text}
			{#if document.path}
				<p>{document.path}</p>
			{/if}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="spec-artifact-viewer__body message-row__body--markdown">{@html renderedBody}</div>
		{:else if artifact && fallbackText}
			{#if document?.path}
				<p>{document.path}</p>
			{/if}
			<p>Showing the latest stage output from this thread because no workspace file exists yet.</p>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="spec-artifact-viewer__body message-row__body--markdown">{@html renderedBody}</div>
		{:else if artifact && !document?.exists}
			<p>No file found yet for this stage.</p>
			{#if document?.path}
				<p>{document.path}</p>
			{/if}
		{:else}
			<p>Select a spec artifact to view it here.</p>
		{/if}
	</div>
</section>
