<script lang="ts">
	import type { ProjectRecord } from '$lib/types/workbench';
	import StatusTag from './StatusTag.svelte';

	type Props = {
		onCreateThread: (projectId: string) => void;
		onMoveProject: (projectId: string, targetIndex: number) => void;
		onSelectProject: (projectId: string) => void;
		onSelectThread: (projectId: string, threadId: string) => void;
		projects: ProjectRecord[];
		selectedProjectId: string;
		selectedThreadId: string;
	};

	let draggedProjectId = $state<string | null>(null);

	let {
		onCreateThread,
		onMoveProject,
		onSelectProject,
		onSelectThread,
		projects,
		selectedProjectId,
		selectedThreadId
	}: Props = $props();

	function latestUserTimestamp(project: ProjectRecord['threads'][number]) {
		const latestUserMessage = [...project.messages]
			.reverse()
			.find((message) => message.role === 'user');
		return latestUserMessage?.timestampMs ?? project.updatedAtMs;
	}

	function sortedThreads(project: ProjectRecord) {
		return [...project.threads].sort((left, right) => {
			return latestUserTimestamp(right) - latestUserTimestamp(left);
		});
	}

	function handleDragStart(projectId: string) {
		draggedProjectId = projectId;
	}

	function handleDrop(projectId: string, targetIndex: number) {
		if (!draggedProjectId || draggedProjectId === projectId) {
			draggedProjectId = null;
			return;
		}

		onMoveProject(draggedProjectId, targetIndex);
		draggedProjectId = null;
	}
</script>

<aside class="project-rail">
	<div class="project-list" role="list">
		{#if projects.length === 0}
			<div class="empty-panel">
				<p>No projects</p>
				<span>Add one from the header.</span>
			</div>
		{:else}
			{#each projects as project, index (project.id)}
				<section
					class="project-section"
					data-selected={project.id === selectedProjectId ? 'true' : undefined}
					draggable="true"
					role="listitem"
					ondragstart={() => handleDragStart(project.id)}
					ondragend={() => (draggedProjectId = null)}
					ondragover={(event) => event.preventDefault()}
					ondrop={() => handleDrop(project.id, index)}
				>
					<div class="project-section__header">
						<button
							class="project-section__title"
							type="button"
							onclick={() => onSelectProject(project.id)}
						>
							<div class="project-section__identity">
								<h2>{project.name}</h2>
								<p>{project.branch}</p>
							</div>
							<span>{project.threads.length}</span>
						</button>

						<button
							aria-label={`Create thread in ${project.name}`}
							class="project-section__new-thread"
							type="button"
							onclick={() => onCreateThread(project.id)}
						>
							+
						</button>
					</div>

					<ul class="thread-list">
						{#each sortedThreads(project) as thread (thread.id)}
							<li>
								<button
									class="thread-row"
									data-selected={thread.id === selectedThreadId ? 'true' : undefined}
									title={new Date(thread.updatedAtMs).toLocaleString()}
									type="button"
									onclick={() => onSelectThread(project.id, thread.id)}
								>
									<StatusTag status={thread.status} />
									<h3>{thread.title}</h3>
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	</div>
</aside>
