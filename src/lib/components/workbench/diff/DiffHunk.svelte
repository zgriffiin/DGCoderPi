<script lang="ts">
	import type { ProjectDiffHunk } from '$lib/types/workbench';

	type Props = {
		anchorId: string;
		hunk: ProjectDiffHunk;
		isSelected: boolean;
	};

	let { anchorId, hunk, isSelected }: Props = $props();
</script>

<section
	id={anchorId}
	class="diff-hunk"
	data-hunk-id={hunk.id}
	data-selected={isSelected ? 'true' : undefined}
	aria-label={`Hunk ${hunk.header}`}
>
	<header class="diff-hunk__header">
		<span>{hunk.header}</span>
	</header>
	<div class="diff-hunk__rows" role="table" aria-label="Patch hunk lines">
		{#each hunk.lines as line, index (`${hunk.id}:${index}`)}
			<div class="diff-hunk__row" data-kind={line.kind} role="row">
				<div class="diff-hunk__line-number" role="cell">{line.oldLine ?? ''}</div>
				<div class="diff-hunk__line-number" role="cell">{line.newLine ?? ''}</div>
				<div class="diff-hunk__line-label" role="cell">
					{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}
				</div>
				<div class="diff-hunk__text" role="cell">{line.text}</div>
			</div>
		{/each}
	</div>
</section>
