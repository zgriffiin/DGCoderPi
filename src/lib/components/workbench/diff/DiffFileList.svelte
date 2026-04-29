<script lang="ts">
	import { Tag } from 'carbon-components-svelte';
	import type { ProjectDiffFile } from '$lib/types/workbench';

	type Props = {
		files: ProjectDiffFile[];
		onSelectFile: (fileId: string) => void;
		onToggleViewed: (fileId: string) => void;
		selectedFileId: string | null;
		viewedFileIds: string[];
	};

	let { files, onSelectFile, onToggleViewed, selectedFileId, viewedFileIds }: Props = $props();

	function isViewed(fileId: string) {
		return viewedFileIds.includes(fileId);
	}
</script>

<ul class="diff-file-list" aria-label="Changed files">
	{#each files as file (file.id)}
		<li>
			<button
				type="button"
				class="diff-file-list__item"
				data-selected={selectedFileId === file.id ? 'true' : undefined}
				onclick={() => onSelectFile(file.id)}
			>
				<div class="diff-file-list__copy">
					<span>{file.path}</span>
					{#if file.originalPath}
						<small>from {file.originalPath}</small>
					{/if}
				</div>
				<div class="diff-file-list__meta">
					<Tag type="outline">{file.statusCode}</Tag>
					<Tag type={isViewed(file.id) ? 'green' : 'cool-gray'}>
						{isViewed(file.id) ? 'viewed' : 'pending'}
					</Tag>
				</div>
			</button>
			<div class="diff-file-list__stats">
				<span>+{file.additions}</span>
				<span>-{file.deletions}</span>
				<button type="button" class="diff-link-button" onclick={() => onToggleViewed(file.id)}>
					{isViewed(file.id) ? 'Mark pending' : 'Mark viewed'}
				</button>
			</div>
		</li>
	{/each}
</ul>
