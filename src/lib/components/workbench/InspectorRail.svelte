<script lang="ts">
	import { Button, Tag } from 'carbon-components-svelte';
	import Close from 'carbon-icons-svelte/lib/Close.svelte';
	import DiffInspectorPanel from '$lib/components/workbench/diff/DiffInspectorPanel.svelte';
	import type { InspectorMode, ProjectRecord, ThreadRecord } from '$lib/types/workbench';
	import type { WorkbenchController } from '$lib/workbench/controller';

	type Props = {
		controller: WorkbenchController;
		mode: InspectorMode;
		onClose: () => void;
		project: ProjectRecord | null;
		thread: ThreadRecord | null;
	};

	function modeTitle(mode: InspectorMode) {
		if (mode === 'tasks') {
			return 'Tasks';
		}

		if (mode === 'diff') {
			return 'Diff';
		}

		return 'Spec';
	}

	let { controller, mode, onClose, project, thread }: Props = $props();
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
		<DiffInspectorPanel {controller} {project} {thread} />
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
