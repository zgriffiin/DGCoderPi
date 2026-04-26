<script lang="ts">
	import { Button, InlineNotification } from 'carbon-components-svelte';
	import DocumentView from 'carbon-icons-svelte/lib/DocumentView.svelte';
	import FolderDetails from 'carbon-icons-svelte/lib/FolderDetails.svelte';
	import type { ThreadRecord } from '$lib/types/workbench';
	import MessageCard from './MessageCard.svelte';
	import StatusTag from './StatusTag.svelte';

	function buildNotice(thread: ThreadRecord) {
		switch (thread.status) {
			case 'completed':
				return { kind: 'success' as const, title: 'Thread complete' };
			case 'failed':
				return { kind: 'error' as const, title: 'Thread failed' };
			case 'waiting':
				return { kind: 'warning' as const, title: 'Awaiting input' };
			default:
				return { kind: 'info' as const, title: 'Work in progress' };
		}
	}

	let { thread }: { thread: ThreadRecord } = $props();

	const notice = $derived(buildNotice(thread));
</script>

<section class="conversation-pane surface">
	<header class="pane-header">
		<div>
			<p class="eyebrow">Active thread</p>
			<div class="pane-header__title">
				<h2>{thread.title}</h2>
				<StatusTag status={thread.status} />
			</div>
			<p class="pane-header__summary">{thread.summary}</p>
		</div>

		<div class="pane-header__actions">
			<Button icon={DocumentView} kind="ghost" size="small">Latest diff</Button>
			<Button icon={FolderDetails} kind="ghost" size="small">Files touched</Button>
		</div>
	</header>

	<InlineNotification
		hideCloseButton
		kind={notice.kind}
		lowContrast
		subtitle={thread.note}
		title={notice.title}
	/>

	<div class="activity-list">
		{#each thread.activities as entry (entry.id)}
			<MessageCard {entry} />
		{/each}
	</div>
</section>
