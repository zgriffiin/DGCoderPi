<script lang="ts">
	import { onMount } from 'svelte';
	import type { InspectorMode, ThinkingLevel } from '$lib/types/workbench';
	import { createWorkbenchController } from '$lib/workbench/controller';
	import { buildSpecWorkflowRunRequest } from '$lib/workbench/spec-workflow';
	import type { SpecWorkflowStep } from '$lib/workbench/spec-workflow';
	import FileExplorerOverlay from './file-explorer/FileExplorerOverlay.svelte';
	import WorkbenchShellView from './WorkbenchShellView.svelte';
	import { stageBrowserFiles } from './composer-attachments';
	import { createKiroSsoState } from './kiro-sso-state.svelte';
	import { createShipReviewState } from './ship-review-state.svelte';
	import {
		buildComposerHint,
		findActiveProject,
		findActiveThread,
		newestThread,
		resolveProjectSelection,
		resolveThreadSelection
	} from './workbench-selection';
	import { MIN_PROJECT_RAIL_WIDTH } from './workbench-layout';
	const controller = createWorkbenchController();
	let addProjectDraft = $state('');
	let addProjectOpen = $state(false);
	let draft = $state('');
	let inspectorMode = $state<InspectorMode | null>(null);
	let manualProjectPathOpen = $state(false);
	let providerDrafts = $state<Record<string, string>>({});
	let selectedProjectId = $state('');
	let selectedThreadId = $state('');
	let settingsOpen = $state(false);
	let fileExplorerProjectPath = $state<string | null>(null);
	const kiroSso = createKiroSsoState(controller);
	const shipReviewState = createShipReviewState(
		controller,
		() => activeProject,
		() => activeThread,
		() => (inspectorMode = 'diff'),
		runAction
	);

	const workbenchState = $derived($controller);
	const snapshot = $derived(workbenchState.snapshot);
	const activeProject = $derived(
		findActiveProject(snapshot.projects, selectedProjectId, selectedThreadId)
	);
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
	const shipReview = $derived(shipReviewState.review);
	const projectShipReviewRunning = $derived(shipReviewState.projectRunning);
	const shellState = $derived({
		activeProject,
		activeThread,
		addProjectDraft,
		addProjectOpen,
		composerHint,
		draft,
		inspectorMode,
		kiroBusy: kiroSso.busy,
		kiroDeviceAuth: kiroSso.deviceAuth,
		kiroError: kiroSso.error,
		kiroRegionDraft: kiroSso.regionDraft,
		kiroStartUrlDraft: kiroSso.startUrlDraft,
		manualProjectPathOpen,
		providerDrafts,
		selectedModel,
		selectedModelKey,
		selectedProjectId,
		selectedReasoningLevel,
		selectedThreadId,
		settingsOpen,
		shipReview,
		projectShipReviewRunning,
		stagedAttachments,
		workbenchState
	});

	onMount(() => {
		void controller.initialize();
		return () => {
			controller.destroy();
		};
	});

	$effect(() => {
		selectedProjectId = resolveProjectSelection(snapshot, selectedProjectId);
		selectedThreadId = resolveThreadSelection(snapshot, activeProject, selectedThreadId);
	});

	function closeAddProjectModal() {
		addProjectOpen = false;
		manualProjectPathOpen = false;
	}

	function handleAddProjectDraftChange(value: string) {
		addProjectDraft = value;
	}

	function handleDraftChange(value: string) {
		draft = value;
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
		await runAction(async () => {
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
		});
	}

	async function handleAddProject() {
		const path = addProjectDraft.trim();
		if (!path) return;

		await runAction(async () => {
			await controller.addProject(path);
			addProjectDraft = '';
			closeAddProjectModal();
		});
	}

	async function handleCreateThreadForProject(projectId: string) {
		await runAction(async () => {
			await controller.createThread(projectId, 'New thread');
			selectedProjectId = projectId;
			selectedThreadId = '';
		});
	}

	async function handleMoveProject(projectId: string, targetIndex: number) {
		await runAction(async () => {
			await controller.moveProject(projectId, targetIndex);
		});
	}

	async function handleRenameProject(projectId: string, name: string) {
		await runAction(async () => {
			await controller.renameProject(projectId, name);
		});
	}

	async function handleRemoveProject(projectId: string) {
		await runAction(async () => {
			await controller.removeProject(projectId);
			if (selectedProjectId === projectId) {
				selectedProjectId = '';
				selectedThreadId = '';
			}
		});
	}

	async function handleModelChange(modelKey: string) {
		if (!activeThread) return;

		await runAction(async () => {
			await controller.selectModel(activeThread.id, modelKey);
		});
	}

	async function handleAttachFiles() {
		if (!activeThread || !workbenchState.runtimeAvailable) {
			return;
		}

		await runAction(async () => {
			const { open } = await import('@tauri-apps/plugin-dialog');
			const selection = await open({
				multiple: true,
				title: 'Attach files'
			});
			const pickedPaths = selection as string | string[] | null;
			const paths = Array.isArray(pickedPaths)
				? pickedPaths.filter((path) => path.trim().length > 0)
				: typeof pickedPaths === 'string' && pickedPaths.trim().length > 0
					? [pickedPaths]
					: [];
			for (const path of paths) {
				await controller.stageAttachment(activeThread.id, path);
			}
		});
	}

	async function handleStageComposerFiles(files: File[]) {
		if (!activeThread) {
			return;
		}

		await runAction(async () => {
			await stageBrowserFiles(controller, activeThread.id, files);
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

	async function handlePromoteQueuedMessage(queueId: string, text: string) {
		if (!activeThread) {
			return;
		}

		await runAction(async () => {
			await controller.promoteQueuedMessage(activeThread.id, queueId, text);
		});
	}

	async function handleRenameThread(threadId: string, title: string) {
		await runAction(async () => {
			await controller.renameThread(threadId, title);
		});
	}

	async function handleSend(mode: 'follow-up' | 'prompt' | 'steer') {
		if (!activeThread || !draft.trim()) {
			return;
		}
		if (shipReviewState.hasRunningProject(activeProject?.id ?? null)) {
			return;
		}

		await runAction(async () => {
			await controller.sendPrompt(activeThread.id, draft.trim(), mode);
			draft = '';
		});
	}

	async function handleSpecPromptSelect(step: SpecWorkflowStep) {
		if (!activeThread) {
			return;
		}
		if (shipReviewState.hasRunningProject(activeProject?.id ?? null)) {
			return;
		}

		const threadId = activeThread.id;
		const threadIntent = activeThread.intent;
		const hasPriorUserMessages = activeThread.messages.some(
			(message) => message.role === 'user' && message.text.trim().length > 0
		);
		await runAction(async () => {
			if (threadIntent !== step.intent) {
				await controller.selectIntent(threadId, step.intent);
			}
			const runRequest = buildSpecWorkflowRunRequest(step, {
				hasPriorUserMessages,
				workspaceRoot: activeProject?.path ?? null
			});
			await controller.sendPrompt(threadId, runRequest.text, 'prompt', {
				includeIntentGuidance: true,
				promptGuidance: runRequest.promptGuidance
			});
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

	async function handleToggleDiagnosticLogging(enabled: boolean) {
		await runAction(async () => {
			await controller.setFeatureToggle('diagnostic-logging', enabled);
		});
	}

	async function handleCavemanLevelChange(level: string) {
		await runAction(async () => {
			await controller.setCavemanLevel(level);
		});
	}

	async function handleMaxContextPercentChange(percent: number) {
		await runAction(async () => {
			await controller.setMaxContextPercent(percent);
		});
	}

	async function handleDiffAnalysisModelChange(modelKey: string | null) {
		await runAction(async () => {
			await controller.setDiffAnalysisModel(modelKey);
		});
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

	function handleOpenDiff(projectId: string, threadId?: string) {
		selectedProjectId = projectId;
		if (threadId) {
			selectedThreadId = threadId;
		}
		inspectorMode = 'diff';
	}

	function handleOpenFileExplorer(projectId: string) {
		const project = snapshot.projects.find((entry) => entry.id === projectId);
		if (project) {
			fileExplorerProjectPath = project.path;
		}
	}

	function handleCloseFileExplorer() {
		fileExplorerProjectPath = null;
	}

	function toggleInspector(mode: InspectorMode) {
		inspectorMode = inspectorMode === mode ? null : mode;
	}

	const setAddProjectOpen = (open: boolean) => {
		addProjectOpen = open;
	};
	const setInspectorMode = (mode: InspectorMode | null) => {
		inspectorMode = mode;
	};
	const setManualProjectPathOpen = (open: boolean) => {
		manualProjectPathOpen = open;
	};

	function setSettingsOpen(open: boolean) {
		settingsOpen = open;
	}
</script>

<div class="workbench">
	<WorkbenchShellView
		actions={{
			closeAddProjectModal,
			handleAddProject,
			handleAddProjectDraftChange,
			handleAttachFiles,
			handleBrowseProjectFolder,
			handleCompactThread: (threadId) => runAction(() => controller.compactThread(threadId)),
			handleCreateThreadForProject,
			handleDiffAnalysisModelChange,
			handleDraftChange,
			handleImportCodexOpenAiKey: () => runAction(() => controller.importCodexOpenAiKey()),
			handleKiroCompleteSso: kiroSso.complete,
			handleKiroLogout: kiroSso.logout,
			handleKiroRegionChange: kiroSso.setRegion,
			handleKiroStartSso: kiroSso.start,
			handleKiroStartUrlChange: kiroSso.setStartUrl,
			handleModelChange,
			handleMoveProject,
			handleOpenDiff,
			handleOpenFileExplorer,
			handlePromoteQueuedMessage,
			handleProjectSelect,
			handleProviderDraftChange,
			handleReasoningChange,
			handleRefreshStatus: () => runAction(() => controller.refreshState()),
			handleRemoveAttachment,
			handleRemoveProject,
			handleRemoveThread: (threadId) =>
				runAction(async () => {
					await controller.removeThread(threadId);
				}),
			handleRenameProject,
			handleRenameThread,
			handleSaveProvider,
			handleSend,
			handleShipReviewContinue: shipReviewState.continue,
			handleShipReviewDismiss: shipReviewState.dismiss,
			handleShipSlice: shipReviewState.slice,
			handleSpecPromptSelect,
			handleStageComposerFiles,
			handleStartCodexLogin: () => runAction(() => controller.startCodexLogin()),
			handleStop,
			handleStopThread: (threadId) =>
				runAction(async () => {
					await controller.abortThread(threadId);
				}),
			handleThreadSelect,
			handleToggleDiagnosticLogging,
			handleToggleDocparser,
			handleCavemanLevelChange,
			handleMaxContextPercentChange,
			setAddProjectOpen,
			setInspectorMode,
			setManualProjectPathOpen,
			setSettingsOpen,
			toggleInspector
		}}
		{controller}
		minProjectRailWidth={MIN_PROJECT_RAIL_WIDTH}
		{shellState}
	/>
</div>

{#if fileExplorerProjectPath}
	<FileExplorerOverlay onClose={handleCloseFileExplorer} projectPath={fileExplorerProjectPath} />
{/if}
