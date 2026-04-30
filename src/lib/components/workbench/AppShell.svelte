<script lang="ts">
	import { onMount } from 'svelte';
	import type { InspectorMode, ThinkingLevel } from '$lib/types/workbench';
	import { buildShipSlicePrompt } from '$lib/workbench/preset-prompts';
	import { createWorkbenchController } from '$lib/workbench/controller';
	import AddProjectModal from './AddProjectModal.svelte';
	import ComposerPanel from './ComposerPanel.svelte';
	import ConversationPane from './ConversationPane.svelte';
	import InspectorRail from './InspectorRail.svelte';
	import ProjectRail from './ProjectRail.svelte';
	import SettingsModal from './SettingsModal.svelte';
	import WorkbenchResizeHandle from './WorkbenchResizeHandle.svelte';
	import WorkbenchTopbar from './WorkbenchTopbar.svelte';
	import { stageBrowserFiles } from './composer-attachments';
	import {
		buildComposerHint,
		findActiveProject,
		findActiveThread,
		newestThread,
		resolveProjectSelection,
		resolveThreadSelection
	} from './workbench-selection';
	import {
		DEFAULT_PANEL_WIDTHS,
		MIN_INSPECTOR_WIDTH,
		MIN_PROJECT_RAIL_WIDTH,
		RESIZE_BREAKPOINT,
		clampWidth,
		formatWorkbenchGridStyle,
		loadPanelWidths,
		maxLeftWidth as computeMaxLeftWidth,
		maxRightWidth as computeMaxRightWidth,
		savePanelWidths,
		type DragState,
		type ResizablePane
	} from './workbench-layout';
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
	let activeDrag = $state<DragState | null>(null);
	let panelWidths = $state(DEFAULT_PANEL_WIDTHS);
	let viewportWidth = $state(0);
	let workbenchGrid = $state<HTMLDivElement | null>(null);

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
	const inspectorVisible = $derived(Boolean(inspectorMode));
	const canResizePanels = $derived(viewportWidth > RESIZE_BREAKPOINT);
	const workbenchGridStyle = $derived(formatWorkbenchGridStyle(panelWidths));

	onMount(() => {
		viewportWidth = window.innerWidth;
		panelWidths = loadPanelWidths(window.localStorage);

		const handleResize = () => {
			viewportWidth = window.innerWidth;
		};
		window.addEventListener('resize', handleResize);
		void controller.initialize();
		return () => {
			window.removeEventListener('resize', handleResize);
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
		if (!activeThread) {
			return;
		}

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

	function maxLeftWidth() {
		const totalWidth = workbenchGrid?.clientWidth ?? viewportWidth;
		return computeMaxLeftWidth(
			totalWidth,
			inspectorVisible ? panelWidths.right : 0,
			inspectorVisible,
			canResizePanels
		);
	}

	function maxRightWidth() {
		const totalWidth = workbenchGrid?.clientWidth ?? viewportWidth;
		return computeMaxRightWidth(totalWidth, panelWidths.left, canResizePanels);
	}

	function setPaneWidth(pane: ResizablePane, requestedWidth: number) {
		panelWidths = {
			...panelWidths,
			[pane]:
				pane === 'left'
					? clampWidth(requestedWidth, MIN_PROJECT_RAIL_WIDTH, maxLeftWidth())
					: clampWidth(requestedWidth, MIN_INSPECTOR_WIDTH, maxRightWidth())
		};
	}

	function beginResize(pane: ResizablePane, event: PointerEvent) {
		if (!canResizePanels) {
			return;
		}
		event.preventDefault();
		const captureTarget = event.currentTarget;
		if (!(captureTarget instanceof HTMLElement)) {
			return;
		}
		captureTarget.setPointerCapture(event.pointerId);
		activeDrag = {
			captureTarget,
			pane,
			pointerId: event.pointerId,
			startWidth: pane === 'left' ? panelWidths.left : panelWidths.right,
			startX: event.clientX
		};
	}

	function nudgePaneWidth(pane: ResizablePane, delta: number) {
		const currentWidth = pane === 'left' ? panelWidths.left : panelWidths.right;
		setPaneWidth(pane, currentWidth + delta);
	}

	function releaseDragCapture(drag: DragState) {
		if (drag.captureTarget.hasPointerCapture(drag.pointerId)) {
			drag.captureTarget.releasePointerCapture(drag.pointerId);
		}
	}

	$effect(() => {
		const leftWidth = clampWidth(panelWidths.left, MIN_PROJECT_RAIL_WIDTH, maxLeftWidth());
		const rightWidth = clampWidth(panelWidths.right, MIN_INSPECTOR_WIDTH, maxRightWidth());
		if (leftWidth === panelWidths.left && rightWidth === panelWidths.right) {
			return;
		}

		panelWidths = {
			left: leftWidth,
			right: rightWidth
		};
	});

	$effect(() => {
		if (activeDrag) {
			return;
		}
		savePanelWidths(window.localStorage, panelWidths);
	});

	$effect(() => {
		if (!activeDrag) {
			return;
		}
		const drag = activeDrag;

		const handlePointerMove = (event: PointerEvent) => {
			const delta = event.clientX - drag.startX;
			setPaneWidth(
				drag.pane,
				drag.pane === 'left' ? drag.startWidth + delta : drag.startWidth - delta
			);
		};
		const handlePointerUp = () => {
			releaseDragCapture(drag);
			activeDrag = null;
		};

		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', handlePointerUp);
		return () => {
			releaseDragCapture(drag);
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
		};
	});
</script>

<div class="workbench">
	<WorkbenchTopbar
		{inspectorMode}
		onAddProject={() => (addProjectOpen = true)}
		onOpenSettings={() => (settingsOpen = true)}
		onToggleInspector={toggleInspector}
		runtimeAvailable={workbenchState.runtimeAvailable}
	/>

	<div
		bind:this={workbenchGrid}
		class="workbench-grid"
		data-has-inspector={inspectorMode ? 'true' : 'false'}
		data-can-resize={canResizePanels ? 'true' : 'false'}
		style={workbenchGridStyle}
	>
		<ProjectRail
			onCreateThread={handleCreateThreadForProject}
			onMoveProject={handleMoveProject}
			onOpenDiff={handleOpenDiff}
			onRefreshStatus={handleRefreshStatus}
			onRemoveProject={handleRemoveProject}
			onRenameProject={handleRenameProject}
			onRenameThread={handleRenameThread}
			onSelectProject={handleProjectSelect}
			onSelectThread={handleThreadSelect}
			onStopThread={(threadId) =>
				runAction(async () => {
					await controller.abortThread(threadId);
				})}
			projects={snapshot.projects}
			{selectedProjectId}
			{selectedThreadId}
		/>

		{#if canResizePanels}
			<WorkbenchResizeHandle
				label="Resize project rail"
				max={maxLeftWidth()}
				min={MIN_PROJECT_RAIL_WIDTH}
				onNudge={(delta) => nudgePaneWidth('left', delta)}
				onPointerDown={(event) => beginResize('left', event)}
				pane="left"
				value={panelWidths.left}
			/>
		{/if}

		<div class="center-column">
			<ConversationPane
				project={activeProject}
				runtimeError={workbenchState.error}
				thread={activeThread}
			/>
			<ComposerPanel
				attachments={stagedAttachments}
				canSend={Boolean(activeThread) && snapshot.models.length > 0}
				{draft}
				hint={composerHint}
				models={snapshot.models}
				onAttach={handleAttachFiles}
				onDraftChange={(value) => (draft = value)}
				onModelChange={handleModelChange}
				onRemoveAttachment={handleRemoveAttachment}
				onReasoningChange={handleReasoningChange}
				onSend={handleSend}
				onShipSlice={handleShipSlice}
				onStageFiles={handleStageComposerFiles}
				onStop={handleStop}
				{selectedModel}
				{selectedModelKey}
				{selectedReasoningLevel}
				threadStatus={activeThread?.status ?? 'idle'}
			/>
		</div>

		{#if inspectorMode}
			{#if canResizePanels}
				<WorkbenchResizeHandle
					label="Resize inspector rail"
					max={maxRightWidth()}
					min={MIN_INSPECTOR_WIDTH}
					onNudge={(delta) => nudgePaneWidth('right', delta)}
					onPointerDown={(event) => beginResize('right', event)}
					pane="right"
					value={panelWidths.right}
				/>
			{/if}

			<InspectorRail
				{controller}
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
		diffAnalysisModelKey={snapshot.settings.diffAnalysisModelKey}
		docparserEnabled={snapshot.settings.features.docparserEnabled}
		onClose={() => (settingsOpen = false)}
		onDiffAnalysisModelChange={handleDiffAnalysisModelChange}
		onImportCodexOpenAiKey={handleImportCodexOpenAiKey}
		onProviderDraftChange={handleProviderDraftChange}
		onRefreshStatus={handleRefreshStatus}
		onSaveProvider={handleSaveProvider}
		onStartCodexLogin={handleStartCodexLogin}
		onToggleDocparser={handleToggleDocparser}
		models={snapshot.models}
		open={settingsOpen}
		{providerDrafts}
		providers={snapshot.settings.providers}
	/>
</div>
