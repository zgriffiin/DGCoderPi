<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import Add from 'carbon-icons-svelte/lib/Add.svelte';
	import Code from 'carbon-icons-svelte/lib/Code.svelte';
	import DocumentRequirements from 'carbon-icons-svelte/lib/DocumentRequirements.svelte';
	import Settings from 'carbon-icons-svelte/lib/Settings.svelte';
	import Task from 'carbon-icons-svelte/lib/Task.svelte';
	import { onMount } from 'svelte';
	import type {
		AppSnapshot,
		InspectorMode,
		ProjectDiffSnapshot,
		ProjectRecord,
		ThinkingLevel,
		ThreadRecord
	} from '$lib/types/workbench';
	import { buildShipSlicePrompt } from '$lib/workbench/preset-prompts';
	import { createWorkbenchController } from '$lib/workbench/controller';
	import AddProjectModal from './AddProjectModal.svelte';
	import ComposerPanel from './ComposerPanel.svelte';
	import ConversationPane from './ConversationPane.svelte';
	import InspectorRail from './InspectorRail.svelte';
	import ProjectRail from './ProjectRail.svelte';
	import SettingsModal from './SettingsModal.svelte';

	function buildComposerHint(snapshot: AppSnapshot, thread: ThreadRecord | null) {
		if (!thread) {
			return 'Pick a thread before sending.';
		}

		if (snapshot.models.length === 0) {
			return 'No models available. Configure a provider in Settings.';
		}

		return 'Ask Pi to inspect or change.';
	}

	function findActiveProject(projects: ProjectRecord[], selectedProjectId: string) {
		return projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
	}

	function latestUserTimestamp(thread: ThreadRecord) {
		const latestUserMessage = [...thread.messages]
			.reverse()
			.find((message) => message.role === 'user');
		return latestUserMessage?.timestampMs ?? thread.updatedAtMs;
	}

	function newestThread(threads: ThreadRecord[]) {
		return (
			[...threads].sort(
				(left, right) => latestUserTimestamp(right) - latestUserTimestamp(left)
			)[0] ?? null
		);
	}

	function findActiveThread(project: ProjectRecord | null, selectedThreadId: string) {
		if (!project) {
			return null;
		}

		return (
			project.threads.find((thread) => thread.id === selectedThreadId) ??
			newestThread(project.threads)
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
			return (
				snapshot.selectedThreadId ?? newestThread(project.threads)?.id ?? project.threads[0].id
			);
		}

		return project.threads.some((thread) => thread.id === currentSelection)
			? currentSelection
			: (newestThread(project.threads)?.id ?? project.threads[0].id);
	}

	const controller = createWorkbenchController();

	let addProjectDraft = $state('');
	let addProjectOpen = $state(false);
	let diff = $state<ProjectDiffSnapshot | null>(null);
	let diffError = $state<string | null>(null);
	let diffLoading = $state(false);
	let draft = $state('');
	let inspectorMode = $state<InspectorMode | null>(null);
	let manualProjectPathOpen = $state(false);
	let providerDrafts = $state<Record<string, string>>({});
	let selectedProjectId = $state('');
	let selectedThreadId = $state('');
	let settingsOpen = $state(false);

	const workbenchState = $derived($controller);
	const snapshot = $derived(workbenchState.snapshot);
	const activeProject = $derived(findActiveProject(snapshot.projects, selectedProjectId));
	const activeThread = $derived(findActiveThread(activeProject, selectedThreadId));
	const selectedModelKey = $derived(activeThread?.modelKey ?? snapshot.models[0]?.key ?? '');
	const selectedModel = $derived(
		snapshot.models.find((model) => model.key === selectedModelKey) ?? snapshot.models[0] ?? null
	);
	const selectedReasoningLevel = $derived(
		selectedModel?.supportsReasoning ? (activeThread?.reasoningLevel ?? 'off') : 'off'
	);
	const stagedAttachments = $derived(
		activeThread?.attachments.filter((attachment) => attachment.stage === 'staged') ?? []
	);
	const composerHint = $derived(buildComposerHint(snapshot, activeThread));

	onMount(() => {
		void controller.initialize();
		return () => controller.destroy();
	});

	$effect(() => {
		selectedProjectId = resolveProjectSelection(snapshot, selectedProjectId);
		selectedThreadId = resolveThreadSelection(snapshot, activeProject, selectedThreadId);
	});

	$effect(() => {
		if (inspectorMode !== 'diff' || !activeProject) {
			diff = null;
			diffError = null;
			diffLoading = false;
			return;
		}

		diff = null;
		diffLoading = true;
		diffError = null;
		const projectId = activeProject.id;
		let cancelled = false;

		void controller
			.loadProjectDiff(projectId)
			.then((nextDiff) => {
				if (cancelled) return;
				diff = nextDiff;
			})
			.catch((error) => {
				if (cancelled) return;
				diff = null;
				diffError = error instanceof Error ? error.message : String(error);
			})
			.finally(() => {
				if (cancelled) return;
				diffLoading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	function closeAddProjectModal() {
		addProjectOpen = false;
		manualProjectPathOpen = false;
	}

	function handleProjectSelect(projectId: string) {
		selectedProjectId = projectId;
		const project = snapshot.projects.find((entry) => entry.id === projectId);
		selectedThreadId = newestThread(project?.threads ?? [])?.id ?? '';
	}

	async function runAction(action: () => Promise<void>) {
		try {
			await action();
		} catch {
			return;
		}
	}

	async function handleBrowseProjectFolder() {
		if (!workbenchState.runtimeAvailable) {
			return;
		}

		const { open } = await import('@tauri-apps/plugin-dialog');
		const selection = await open({
			directory: true,
			multiple: false,
			title: 'Open project folder'
		});

		if (typeof selection !== 'string' || !selection.trim()) {
			return;
		}

		addProjectDraft = selection.trim();
		await handleAddProject();
	}

	async function handleAddProject() {
		const path = addProjectDraft.trim();
		if (!path) {
			return;
		}

		await runAction(async () => {
			await controller.addProject(path);
			addProjectDraft = '';
			closeAddProjectModal();
		});
	}

	async function handleCreateThreadForProject(projectId: string) {
		await runAction(async () => {
			const nextSnapshot = await controller.createThread(projectId, 'New thread');
			selectedProjectId = projectId;
			selectedThreadId = nextSnapshot.selectedThreadId ?? selectedThreadId;
		});
	}

	async function handleMoveProject(projectId: string, targetIndex: number) {
		await runAction(async () => {
			await controller.moveProject(projectId, targetIndex);
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

	async function handleSend(mode: 'follow-up' | 'prompt' | 'steer') {
		if (!activeThread || !draft.trim()) {
			return;
		}

		await runAction(async () => {
			await controller.sendPrompt(activeThread.id, draft.trim(), mode);
			draft = '';
		});
	}

	async function handleShipSlice() {
		if (!activeThread) {
			return;
		}

		const mode = activeThread.status === 'running' ? 'follow-up' : 'prompt';
		await runAction(async () => {
			await controller.sendPrompt(activeThread.id, buildShipSlicePrompt(), mode);
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

	async function handleImportCodexOpenAiKey() {
		await runAction(async () => {
			await controller.importCodexOpenAiKey();
		});
	}

	async function handleStartCodexLogin() {
		await runAction(async () => {
			await controller.startCodexLogin();
		});
	}

	async function handleRefreshStatus() {
		await runAction(async () => {
			await controller.refreshState();
		});
	}

	function handleFileDialogOpen() {
		if (!activeThread) {
			return;
		}
	}

	async function handleReasoningChange(reasoningLevel: ThinkingLevel) {
		if (!activeThread) {
			return;
		}

		await runAction(async () => {
			await controller.selectReasoning(activeThread.id, reasoningLevel);
		});
	}

	function handleThreadSelect(projectId: string, threadId: string) {
		selectedProjectId = projectId;
		selectedThreadId = threadId;
	}

	function toggleInspector(mode: InspectorMode) {
		inspectorMode = inspectorMode === mode ? null : mode;
	}
</script>

<div class="workbench">
	<header class="topbar">
		<div class="topbar__brand">
			<div class="brand-mark">PI</div>
			<div class="topbar__title">
				<h1>DGCoder Pi</h1>
			</div>
		</div>

		<div class="topbar__actions">
			<Button
				disabled={!workbenchState.runtimeAvailable}
				icon={Add}
				kind="secondary"
				size="small"
				on:click={() => (addProjectOpen = true)}
			>
				Add project
			</Button>
			<Button
				icon={Task}
				kind={inspectorMode === 'tasks' ? 'primary' : 'ghost'}
				size="small"
				on:click={() => toggleInspector('tasks')}
			>
				Tasks
			</Button>
			<Button
				icon={Code}
				kind={inspectorMode === 'diff' ? 'primary' : 'ghost'}
				size="small"
				on:click={() => toggleInspector('diff')}
			>
				Diff
			</Button>
			<Button
				icon={DocumentRequirements}
				kind={inspectorMode === 'spec' ? 'primary' : 'ghost'}
				size="small"
				on:click={() => toggleInspector('spec')}
			>
				Spec
			</Button>
			<Button icon={Settings} kind="ghost" size="small" on:click={() => (settingsOpen = true)}>
				Settings
			</Button>
		</div>
	</header>

	<div class="workbench-grid" data-has-inspector={inspectorMode ? 'true' : 'false'}>
		<ProjectRail
			onCreateThread={handleCreateThreadForProject}
			onMoveProject={handleMoveProject}
			onSelectProject={handleProjectSelect}
			onSelectThread={handleThreadSelect}
			projects={snapshot.projects}
			{selectedProjectId}
			{selectedThreadId}
		/>

		<div class="center-column">
			<ConversationPane
				project={activeProject}
				runtimeError={workbenchState.error}
				thread={activeThread}
			/>
			<ComposerPanel
				attachments={stagedAttachments}
				canSend={Boolean(activeThread)}
				{draft}
				hint={composerHint}
				models={snapshot.models}
				onDraftChange={(value) => (draft = value)}
				onFileDialogOpen={handleFileDialogOpen}
				onFilesSelected={handleFilesSelected}
				onModelChange={handleModelChange}
				onRemoveAttachment={handleRemoveAttachment}
				onReasoningChange={handleReasoningChange}
				onSend={handleSend}
				onShipSlice={handleShipSlice}
				onStop={handleStop}
				{selectedModel}
				{selectedModelKey}
				{selectedReasoningLevel}
				threadStatus={activeThread?.status ?? 'idle'}
			/>
		</div>

		{#if inspectorMode}
			<InspectorRail
				{diff}
				{diffError}
				{diffLoading}
				mode={inspectorMode}
				onClose={() => (inspectorMode = null)}
				project={activeProject}
				thread={activeThread}
			/>
		{/if}
	</div>

	<AddProjectModal
		draftPath={addProjectDraft}
		manualPathOpen={manualProjectPathOpen}
		onBrowse={handleBrowseProjectFolder}
		onClose={closeAddProjectModal}
		onDraftPathChange={(value) => (addProjectDraft = value)}
		onSubmit={handleAddProject}
		onToggleManualPath={() => (manualProjectPathOpen = !manualProjectPathOpen)}
		open={addProjectOpen}
		runtimeAvailable={workbenchState.runtimeAvailable}
	/>

	<SettingsModal
		codex={snapshot.integrations.codex}
		docparserEnabled={snapshot.settings.features.docparserEnabled}
		onClose={() => (settingsOpen = false)}
		onImportCodexOpenAiKey={handleImportCodexOpenAiKey}
		onProviderDraftChange={handleProviderDraftChange}
		onRefreshStatus={handleRefreshStatus}
		onSaveProvider={handleSaveProvider}
		onStartCodexLogin={handleStartCodexLogin}
		onToggleDocparser={handleToggleDocparser}
		open={settingsOpen}
		{providerDrafts}
		providers={snapshot.settings.providers}
	/>
</div>
