<script lang="ts">
	import { InlineNotification, Tag } from 'carbon-components-svelte';
	import type { ThreadRecord } from '$lib/types/workbench';
	import MessageCard from './MessageCard.svelte';
	import StatusTag from './StatusTag.svelte';
	import ThreadMessage from './ThreadMessage.svelte';

	function buildNotice(thread: ThreadRecord) {
		if (thread.status === 'failed') {
			return {
				kind: 'error' as const,
				subtitle: thread.lastError ?? 'Pi reported a runtime failure for this thread.',
				title: 'Run failed'
			};
		}

		if (thread.status === 'running') {
			return {
				kind: 'info' as const,
				subtitle: 'Pi is currently working this thread.',
				title: 'Run in progress'
			};
		}

		return {
			kind: 'success' as const,
			subtitle: 'Thread state is durable and ready for the next turn.',
			title: 'Thread ready'
		};
	}

	let { runtimeError, thread }: { runtimeError: string | null; thread: ThreadRecord | null } =
		$props();

	const notice = $derived(thread ? buildNotice(thread) : null);
</script>

<section class="conversation-pane surface">
	<header class="pane-header">
		<div>
			<p class="eyebrow">Active thread</p>
			{#if thread}
				<div class="pane-header__title">
					<h2>{thread.title}</h2>
					<StatusTag status={thread.status} />
				</div>
				<p class="pane-header__summary">{thread.branch}</p>
			{:else}
				<div class="pane-header__title">
					<h2>No thread selected</h2>
				</div>
				<p class="pane-header__summary">Add a project or choose a thread to begin.</p>
			{/if}
		</div>

		{#if thread && thread.queue.length > 0}
			<div class="queue-summary">
				<Tag type="blue">{thread.queue.length} queued</Tag>
			</div>
		{/if}
	</header>

	{#if runtimeError}
		<InlineNotification
			hideCloseButton
			kind="warning"
			lowContrast
			subtitle={runtimeError}
			title="Desktop runtime unavailable"
		/>
	{:else if notice}
		<InlineNotification
			hideCloseButton
			kind={notice.kind}
			lowContrast
			subtitle={notice.subtitle}
			title={notice.title}
		/>
	{/if}

	{#if thread && thread.queue.length > 0}
		<section class="queue-panel">
			<div class="queue-panel__header">
				<p class="eyebrow">Queue</p>
				<span>{thread.queue.length} pending items</span>
			</div>
			<ul class="queue-list">
				{#each thread.queue as item (item.id)}
					<li class="context-card">
						<div class="context-card__header">
							<Tag size="sm" type={item.mode === 'steer' ? 'purple' : 'blue'}>{item.mode}</Tag>
							<Tag size="sm" type="outline">{item.status}</Tag>
						</div>
						<p>{item.text}</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="activity-list">
		{#if thread}
			{#if thread.messages.length === 0}
				<div class="empty-panel">
					<p>No messages yet.</p>
					<span>Configure a provider and send the first prompt from the composer.</span>
				</div>
			{:else}
				{#each thread.messages as message (message.id)}
					<ThreadMessage {message} />
				{/each}
			{/if}
		{/if}
	</div>

	{#if thread && thread.activities.length > 0}
		<section class="activity-panel">
			<div class="queue-panel__header">
				<p class="eyebrow">Activity</p>
				<span>{thread.activities.length} recent events</span>
			</div>
			<div class="activity-feed">
				{#each thread.activities as entry (entry.id)}
					<MessageCard {entry} />
				{/each}
			</div>
		</section>
	{/if}
</section>
