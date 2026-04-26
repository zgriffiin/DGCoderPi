<script lang="ts">
	import { Tag } from 'carbon-components-svelte';
	import type { MessageRecord } from '$lib/types/workbench';

	const toneByRole: Record<MessageRecord['role'], 'blue' | 'cool-gray' | 'green' | 'purple'> = {
		assistant: 'blue',
		system: 'purple',
		tool: 'cool-gray',
		user: 'green'
	};

	let { message }: { message: MessageRecord } = $props();
</script>

<article class="message-card" data-tone={message.role}>
	<div class="message-card__header">
		<div class="message-card__heading">
			<Tag type={toneByRole[message.role]}>{message.role}</Tag>
			<span>{new Date(message.timestampMs).toLocaleTimeString()}</span>
		</div>
		<Tag size="sm" type={message.status === 'failed' ? 'red' : 'outline'}>{message.status}</Tag>
	</div>

	<p class="message-card__body">{message.text}</p>
</article>
