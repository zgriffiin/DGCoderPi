<script lang="ts">
	import DOMPurify from 'isomorphic-dompurify';
	import { marked } from 'marked';
	import type { MessageRecord } from '$lib/types/workbench';

	function formatTimestamp(timestampMs: number) {
		return new Intl.DateTimeFormat(undefined, {
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			month: 'short'
		}).format(timestampMs);
	}

	function renderMarkdown(value: string) {
		const parsedHtml = marked.parse(value, {
			async: false,
			breaks: true,
			gfm: true
		});

		return DOMPurify.sanitize(parsedHtml);
	}

	let { message }: { message: MessageRecord } = $props();
	const renderedBody = $derived(message.role === 'assistant' ? renderMarkdown(message.text) : null);
</script>

<article
	class="message-row"
	data-tone={message.role}
	title={new Date(message.timestampMs).toLocaleString()}
>
	<div class="message-row__bubble">
		{#if message.role === 'assistant'}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="message-row__body message-row__body--markdown">{@html renderedBody}</div>
		{:else}
			<p class="message-row__body">{message.text}</p>
		{/if}
		{#if message.status !== 'ready'}
			<p class="message-row__state">{message.status}</p>
		{/if}
		<p class="message-row__meta">{formatTimestamp(message.timestampMs)}</p>
	</div>
</article>
