<script lang="ts">
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

	function escapeHtml(value: string) {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	function renderMarkdown(value: string) {
		return marked.parse(escapeHtml(value), {
			async: false,
			breaks: true,
			gfm: true
		});
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
