<script lang="ts">
	import { ContentSwitcher, ProgressBar, Switch, Tag } from 'carbon-components-svelte';
	import type { FileImpactChange, TaskStatus, ThreadRecord } from '$lib/types/workbench';

	const taskTagType: Record<TaskStatus, 'blue' | 'cool-gray' | 'green' | 'red'> = {
		blocked: 'red',
		done: 'green',
		'in-progress': 'blue',
		ready: 'cool-gray'
	};

	const fileTagType: Record<FileImpactChange, 'blue' | 'cool-gray' | 'green' | 'red'> = {
		added: 'green',
		deleted: 'red',
		modified: 'blue'
	};

	let { thread }: { thread: ThreadRecord } = $props();

	let selectedIndex = $state(0);

	const completedChecks = $derived(
		thread.checks.filter((check) => check.status === 'passed').length
	);
	const progressValue = $derived(
		thread.checks.length === 0 ? 0 : Math.round((completedChecks / thread.checks.length) * 100)
	);
</script>

<aside class="context-rail surface">
	<div class="rail-header">
		<div>
			<p class="eyebrow">Thread context</p>
			<h2>{thread.branch}</h2>
		</div>
	</div>

	<ContentSwitcher bind:selectedIndex size="sm">
		<Switch text="Tasks" />
		<Switch text="Files" />
		<Switch text="Quality" />
	</ContentSwitcher>

	{#if selectedIndex === 0}
		<ul class="context-list">
			{#each thread.tasks as task (task.id)}
				<li class="context-card">
					<div class="context-card__header">
						<Tag size="sm" type={taskTagType[task.status]}>{task.status}</Tag>
						<span>{task.owner}</span>
					</div>
					<h3>{task.title}</h3>
					<p>{task.validation}</p>
				</li>
			{/each}
		</ul>
	{:else if selectedIndex === 1}
		<ul class="context-list">
			{#each thread.files as file (file.id)}
				<li class="context-card">
					<div class="context-card__header">
						<Tag size="sm" type={fileTagType[file.change]}>{file.change}</Tag>
					</div>
					<h3>{file.path}</h3>
					<p>{file.note}</p>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="quality-panel">
			<ProgressBar
				helperText={`${completedChecks} of ${thread.checks.length} checks completed`}
				labelText="Quality gate"
				status={progressValue === 100 ? 'finished' : 'active'}
				value={progressValue}
			/>

			<ul class="context-list">
				{#each thread.checks as check (check.id)}
					<li class="context-card">
						<div class="context-card__header">
							<Tag
								size="sm"
								type={check.status === 'passed'
									? 'green'
									: check.status === 'running'
										? 'blue'
										: 'cool-gray'}
							>
								{check.status}
							</Tag>
						</div>
						<h3>{check.name}</h3>
						<p>{check.detail}</p>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</aside>
