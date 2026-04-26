<script lang="ts">
	import { Tag } from 'carbon-components-svelte';
	import type { ActivityRecord } from '$lib/types/workbench';

	const toneByActivity: Record<ActivityRecord['tone'], 'blue' | 'cool-gray' | 'teal'> = {
		assistant: 'blue',
		system: 'teal',
		tool: 'cool-gray'
	};

	let { entry }: { entry: ActivityRecord } = $props();
</script>

<article class="message-card" data-tone={entry.tone}>
	<div class="message-card__header">
		<div class="message-card__heading">
			<Tag type={toneByActivity[entry.tone]}>{entry.title}</Tag>
			<span>{new Date(entry.timestampMs).toLocaleTimeString()}</span>
		</div>
	</div>

	<p class="message-card__body" class:tool-entry={entry.tone === 'tool'}>
		{entry.detail}
	</p>
</article>
