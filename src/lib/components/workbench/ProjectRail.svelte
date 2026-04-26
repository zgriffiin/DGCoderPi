<script lang="ts">
	import { Button, Search, TextInput } from 'carbon-components-svelte';
	import type { ProjectRecord } from '$lib/types/workbench';
	import { readEventValue } from '$lib/workbench/read-event-value';
	import StatusTag from './StatusTag.svelte';

	type Props = {
		onAddProject: () => void;
		onCreateThread: () => void;
		onProjectPathChange: (value: string) => void;
		onQueryChange: (value: string) => void;
		onSelectProject: (projectId: string) => void;
		onSelectThread: (projectId: string, threadId: string) => void;
		onThreadTitleChange: (value: string) => void;
		projectPathDraft: string;
		projects: ProjectRecord[];
		query: string;
		selectedProjectId: string;
		selectedThreadId: string;
		threadTitleDraft: string;
	};

	let {
		onAddProject,
		onCreateThread,
		onProjectPathChange,
		onQueryChange,
		onSelectProject,
		onSelectThread,
		onThreadTitleChange,
		projectPathDraft,
		projects,
		query,
		selectedProjectId,
		selectedThreadId,
		threadTitleDraft
	}: Props = $props();
</script>

<aside class="project-rail surface">
	<div class="rail-header">
		<div>
			<p class="eyebrow">Projects</p>
			<h2>Workspace</h2>
		</div>
	</div>

	<Search
		labelText="Search projects and threads"
		placeholder="Search threads, branches, messages"
		size="lg"
		value={query}
		on:input={(event) => onQueryChange(readEventValue(event))}
	/>

	<div class="stack-form">
		<TextInput
			labelText="Repository path"
			placeholder="C:\\Repos\\project"
			size="sm"
			value={projectPathDraft}
			on:input={(event) => onProjectPathChange(readEventValue(event))}
		/>
		<Button kind="primary" size="small" on:click={onAddProject}>Add project</Button>
	</div>

	<div class="stack-form">
		<TextInput
			labelText="New thread"
			placeholder="Describe the thread"
			size="sm"
			value={threadTitleDraft}
			on:input={(event) => onThreadTitleChange(readEventValue(event))}
		/>
		<Button kind="ghost" size="small" on:click={onCreateThread}>Create thread</Button>
	</div>

	<div class="project-list">
		{#if projects.length === 0}
			<div class="empty-panel">
				<p>No projects yet.</p>
				<span>Add a repository path to start a tracked workspace.</span>
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
										<span>{new Date(thread.updatedAtMs).toLocaleTimeString()}</span>
									</div>
									<h4>{thread.title}</h4>
									<p>{thread.branch}</p>
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		{/if}
	</div>
</aside>
