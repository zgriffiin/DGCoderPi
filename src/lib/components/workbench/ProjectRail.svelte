<script lang="ts">
	import { Button, Search } from 'carbon-components-svelte';
	import type { ProjectRecord } from '$lib/types/workbench';
	import StatusTag from './StatusTag.svelte';

	type Props = {
		onQueryChange: (value: string) => void;
		onSelectProject: (projectId: string) => void;
		onSelectThread: (projectId: string, threadId: string) => void;
		projects: ProjectRecord[];
		query: string;
		selectedProjectId: string;
		selectedThreadId: string;
	};

	function handleSearchInput(event: Event) {
		const input = event.target as HTMLInputElement;
		onQueryChange(input.value);
	}

	let {
		onQueryChange,
		onSelectProject,
		onSelectThread,
		projects,
		query,
		selectedProjectId,
		selectedThreadId
	}: Props = $props();
</script>

<aside class="project-rail surface">
	<div class="rail-header">
		<div>
			<p class="eyebrow">Projects</p>
			<h2>Workspace</h2>
		</div>

		<Button kind="ghost" size="small">New thread</Button>
	</div>

	<Search
		labelText="Search projects and threads"
		placeholder="Search threads, branches, specs"
		size="lg"
		value={query}
		on:input={handleSearchInput}
	/>

	<div class="project-list">
		{#if projects.length === 0}
			<div class="empty-panel">
				<p>No matching projects.</p>
				<span>Try a thread title, branch, or status.</span>
			</div>
		{:else}
			{#each projects as project (project.id)}
				<section class="project-group">
					<button
						class="project-row"
						data-selected={project.id === selectedProjectId ? 'true' : undefined}
						type="button"
						onclick={() => onSelectProject(project.id)}
					>
						<div>
							<h3>{project.name}</h3>
							<p>{project.path}</p>
						</div>
						<span class="project-row__branch">{project.branch}</span>
					</button>

					<ul class="thread-list">
						{#each project.threads as thread (thread.id)}
							<li>
								<button
									class="thread-row"
									data-selected={thread.id === selectedThreadId ? 'true' : undefined}
									type="button"
									onclick={() => onSelectThread(project.id, thread.id)}
								>
									<div class="thread-row__meta">
										<StatusTag status={thread.status} />
										<span>{thread.updatedAt}</span>
									</div>
									<h4>{thread.title}</h4>
									<p>{thread.summary}</p>
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	</div>
</aside>
