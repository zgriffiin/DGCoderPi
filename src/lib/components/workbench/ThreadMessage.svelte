<script module lang="ts">
	const MARKDOWN_CACHE_MAX_ENTRIES = 64;
	const MARKDOWN_CACHE_MAX_CHARS = 250_000;
	const MARKDOWN_CACHE_MAX_MESSAGE_CHARS = 20_000;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const markdownCacheEntries = new Map<string, { html: string; size: number }>();
	let markdownCacheCharCount = 0;

	function cacheMarkdown(value: string, html: string) {
		if (value.length > MARKDOWN_CACHE_MAX_MESSAGE_CHARS) {
			return html;
		}

		const size = value.length + html.length;
		if (size > MARKDOWN_CACHE_MAX_CHARS) {
			return html;
		}

		const existingEntry = markdownCacheEntries.get(value);
		if (existingEntry) {
			markdownCacheEntries.delete(value);
			markdownCacheCharCount -= existingEntry.size;
		}

		markdownCacheEntries.set(value, { html, size });
		markdownCacheCharCount += size;

		while (
			markdownCacheEntries.size > MARKDOWN_CACHE_MAX_ENTRIES ||
			markdownCacheCharCount > MARKDOWN_CACHE_MAX_CHARS
		) {
			const oldestKey = markdownCacheEntries.keys().next().value;
			if (typeof oldestKey !== 'string') {
				break;
			}

			const oldestEntry = markdownCacheEntries.get(oldestKey);
			if (oldestEntry) {
				markdownCacheCharCount -= oldestEntry.size;
			}
			markdownCacheEntries.delete(oldestKey);
		}
		return html;
	}

	export function renderMarkdown(
		value: string,
		marked: typeof import('marked').marked,
		DOMPurify: typeof import('isomorphic-dompurify').default
	) {
		const cached = markdownCacheEntries.get(value);
		if (cached) {
			markdownCacheEntries.delete(value);
			markdownCacheEntries.set(value, cached);
			return cached.html;
		}

		const parsedHtml = marked.parse(value, {
			async: false,
			breaks: true,
			gfm: true
		} as const);

		return cacheMarkdown(value, DOMPurify.sanitize(parsedHtml));
	}
</script>

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

	let { message }: { message: MessageRecord } = $props();
	const renderedBody = $derived(
		message.role === 'assistant' ? renderMarkdown(message.text, marked, DOMPurify) : null
	);
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
