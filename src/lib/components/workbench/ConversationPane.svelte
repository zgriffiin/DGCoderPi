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
	type TimelineMessage = ThreadRecord['messages'][number];
	type TimelineActivity = ThreadRecord['activities'][number];
	type TimelineEntry =
		| {
				id: string;
				item: TimelineMessage;
				timestampMs: number;
				type: 'message';
		  }
		| {
				id: string;
				item: TimelineActivity;
				timestampMs: number;
				type: 'activity';
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

	function visibleTimelineActivities(thread: ThreadRecord | null) {
		return (thread?.activities ?? []).filter((activity) => activity.kind === 'intent-switch');
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

		const latestActivity = currentRunActivity(thread, nowMs);
		const startedAtMs = latestUserTimestamp(thread);
		const runningFor = startedAtMs
			? formatElapsed(Math.max(0, Math.floor((nowMs - startedAtMs) / 1000)))
			: null;

		return {
			detail: latestActivity?.detail ?? null,
			title: latestActivity?.title ?? null,
			runningFor
		};
	}

	function currentRunActivity(thread: ThreadRecord, nowMs: number) {
		const latestUserAt = latestUserTimestamp(thread) ?? 0;
		const activeTools: { startedAtMs: number; toolName: string }[] = [];
		const recentActivities = thread.activities.filter((entry) => entry.timestampMs >= latestUserAt);
		const latestProgressAt = latestRunProgressTimestamp(thread, latestUserAt);

		for (const activity of recentActivities) {
			if (activity.title === 'Tool running') {
				activeTools.push({
					startedAtMs: activity.timestampMs,
					toolName: toolNameFromActivity(activity.detail)
				});
			} else if (activity.title === 'Tool finished') {
				const finishedToolName = toolNameFromActivity(activity.detail);
				const activeTool = activeTools.at(-1);
				if (activeTool?.toolName === finishedToolName) {
					activeTools.pop();
					continue;
				}

				const matchingToolIndex = activeTools.findIndex(
					(entry) => entry.toolName === finishedToolName
				);
				if (matchingToolIndex !== -1) {
					activeTools.splice(matchingToolIndex, 1);
				}
			}
		}

		const activeTool = activeTools.at(-1);
		if (activeTool) {
			return {
				detail: `${activeTool.toolName} for ${formatElapsed(
					Math.max(0, Math.floor((nowMs - activeTool.startedAtMs) / 1000))
				)}`,
				title: 'Tool running'
			};
		}

		return {
			detail: `Quiet for ${formatElapsed(
				Math.max(0, Math.floor((nowMs - latestProgressAt) / 1000))
			)}`,
			title: 'Waiting on model'
		};
	}

	function latestRunProgressTimestamp(thread: ThreadRecord, latestUserAt: number) {
		const activityTimestamp = thread.activities
			.filter((entry) => entry.timestampMs >= latestUserAt)
			.at(-1)?.timestampMs;
		const assistantTimestamp = [...thread.messages]
			.reverse()
			.find(
				(entry) => entry.role === 'assistant' && entry.timestampMs >= latestUserAt
			)?.timestampMs;
		return Math.max(latestUserAt, activityTimestamp ?? 0, assistantTimestamp ?? 0);
	}

	function toolNameFromActivity(detail: string) {
		const match = /^(.*?)(?: started\.| completed successfully\.| reported an error\.)$/.exec(
			detail.trim()
		);
		return match?.[1] || detail.trim();
	}

	let nowMs = $state(Date.now());
	let statusTimer: ReturnType<typeof setInterval> | null = null;
	let activityListElement: HTMLDivElement | null = null;
	let stickToBottom = $state(true);
	let visibleMessageCount = $state(MESSAGE_PAGE_SIZE);

	let { project, runtimeError, thread }: Props = $props();

	const messages = $derived(visibleMessages(thread));
	const timelineActivities = $derived(visibleTimelineActivities(thread));
	const timeline = $derived(
		(
			[
				...messages.map((message) => ({
					id: message.id,
					item: message,
					timestampMs: message.timestampMs,
					type: 'message' as const
				})),
				...timelineActivities.map((activity) => ({
					id: activity.id,
					item: activity,
					timestampMs: activity.timestampMs,
					type: 'activity' as const
				}))
			] satisfies TimelineEntry[]
		).sort((left, right) => left.timestampMs - right.timestampMs)
	);
	const hiddenMessageCount = $derived(Math.max(0, timeline.length - visibleMessageCount));
	const pagedMessages = $derived(
		hiddenMessageCount > 0 ? timeline.slice(-visibleMessageCount) : timeline
	);
	const runStatus = $derived(buildRunStatus(thread, nowMs));
	const scrollKey = $derived.by(() => {
		const lastEntry = pagedMessages.at(-1);
		const textLength = lastEntry?.type === 'message' ? lastEntry.item.text.length : 0;
		const status = lastEntry?.type === 'message' ? lastEntry.item.status : '';
		return [thread?.id ?? '', lastEntry?.id ?? '', status, textLength].join('|');
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
		<div class="pane-header__identity">
			<h2>{threadLabel(project, thread)}</h2>
		</div>
		{#if runStatus?.runningFor}
			<div class="thread-status-inline">
				<span class="visually-hidden" aria-live="polite">Thread running</span>
				<div class="thread-status__signal" aria-hidden="true">
					<span></span>
					<span></span>
					<span></span>
				</div>
				<p aria-hidden="true">
					Working for {runStatus.runningFor}
					{#if runStatus.title}
						<span>{runStatus.title}</span>
					{/if}
					{#if runStatus.detail}
						<span>{runStatus.detail}</span>
					{/if}
				</p>
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
		{#if timeline.length}
			{#if hiddenMessageCount > 0}
				<div class="conversation-load-more">
					<button type="button" onclick={showOlderMessages}>
						Show {Math.min(MESSAGE_PAGE_SIZE, hiddenMessageCount)} older messages
					</button>
					<span>{hiddenMessageCount} hidden</span>
				</div>
			{/if}
			{#each pagedMessages as entry (entry.id)}
				{#if entry.type === 'message'}
					<ThreadMessage message={entry.item} />
				{:else}
					<div class="activity-entry" data-kind={entry.item.kind} data-tone={entry.item.tone}>
						<span>{entry.item.title}</span>
						<p>{entry.item.detail}</p>
					</div>
				{/if}
			{/each}
		{:else}
			<div class="conversation-empty">
				<p>Send a message to start the conversation.</p>
			</div>
		{/if}
	</div>
</section>
