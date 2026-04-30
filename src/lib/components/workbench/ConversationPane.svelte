<script lang="ts">
	import { onDestroy } from 'svelte';
	import { tick } from 'svelte';
	import { InlineNotification } from 'carbon-components-svelte';
	import type { ProjectRecord, ThreadRecord } from '$lib/types/workbench';
	import ThreadMessage from './ThreadMessage.svelte';

	type Props = {
		project: ProjectRecord | null;
		runtimeError: string | null;
		thread: ThreadRecord | null;
	};

	const MESSAGE_PAGE_SIZE = 40;

	function visibleMessages(thread: ThreadRecord | null) {
		if (!thread) {
			return [];
		}

		return thread.messages.filter(
			(message) => message.role === 'assistant' || message.role === 'user'
		);
	}

	function threadLabel(project: ProjectRecord | null, thread: ThreadRecord | null) {
		if (!thread) {
			return 'No thread selected';
		}

		if (!project) {
			return thread.title;
		}

		return `${project.name} - ${thread.title}`;
	}

	function formatElapsed(totalSeconds: number) {
		if (totalSeconds < 60) {
			return `${totalSeconds}s`;
		}

		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
	}

	function latestUserTimestamp(thread: ThreadRecord | null) {
		const message = [...(thread?.messages ?? [])].reverse().find((entry) => entry.role === 'user');
		return message?.timestampMs ?? thread?.updatedAtMs ?? null;
	}

	function isNearBottom(element: HTMLDivElement) {
		const thresholdPx = 24;
		return element.scrollHeight - element.scrollTop - element.clientHeight <= thresholdPx;
	}

	function buildRunStatus(thread: ThreadRecord | null, nowMs: number) {
		if (!thread || thread.status !== 'running') {
			return null;
		}

		const startedAtMs = latestUserTimestamp(thread);
		const runningFor = startedAtMs
			? formatElapsed(Math.max(0, Math.floor((nowMs - startedAtMs) / 1000)))
			: null;

		return {
			runningFor
		};
	}

	let nowMs = $state(Date.now());
	let statusTimer: ReturnType<typeof setInterval> | null = null;
	let activityListElement: HTMLDivElement | null = null;
	let stickToBottom = $state(true);
	let visibleMessageCount = $state(MESSAGE_PAGE_SIZE);

	let { project, runtimeError, thread }: Props = $props();

	const messages = $derived(visibleMessages(thread));
	const hiddenMessageCount = $derived(Math.max(0, messages.length - visibleMessageCount));
	const pagedMessages = $derived(
		hiddenMessageCount > 0 ? messages.slice(-visibleMessageCount) : messages
	);
	const runStatus = $derived(buildRunStatus(thread, nowMs));
	const scrollKey = $derived.by(() => {
		const lastMessage = pagedMessages.at(-1);
		return [
			thread?.id ?? '',
			lastMessage?.id ?? '',
			lastMessage?.status ?? '',
			lastMessage?.text.length ?? 0
		].join('|');
	});

	function handleActivityScroll() {
		if (!activityListElement) {
			return;
		}

		stickToBottom = isNearBottom(activityListElement);
	}

	function showOlderMessages() {
		visibleMessageCount += MESSAGE_PAGE_SIZE;
	}

	async function scrollToBottom(force = false) {
		await tick();
		if (!activityListElement || (!force && !stickToBottom)) {
			return;
		}

		activityListElement.scrollTop = activityListElement.scrollHeight;
	}

	$effect(() => {
		if (thread?.status !== 'running') {
			if (statusTimer) {
				clearInterval(statusTimer);
				statusTimer = null;
			}
			return;
		}

		nowMs = Date.now();
		statusTimer = setInterval(() => {
			nowMs = Date.now();
		}, 1_000);

		return () => {
			if (statusTimer) {
				clearInterval(statusTimer);
				statusTimer = null;
			}
		};
	});

	$effect(() => {
		const currentThreadId = thread?.id ?? null;
		if (currentThreadId === null) {
			visibleMessageCount = MESSAGE_PAGE_SIZE;
			stickToBottom = true;
			void scrollToBottom(true);
			return;
		}

		visibleMessageCount = MESSAGE_PAGE_SIZE;
		stickToBottom = true;
		void scrollToBottom(true);
	});

	$effect(() => {
		const currentScrollKey = scrollKey;
		if (!currentScrollKey) {
			return;
		}

		void scrollToBottom();
	});

	onDestroy(() => {
		if (statusTimer) {
			clearInterval(statusTimer);
		}
	});
</script>

<section class="conversation-pane">
	<header class="pane-header pane-header--compact">
		<h2>{threadLabel(project, thread)}</h2>
		{#if runStatus?.runningFor}
			<div class="thread-status-inline">
				<span class="visually-hidden" aria-live="polite">Thread running</span>
				<div class="thread-status__signal" aria-hidden="true">
					<span></span>
					<span></span>
					<span></span>
				</div>
				<p aria-hidden="true">Working for {runStatus.runningFor}</p>
			</div>
		{/if}
	</header>

	{#if runtimeError}
		<InlineNotification
			hideCloseButton
			kind="warning"
			lowContrast
			subtitle={runtimeError}
			title="Desktop runtime"
		/>
	{:else if thread?.lastError}
		<InlineNotification
			hideCloseButton
			kind="error"
			lowContrast
			subtitle={thread.lastError}
			title="Run failed"
		/>
	{/if}

	<div bind:this={activityListElement} class="activity-list" onscroll={handleActivityScroll}>
		{#if messages.length}
			{#if hiddenMessageCount > 0}
				<div class="conversation-load-more">
					<button type="button" onclick={showOlderMessages}>
						Show {Math.min(MESSAGE_PAGE_SIZE, hiddenMessageCount)} older messages
					</button>
					<span>{hiddenMessageCount} hidden</span>
				</div>
			{/if}
			{#each pagedMessages as message (message.id)}
				<ThreadMessage {message} />
			{/each}
		{:else}
			<div class="conversation-empty">
				<p>Send a message to start the conversation.</p>
			</div>
		{/if}
	</div>
</section>
