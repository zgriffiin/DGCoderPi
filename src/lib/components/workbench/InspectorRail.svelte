<script lang="ts">
	import { Button, Tag } from 'carbon-components-svelte';
	import Close from 'carbon-icons-svelte/lib/Close.svelte';
	import type {
		InspectorMode,
		ProjectDiffSnapshot,
		ProjectRecord,
		ThreadRecord
	} from '$lib/types/workbench';

	type Props = {
		diff: ProjectDiffSnapshot | null;
		diffError: string | null;
		diffLoading: boolean;
		mode: InspectorMode;
		onClose: () => void;
		project: ProjectRecord | null;
		thread: ThreadRecord | null;
	};

	const DIFF_PAGE_SIZE = 100;

	function modeTitle(mode: InspectorMode) {
		if (mode === 'tasks') {
			return 'Tasks';
		}

		if (mode === 'diff') {
			return 'Diff';
		}

		return 'Spec';
	}

	let { diff, diffError, diffLoading, mode, onClose, project, thread }: Props = $props();
	let visibleDiffFileCount = $state(DIFF_PAGE_SIZE);
	const diffResetKey = $derived(
		[mode, project?.id ?? '', diff?.branch ?? '', diff?.files.length ?? 0].join('|')
	);
	const hiddenDiffFileCount = $derived(
		Math.max(0, (diff?.files.length ?? 0) - visibleDiffFileCount)
	);
	const visibleDiffFiles = $derived(diff?.files.slice(0, visibleDiffFileCount) ?? []);

	function showMoreDiffFiles() {
		visibleDiffFileCount += DIFF_PAGE_SIZE;
	}

	$effect(() => {
		const resetKey = diffResetKey;
		if (!resetKey) {
			return;
		}

		visibleDiffFileCount = DIFF_PAGE_SIZE;
	});
</script>

<aside class="inspector-rail">
	<div class="inspector-rail__header">
		<h2>{modeTitle(mode)}</h2>
		<Button icon={Close} kind="ghost" size="small" onclick={onClose}>Close</Button>
	</div>

	{#if mode === 'tasks'}
		<div class="inspector-stack">
			<div class="inspector-block">
				<div class="inspector-summary">
					<p>Queue</p>
					<Tag type="blue">{thread?.queue?.length ?? 0}</Tag>
				</div>
			</div>

			{#if thread?.queue?.length}
				<ul class="inspector-list">
					{#each thread.queue as item (item.id)}
						<li>
							<div class="inspector-block">
								<div class="inspector-item">
									<div class="inspector-item__header">
										<Tag type={item.mode === 'steer' ? 'purple' : 'blue'}>{item.mode}</Tag>
										<Tag type="outline">{item.status}</Tag>
									</div>
									<p>{item.text}</p>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			{#if thread?.activities?.length}
				<ul class="inspector-list">
					{#each thread.activities as item (item.id)}
						<li>
							<div class="inspector-block">
								<div class="inspector-item">
									<div class="inspector-item__header">
										<p>{item.title}</p>
										<span>{new Date(item.timestampMs).toLocaleTimeString()}</span>
									</div>
									<p>{item.detail}</p>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="empty-panel">
					<p>No task activity</p>
				</div>
			{/if}
		</div>
	{:else if mode === 'diff'}
		<div class="inspector-stack">
			<div class="inspector-block">
				<div class="inspector-summary">
					<p>{project?.name ?? 'Project'}</p>
					<Tag type="cool-gray">{diff?.branch ?? project?.branch ?? 'unknown'}</Tag>
				</div>
			</div>

			{#if diffLoading}
				<div class="empty-panel">
					<p>Loading diff</p>
				</div>
			{:else if diffError}
				<div class="empty-panel">
					<p>{diffError}</p>
				</div>
			{:else if !diff?.gitAvailable}
				<div class="empty-panel">
					<p>Git status unavailable</p>
				</div>
			{:else if diff.files.length === 0}
				<div class="empty-panel">
					<p>Clean working tree</p>
				</div>
			{:else}
				{#if hiddenDiffFileCount > 0}
					<div class="inspector-summary inspector-summary--paged">
						<p>Showing {visibleDiffFiles.length} of {diff.files.length} changed files</p>
						<Button kind="ghost" size="small" on:click={showMoreDiffFiles}>Show more</Button>
					</div>
				{/if}
				<ul class="inspector-list">
					{#each visibleDiffFiles as file (file.path)}
						<li>
							<div class="inspector-block">
								<div class="inspector-item">
									<div class="inspector-item__header">
										<Tag type="outline">{file.code}</Tag>
									</div>
									<p>{file.path}</p>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else}
		<div class="inspector-stack">
			{#if project}
				<div class="inspector-block">
					<div class="inspector-item">
						<div class="inspector-item__header">
							<p>Workspace</p>
							<Tag type="cool-gray">{project.branch}</Tag>
						</div>
						<p>{project.path}</p>
					</div>
				</div>
			{/if}

			{#if thread?.attachments?.length}
				<ul class="inspector-list">
					{#each thread.attachments as attachment (attachment.id)}
						<li>
							<div class="inspector-block">
								<div class="inspector-item">
									<div class="inspector-item__header">
										<p>{attachment.name}</p>
										<Tag
											type={attachment.parseStatus === 'ready'
												? 'green'
												: attachment.parseStatus === 'failed'
													? 'red'
													: 'cool-gray'}
										>
											{attachment.parseStatus}
										</Tag>
									</div>
									{#if attachment.previewText}
										<p>{attachment.previewText}</p>
									{:else}
										<p>{attachment.mimeType}</p>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="empty-panel">
					<p>No spec context yet</p>
				</div>
			{/if}
		</div>
	{/if}
</aside>
