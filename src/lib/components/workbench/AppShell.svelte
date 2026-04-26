<script lang="ts">
	import { Button, Tag } from 'carbon-components-svelte';
	import Settings from 'carbon-icons-svelte/lib/Settings.svelte';
	import Task from 'carbon-icons-svelte/lib/Task.svelte';
	import { onMount } from 'svelte';
	import type { AppSnapshot, ProjectRecord, PromptMode, ThreadRecord } from '$lib/types/workbench';
	import { createWorkbenchController } from '$lib/workbench/controller';
	import { filterProjects } from '$lib/workbench/filter';
	import ComposerPanel from './ComposerPanel.svelte';
	import ContextRail from './ContextRail.svelte';
	import ConversationPane from './ConversationPane.svelte';
	import ProjectRail from './ProjectRail.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	function buildStatusMessage(snapshot: AppSnapshot, thread: ThreadRecord | null) {
		if (!thread) {
			return 'Add a project and create a thread to start the desktop workflow.';
		}

		if (snapshot.models.length === 0) {
			return 'No configured models are available yet. Save at least one provider key in the right rail.';
		}

		if (thread.status === 'running') {
			return 'The current thread is running. Use Queue steer or Queue follow-up for live guidance.';
		}

		return 'Ctrl+V can stage pasted files and images when the desktop runtime exposes them.';
	}

	function findActiveProject(projects: ProjectRecord[], selectedProjectId: string) {
		return projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
	}

	function findActiveThread(project: ProjectRecord | null, selectedThreadId: string) {
		if (!project) {
			return null;
		}

		return (
			project.threads.find((thread) => thread.id === selectedThreadId) ?? project.threads[0] ?? null
		);
	}

	function resolveProjectSelection(snapshot: AppSnapshot, currentSelection: string) {
		if (!snapshot.projects[0]) {
			return '';
		}

		if (!currentSelection) {
			return snapshot.selectedProjectId ?? snapshot.projects[0].id;
		}

		return snapshot.projects.some((project) => project.id === currentSelection)
			? currentSelection
			: snapshot.projects[0].id;
	}

	function resolveThreadSelection(
		snapshot: AppSnapshot,
		project: ProjectRecord | null,
		currentSelection: string
	) {
		if (!project?.threads[0]) {
			return '';
		}

		if (!currentSelection) {
			return snapshot.selectedThreadId ?? project.threads[0].id;
		}

		return project.threads.some((thread) => thread.id === currentSelection)
			? currentSelection
			: project.threads[0].id;
	}

	const controller = createWorkbenchController();

	let draft = $state('');
	let projectPathDraft = $state('');
	let providerDrafts = $state<Record<string, string>>({});
	let query = $state('');
	let selectedProjectId = $state('');
	let selectedThreadId = $state('');
	let threadTitleDraft = $state('New Pi thread');

	const workbenchState = $derived($controller);
	const snapshot = $derived(workbenchState.snapshot);
	const visibleProjects = $derived(filterProjects(snapshot.projects, query));
	const activeProject = $derived(findActiveProject(visibleProjects, selectedProjectId));
	const activeThread = $derived(findActiveThread(activeProject, selectedThreadId));
	const selectedModelKey = $derived(activeThread?.modelKey ?? snapshot.models[0]?.key ?? '');
	const stagedAttachments = $derived(
		activeThread?.attachments.filter((attachment) => attachment.stage === 'staged') ?? []
	);
	const statusMessage = $derived(buildStatusMessage(snapshot, activeThread));

	onMount(() => {
		void controller.initialize();
		return () => controller.destroy();
	});

	$effect(() => {
		selectedProjectId = resolveProjectSelection(snapshot, selectedProjectId);
		selectedThreadId = resolveThreadSelection(snapshot, activeProject, selectedThreadId);
	});

	function handleProjectSelect(projectId: string) {
		selectedProjectId = projectId;
		const project = snapshot.projects.find((entry) => entry.id === projectId);
		selectedThreadId = project?.threads[0]?.id ?? '';
	}

	function handleThreadSelect(projectId: string, threadId: string) {
		selectedProjectId = projectId;
		selectedThreadId = threadId;
	}

	async function runAction(action: () => Promise<void>) {
		try {
			await action();
		} catch {
			return;
		}
	}

	async function handleAddProject() {
		if (!projectPathDraft.trim()) {
			return;
		}

		await runAction(async () => {
			await controller.addProject(projectPathDraft.trim());
			projectPathDraft = '';
		});
	}

	async function handleCreateThread() {
		if (!activeProject) {
			return;
		}

		await runAction(async () => {
			await controller.createThread(activeProject.id, threadTitleDraft.trim() || 'New Pi thread');
			threadTitleDraft = 'New Pi thread';
		});
	}

	async function handleModelChange(modelKey: string) {
		if (!activeThread) {
			return;
		}

		await runAction(async () => {
			await controller.selectModel(activeThread.id, modelKey);
		});
	}

	async function handleFilesSelected(files: FileList | null) {
		if (!activeThread || !files) {
			return;
		}

		await runAction(async () => {
			for (const file of Array.from(files)) {
				await controller.stageAttachment(activeThread.id, file);
			}
		});
	}

	async function handleRemoveAttachment(attachmentId: string) {
		if (!activeThread) {
			return;
		}

		await runAction(async () => {
			await controller.removeAttachment(activeThread.id, attachmentId);
		});
	}

	async function handleSend(mode: PromptMode) {
		if (!activeThread || !draft.trim()) {
			return;
		}

		await runAction(async () => {
			await controller.sendPrompt(activeThread.id, draft.trim(), mode);
			draft = '';
		});
	}

	async function handleStop() {
		if (!activeThread) {
			return;
		}

		await runAction(async () => {
			await controller.abortThread(activeThread.id);
		});
	}

	function handleProviderDraftChange(provider: string, value: string) {
		providerDrafts = { ...providerDrafts, [provider]: value };
	}

	async function handleSaveProvider(provider: string) {
		await runAction(async () => {
			await controller.setProviderKey(provider, providerDrafts[provider] ?? '');
		});
	}

	async function handleToggleDocparser(enabled: boolean) {
		await runAction(async () => {
			await controller.setFeatureToggle('docparser', enabled);
		});
	}

	function handleFileDialogOpen() {
		if (!activeThread) {
			return;
		}
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
			<Tag type="blue">{snapshot.health.bridgeStatus}</Tag>
			<span>{activeThread?.title ?? 'No active thread'}</span>
		</div>

		<div class="topbar__actions">
			<Button icon={Task} kind="ghost" size="small">Queue aware</Button>
			<Button icon={Settings} kind="ghost" size="small">Local runtime</Button>
			<ThemeToggle />
		</div>
	</header>

	<div class="workbench-grid">
		<ProjectRail
			onAddProject={handleAddProject}
			onCreateThread={handleCreateThread}
			onProjectPathChange={(value) => (projectPathDraft = value)}
			onQueryChange={(value) => (query = value)}
			onSelectProject={handleProjectSelect}
			onSelectThread={handleThreadSelect}
			onThreadTitleChange={(value) => (threadTitleDraft = value)}
			{projectPathDraft}
			projects={visibleProjects}
			{query}
			{selectedProjectId}
			{selectedThreadId}
			{threadTitleDraft}
		/>

		<div class="center-column">
			<ConversationPane runtimeError={workbenchState.error} thread={activeThread} />
			<ComposerPanel
				attachments={stagedAttachments}
				{draft}
				models={snapshot.models}
				onDraftChange={(value) => (draft = value)}
				onFileDialogOpen={handleFileDialogOpen}
				onFilesSelected={handleFilesSelected}
				onModelChange={handleModelChange}
				onRemoveAttachment={handleRemoveAttachment}
				onSend={handleSend}
				onStop={handleStop}
				{selectedModelKey}
				{statusMessage}
				threadStatus={activeThread?.status ?? 'idle'}
			/>
		</div>

		<ContextRail
			health={snapshot.health}
			docparserEnabled={snapshot.settings.features.docparserEnabled}
			onProviderDraftChange={handleProviderDraftChange}
			onSaveProvider={handleSaveProvider}
			onToggleDocparser={handleToggleDocparser}
			{providerDrafts}
			providers={snapshot.settings.providers}
			thread={activeThread}
		/>
	</div>
</div>
