<script lang="ts">
	import { onMount } from 'svelte';
	import type { InspectorMode, ThinkingLevel } from '$lib/types/workbench';
	import { buildShipSlicePrompt } from '$lib/workbench/preset-prompts';
	import { createWorkbenchController } from '$lib/workbench/controller';
	import { buildSpecWorkflowRunRequest } from '$lib/workbench/spec-workflow';
	import {
		createIdleShipReview,
		createReviewingShipReview,
		runShipReviewGate,
		shipReviewScopeMatches
	} from '$lib/workbench/ship-review';
	import type { SpecWorkflowStep } from '$lib/workbench/spec-workflow';
	import WorkbenchShellView from './WorkbenchShellView.svelte';
	import { stageBrowserFiles } from './composer-attachments';
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
	type ShipReviewScopeMap = Record<string, ReturnType<typeof createIdleShipReview>>;

	let addProjectDraft = $state('');
	let addProjectOpen = $state(false);
	let draft = $state('');
	let inspectorMode = $state<InspectorMode | null>(null);
	let manualProjectPathOpen = $state(false);
	let providerDrafts = $state<Record<string, string>>({});
	let selectedProjectId = $state('');
	let selectedThreadId = $state('');
	let settingsOpen = $state(false);
	let shipReviews = $state<ShipReviewScopeMap>({});
	let shipReviewRequestIds = $state<Record<string, number>>({});

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
	const activeShipReviewScopeKey = $derived(
		shipReviewScopeKey(activeProject?.id ?? null, activeThread?.id ?? null)
	);
	const shipReview = $derived(shipReviews[activeShipReviewScopeKey] ?? createIdleShipReview());
	const shellState = $derived({
		activeProject,
		activeThread,
		addProjectDraft,
		addProjectOpen,
		composerHint,
		draft,
		inspectorMode,
		manualProjectPathOpen,
		providerDrafts,
		selectedModel,
		selectedModelKey,
		selectedProjectId,
		selectedReasoningLevel,
		selectedThreadId,
		settingsOpen,
		shipReview,
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

	function shipReviewScopeKey(projectId: string | null, threadId: string | null) {
		return `${projectId ?? ''}::${threadId ?? ''}`;
	}

	function scopedShipReview(projectId: string | null, threadId: string | null) {
		return shipReviews[shipReviewScopeKey(projectId, threadId)] ?? createIdleShipReview();
	}

	function setScopedShipReview(
		projectId: string | null,
		threadId: string | null,
		nextReview: ReturnType<typeof createIdleShipReview>
	) {
		shipReviews = {
			...shipReviews,
			[shipReviewScopeKey(projectId, threadId)]: nextReview
		};
	}

	function nextShipReviewRequestId(projectId: string | null, threadId: string | null) {
		const scopeKey = shipReviewScopeKey(projectId, threadId);
		const nextRequestId = (shipReviewRequestIds[scopeKey] ?? 0) + 1;
		shipReviewRequestIds = { ...shipReviewRequestIds, [scopeKey]: nextRequestId };
		return nextRequestId;
	}

	function currentShipReviewRequestId(projectId: string | null, threadId: string | null) {
		return shipReviewRequestIds[shipReviewScopeKey(projectId, threadId)] ?? 0;
	}

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

	async function sendShipPrompt(
		projectId: string,
		threadId: string,
		status: 'completed' | 'failed' | 'idle' | 'running'
	) {
		if (!shipReviewScopeMatches(scopedShipReview(projectId, threadId), projectId, threadId)) {
			return;
		}

		const mode = status === 'running' ? 'follow-up' : 'prompt';
		await controller.sendPrompt(threadId, buildShipSlicePrompt(), mode);
		setScopedShipReview(projectId, threadId, createIdleShipReview());
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

	async function handleRenameThread(threadId: string, title: string) {
		await runAction(async () => {
			await controller.renameThread(threadId, title);
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
		if (!activeProject || !activeThread || shipReview.status === 'reviewing') {
			return;
		}

		await runAction(async () => {
			const projectId = activeProject.id;
			const threadId = activeThread.id;
			const threadStatus = activeThread.status;
			const requestId = nextShipReviewRequestId(projectId, threadId);
			setScopedShipReview(projectId, threadId, createReviewingShipReview(projectId, threadId));
			const result = await runShipReviewGate(
				controller,
				projectId,
				threadId,
				() => currentShipReviewRequestId(projectId, threadId) === requestId
			);
			if (currentShipReviewRequestId(projectId, threadId) !== requestId) {
				return;
			}
			if (!result) {
				await sendShipPrompt(projectId, threadId, threadStatus);
				return;
			}
			setScopedShipReview(projectId, threadId, result);
			if (result.status === 'needs-decision') {
				inspectorMode = 'diff';
			}
		});
	}

	async function handleShipReviewContinue() {
		const thread = activeThread;
		const projectId = activeProject?.id ?? null;
		if (!thread || !projectId) {
			return;
		}
		if (!shipReviewScopeMatches(scopedShipReview(projectId, thread.id), projectId, thread.id)) {
			setScopedShipReview(projectId, thread.id, createIdleShipReview());
			return;
		}

		await runAction(async () => sendShipPrompt(projectId, thread.id, thread.status));
	}

	async function handleShipReviewDismiss() {
		if (!activeProject || !activeThread) {
			return;
		}
		nextShipReviewRequestId(activeProject.id, activeThread.id);
		setScopedShipReview(activeProject.id, activeThread.id, createIdleShipReview());
	}

	async function handleSpecPromptSelect(step: SpecWorkflowStep) {
		if (!activeThread) {
			return;
		}

		const threadId = activeThread.id;
		const threadIntent = activeThread.intent;
		await runAction(async () => {
			if (threadIntent !== step.intent) {
				await controller.selectIntent(threadId, step.intent);
			}
			const runRequest = buildSpecWorkflowRunRequest(step, {
				hasPriorUserMessages: activeThread.messages.some(
					(message) => message.role === 'user' && message.text.trim().length > 0
				),
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

	async function handleDiffAnalysisModelChange(modelKey: string | null) {
		await runAction(async () => {
			await controller.setDiffAnalysisModel(modelKey);
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

	function toggleInspector(mode: InspectorMode) {
		inspectorMode = inspectorMode === mode ? null : mode;
	}

	function setAddProjectOpen(open: boolean) {
		addProjectOpen = open;
	}

	function setInspectorMode(mode: InspectorMode | null) {
		inspectorMode = mode;
	}

	function setManualProjectPathOpen(open: boolean) {
		manualProjectPathOpen = open;
	}

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
			handleCreateThreadForProject,
			handleDiffAnalysisModelChange,
			handleDraftChange,
			handleImportCodexOpenAiKey,
			handleModelChange,
			handleMoveProject,
			handleOpenDiff,
			handleProjectSelect,
			handleProviderDraftChange,
			handleReasoningChange,
			handleRefreshStatus,
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
			handleShipReviewContinue,
			handleShipReviewDismiss,
			handleShipSlice,
			handleSpecPromptSelect,
			handleStageComposerFiles,
			handleStartCodexLogin,
			handleStop,
			handleStopThread: (threadId) =>
				runAction(async () => {
					await controller.abortThread(threadId);
				}),
			handleThreadSelect,
			handleToggleDiagnosticLogging,
			handleToggleDocparser,
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
