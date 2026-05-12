<script lang="ts">
	import DOMPurify from 'isomorphic-dompurify';
	import { marked } from 'marked';
	import type { MessageRecord } from '$lib/types/workbench';
	import { renderMarkdown } from './markdown-render';

	function formatTimestamp(timestampMs: number) {
		return new Intl.DateTimeFormat(undefined, {
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			month: 'short'
		}).format(timestampMs);
	}

	let { message }: { message: MessageRecord } = $props();
	const renderedBody = $derived(
		message.role === 'assistant' ? renderMarkdown(message.text, marked, DOMPurify) : null
	);
	const toolText = $derived(formatToolText(message));

	function formatToolText(msg: MessageRecord): string {
		const text = msg.text.trim();
		// If the entire message is just bracketed commands, strip them
		const lines = text.split('\n').map((line) => {
			const trimmed = line.trim();
			const match = /^\[(\w+):\s*(.*)\]\s*$/.exec(trimmed);
			if (match) {
				return match[2].replace(/\.{3}$/, '');
			}
			return line;
		});
		return lines.join('\n').trim();
	}

	function isToolCallMessage(msg: MessageRecord): boolean {
		if (msg.role === 'tool') return true;
		const text = msg.text.trim();
		if (!text) return false;
		// Check if every non-empty line is a bracketed command
		const lines = text.split('\n').filter((l) => l.trim().length > 0);
		return lines.length > 0 && lines.every((l) => /^\[(\w+):\s.*\]$/.test(l.trim()));
	}
</script>

<article
	class="message-row"
	data-tone={message.role}
	title={new Date(message.timestampMs).toLocaleString()}
>
	<div class="message-row__bubble">
		{#if message.role === 'assistant' && !isToolCallMessage(message)}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="message-row__body message-row__body--markdown">{@html renderedBody}</div>
		{:else if isToolCallMessage(message)}
			<pre class="message-row__body message-row__body--tool">{toolText}</pre>
		{:else if message.role === 'system'}
			<p class="message-row__body message-row__body--system">{message.text}</p>
		{:else}
			<p class="message-row__body">{message.text}</p>
		{/if}
		{#if message.status !== 'ready'}
			<p class="message-row__state">{message.status}</p>
		{/if}
		<p class="message-row__meta">{formatTimestamp(message.timestampMs)}</p>
	</div>
</article>
