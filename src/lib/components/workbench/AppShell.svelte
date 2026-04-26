<script lang="ts">
	import { Button, Tag } from 'carbon-components-svelte';
	import Document from 'carbon-icons-svelte/lib/Document.svelte';
	import DocumentTasks from 'carbon-icons-svelte/lib/DocumentTasks.svelte';
	import type { WorkbenchData } from '$lib/types/workbench';
	import { filterProjects } from '$lib/workbench/filter';
	import ComposerPanel from './ComposerPanel.svelte';
	import ContextRail from './ContextRail.svelte';
	import ConversationPane from './ConversationPane.svelte';
	import ProjectRail from './ProjectRail.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let { data }: { data: WorkbenchData } = $props();

	let draft = $state('Sketch the persistence boundary and wire the first durable shell state.');
	let query = $state('');
	let selectedModelId = $state('');
	let selectedProjectId = $state('');
	let selectedThreadId = $state('');
	let statusMessage = $state(
		'The shell is interactive and theme-aware. Next step is wiring the Pi transport behind the desktop boundary.'
	);

	const visibleProjects = $derived(filterProjects(data.projects, query));
	const activeProject = $derived(
		data.projects.find((project) => project.id === selectedProjectId) ?? data.projects[0]
	);
	const activeThread = $derived(
		activeProject.threads.find((thread) => thread.id === selectedThreadId) ??
			activeProject.threads[0]
	);

	$effect(() => {
		if (!selectedModelId && data.models[0]) {
			selectedModelId = data.models[0].id;
		}

		if (!selectedProjectId && data.projects[0]) {
			selectedProjectId = data.projects[0].id;
		}

		if (!selectedThreadId && data.projects[0]?.threads[0]) {
			selectedThreadId = data.projects[0].threads[0].id;
		}
	});

	function handleProjectSelect(projectId: string) {
		const project = data.projects.find((entry) => entry.id === projectId);

		if (!project) {
			return;
		}

		selectedProjectId = project.id;
		selectedThreadId = project.threads[0]?.id ?? '';
	}

	function handleThreadSelect(projectId: string, threadId: string) {
		selectedProjectId = projectId;
		selectedThreadId = threadId;
	}

	function handleSend() {
		statusMessage =
			'Prompt staged in the shell scaffold. The next implementation slice is a typed Pi transport in the Rust core.';
		draft = '';
	}

	function handleStop() {
		statusMessage =
			'Stop is represented in the UI. Process lifecycle control will become real once the Tauri command layer is wired.';
	}
</script>

<div class="workbench">
	<header class="topbar">
		<div class="topbar__brand">
			<div class="brand-mark">PI</div>
			<div>
				<p class="eyebrow">Pi desktop workbench</p>
				<h1>DGCoder Pi</h1>
			</div>
		</div>

		<div class="topbar__thread">
			<Tag type="blue">Active thread</Tag>
			<span>{activeThread.title}</span>
		</div>

		<div class="topbar__actions">
			<Button icon={DocumentTasks} kind="ghost" size="small">Spec mode</Button>
			<Button icon={Document} kind="ghost" size="small">Review state</Button>
			<ThemeToggle />
		</div>
	</header>

	<div class="workbench-grid">
		<ProjectRail
			onQueryChange={(value) => (query = value)}
			onSelectProject={handleProjectSelect}
			onSelectThread={handleThreadSelect}
			projects={visibleProjects}
			{query}
			{selectedProjectId}
			{selectedThreadId}
		/>

		<div class="center-column">
			<ConversationPane thread={activeThread} />
			<ComposerPanel
				{draft}
				models={data.models}
				onDraftChange={(value) => (draft = value)}
				onModelChange={(modelId) => (selectedModelId = modelId)}
				{selectedModelId}
				onSend={handleSend}
				onStop={handleStop}
				{statusMessage}
			/>
		</div>

		<ContextRail thread={activeThread} />
	</div>
</div>
