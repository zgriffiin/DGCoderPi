<script lang="ts">
	import DOMPurify from 'isomorphic-dompurify';
	import { marked } from 'marked';
	import { SvelteSet } from 'svelte/reactivity';
	import ChevronDown from 'carbon-icons-svelte/lib/ChevronDown.svelte';
	import ChevronUp from 'carbon-icons-svelte/lib/ChevronUp.svelte';
	import type { MessageRecord } from '$lib/types/workbench';
	import { renderMarkdown } from './markdown-render';

	/** Collapsed height threshold in pixels. Content taller than this gets a toggle. */
	const COLLAPSE_HEIGHT_PX = 120;

	/**
	 * Track messages the user has explicitly expanded.
	 * Survives component remounts during the session.
	 */
	const userExpandedIds = new SvelteSet<string>();

	function formatTimestamp(timestampMs: number) {
		return new Intl.DateTimeFormat(undefined, {
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			month: 'short'
		}).format(timestampMs);
	}

	/** Tool messages and tool-call-style assistant messages default collapsed when tall. */
	function shouldDefaultCollapsed(msg: MessageRecord): boolean {
		return isToolCallMessage(msg);
	}

	let { message }: { message: MessageRecord } = $props();
	const renderedBody = $derived(
		message.role === 'assistant' ? renderMarkdown(message.text, marked, DOMPurify) : null
	);
	const toolText = $derived(formatToolText(message));

	const collapsible = $derived(shouldDefaultCollapsed(message));
	const collapsed = $derived.by(() => {
		if (userExpandedIds.has(message.id)) return false;
		return collapsible;
	});
	let bodyElement: HTMLElement | null = $state(null);
	let overflows = $state(false);

	$effect(() => {
		const el = bodyElement;
		if (!el || !collapsible) {
			overflows = false;
			return;
		}

		// Measure after layout settles; re-measure on resize.
		const measure = () => {
			overflows = el.scrollHeight > COLLAPSE_HEIGHT_PX;
		};
		measure();

		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	});

	function toggleCollapsed() {
		if (collapsed) {
			userExpandedIds.add(message.id);
		} else {
			userExpandedIds.delete(message.id);
		}
	}

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
		<div
			bind:this={bodyElement}
			class="message-row__collapsible"
			class:message-row__collapsible--collapsed={collapsible && overflows && collapsed}
		>
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
		</div>
		{#if collapsible && overflows}
			<button
				class="message-row__collapse-toggle"
				type="button"
				aria-expanded={!collapsed}
				aria-label={collapsed ? 'Expand message' : 'Collapse message'}
				onclick={toggleCollapsed}
			>
				{#if collapsed}
					<ChevronDown size={14} />
					<span>Show more</span>
				{:else}
					<ChevronUp size={14} />
					<span>Show less</span>
				{/if}
			</button>
		{/if}
		{#if message.status !== 'ready'}
			<p class="message-row__state">{message.status}</p>
		{/if}
		<p class="message-row__meta">{formatTimestamp(message.timestampMs)}</p>
	</div>
</article>
