<script lang="ts">
	import { Tag } from 'carbon-components-svelte';
	import type { ActivityEntry, ActivityTone } from '$lib/types/workbench';

	const toneByActivity: Record<ActivityTone, 'blue' | 'cool-gray' | 'purple' | 'teal'> = {
		assistant: 'blue',
		plan: 'purple',
		system: 'teal',
		tool: 'cool-gray'
	};

	let { entry }: { entry: ActivityEntry } = $props();
</script>

<article class="message-card" data-tone={entry.tone}>
	<div class="message-card__header">
		<div class="message-card__heading">
			<Tag type={toneByActivity[entry.tone]}>{entry.title}</Tag>
			<span>{entry.timestamp}</span>
		</div>
		{#if entry.tags.length > 0}
			<div class="message-card__tags">
				{#each entry.tags as tag (`${entry.id}-${tag}`)}
					<Tag size="sm" type="outline">
						{tag}
					</Tag>
				{/each}
			</div>
		{/if}
	</div>

	<p class="message-card__body" class:tool-entry={entry.tone === 'tool'}>
		{entry.body}
	</p>
</article>
