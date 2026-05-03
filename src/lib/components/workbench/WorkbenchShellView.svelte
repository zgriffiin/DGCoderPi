<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		AppSnapshot,
		AttachmentRecord,
		InspectorMode,
		ModelOption,
		ProjectRecord,
		PromptMode,
		ThinkingLevel,
		ThreadRecord
	} from '$lib/types/workbench';
	import type { WorkbenchController } from '$lib/workbench/controller';
	import type { ShipReviewState } from '$lib/workbench/ship-review';
	import { shipReviewDetail, shipReviewMaxRiskLevel } from '$lib/workbench/ship-review';
	import type { SpecWorkflowStep } from '$lib/workbench/spec-workflow';
	import WorkbenchDialogs from './WorkbenchDialogs.svelte';
	import WorkbenchMainGrid from './WorkbenchMainGrid.svelte';
	import WorkbenchTopbar from './WorkbenchTopbar.svelte';
	import {
		DEFAULT_COMPOSER_HEIGHT_PERCENT,
		DEFAULT_PANEL_WIDTHS,
		MIN_INSPECTOR_WIDTH,
		RESIZE_BREAKPOINT,
		clampComposerHeightPercent,
		clampWidth,
		formatWorkbenchGridStyle,
		loadComposerHeightPercent,
		loadPanelWidths,
		maxLeftWidth as computeMaxLeftWidth,
		maxRightWidth as computeMaxRightWidth,
		saveComposerHeightPercent,
		savePanelWidths,
		type DragState,
		type ResizablePane
	} from './workbench-layout';

	type ShellState = {
		activeProject: ProjectRecord | null;
		activeThread: ThreadRecord | null;
		addProjectDraft: string;
		addProjectOpen: boolean;
		composerHint: string;
		draft: string;
		inspectorMode: InspectorMode | null;
		manualProjectPathOpen: boolean;
		providerDrafts: Record<string, string>;
		selectedModel: ModelOption | null;
		selectedModelKey: string;
		selectedProjectId: string;
		selectedReasoningLevel: ThinkingLevel;
		selectedThreadId: string;
		settingsOpen: boolean;
		shipReview: ShipReviewState;
		stagedAttachments: AttachmentRecord[];
		workbenchState: {
			error: string | null;
			runtimeAvailable: boolean;
			snapshot: AppSnapshot;
		};
	};

	type ShellActions = {
		closeAddProjectModal: () => void;
		handleAddProject: () => void;
		handleAttachFiles: () => void;
		handleBrowseProjectFolder: () => void;
		handleCreateThreadForProject: (projectId: string) => void;
		handleDiffAnalysisModelChange: (modelKey: string | null) => void;
		handleAddProjectDraftChange: (value: string) => void;
		handleDraftChange: (value: string) => void;
		handleImportCodexOpenAiKey: () => void;
		handleModelChange: (modelKey: string) => void;
		handleMoveProject: (projectId: string, targetIndex: number) => void;
		handleOpenDiff: (projectId: string, threadId?: string) => void;
		handleProjectSelect: (projectId: string) => void;
		handleProviderDraftChange: (provider: string, value: string) => void;
		handleReasoningChange: (reasoningLevel: ThinkingLevel) => void;
		handleRefreshStatus: () => void;
		handleRemoveAttachment: (attachmentId: string) => void;
		handleRemoveProject: (projectId: string) => void;
		handleRemoveThread: (threadId: string) => void;
		handleRenameProject: (projectId: string, name: string) => void;
		handleRenameThread: (threadId: string, title: string) => void;
		handleSaveProvider: (provider: string) => void;
		handleSend: (mode: PromptMode) => void;
		handleShipReviewContinue: () => void;
		handleShipReviewDismiss: () => void;
		handleShipSlice: () => void;
		handleSpecPromptSelect: (step: SpecWorkflowStep) => void;
		handleStageComposerFiles: (files: File[]) => void;
		handleStartCodexLogin: () => void;
		handleStop: () => void;
		handleStopThread: (threadId: string) => void;
		handleThreadSelect: (projectId: string, threadId: string) => void;
		handleToggleDiagnosticLogging: (enabled: boolean) => void;
		handleToggleDocparser: (enabled: boolean) => void;
		setAddProjectOpen: (open: boolean) => void;
		setInspectorMode: (mode: InspectorMode | null) => void;
		setManualProjectPathOpen: (open: boolean) => void;
		setSettingsOpen: (open: boolean) => void;
		toggleInspector: (mode: InspectorMode) => void;
	};

	type Props = {
		actions: ShellActions;
		controller: WorkbenchController;
		minProjectRailWidth: number;
		shellState: ShellState;
	};

	let { actions, controller, minProjectRailWidth, shellState }: Props = $props();

	let activeDrag = $state<DragState | null>(null);
	let activeComposerDrag = $state<{
		captureTarget: HTMLElement;
		pointerId: number;
		startComposerHeightPercent: number;
		startY: number;
	} | null>(null);
	let centerColumn = $state<HTMLDivElement | null>(null);
	let composerHeightPercent = $state(DEFAULT_COMPOSER_HEIGHT_PERCENT);
	let panelWidths = $state(DEFAULT_PANEL_WIDTHS);
	let viewportWidth = $state(0);
	let workbenchGrid = $state<HTMLDivElement | null>(null);

	const inspectorVisible = $derived(Boolean(shellState.inspectorMode));
	const canResizePanels = $derived(viewportWidth > RESIZE_BREAKPOINT);
	const workbenchGridStyle = $derived(formatWorkbenchGridStyle(panelWidths, composerHeightPercent));

	onMount(() => {
		viewportWidth = window.innerWidth;
		composerHeightPercent = loadComposerHeightPercent(window.localStorage);
		panelWidths = loadPanelWidths(window.localStorage);

		const handleResize = () => {
			viewportWidth = window.innerWidth;
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

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
					? clampWidth(requestedWidth, minProjectRailWidth, maxLeftWidth())
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

	function setComposerHeight(requestedPercent: number) {
		composerHeightPercent = clampComposerHeightPercent(requestedPercent);
	}

	function beginComposerResize(event: PointerEvent) {
		event.preventDefault();
		const captureTarget = event.currentTarget;
		if (!(captureTarget instanceof HTMLElement)) {
			return;
		}
		captureTarget.setPointerCapture(event.pointerId);
		activeComposerDrag = {
			captureTarget,
			pointerId: event.pointerId,
			startComposerHeightPercent: composerHeightPercent,
			startY: event.clientY
		};
	}

	function nudgeComposerHeight(delta: number) {
		setComposerHeight(composerHeightPercent + delta);
	}

	function releaseDragCapture(drag: { captureTarget: HTMLElement; pointerId: number }) {
		if (drag.captureTarget.hasPointerCapture(drag.pointerId)) {
			drag.captureTarget.releasePointerCapture(drag.pointerId);
		}
	}

	$effect(() => {
		const leftWidth = clampWidth(panelWidths.left, minProjectRailWidth, maxLeftWidth());
		const rightWidth = clampWidth(panelWidths.right, MIN_INSPECTOR_WIDTH, maxRightWidth());
		if (leftWidth === panelWidths.left && rightWidth === panelWidths.right) {
			return;
		}

		panelWidths = { left: leftWidth, right: rightWidth };
	});

	$effect(() => {
		if (activeDrag) {
			return;
		}
		savePanelWidths(window.localStorage, panelWidths);
	});

	$effect(() => {
		if (activeComposerDrag) {
			return;
		}
		saveComposerHeightPercent(window.localStorage, composerHeightPercent);
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

	$effect(() => {
		if (!activeComposerDrag) {
			return;
		}
		const drag = activeComposerDrag;

		const handlePointerMove = (event: PointerEvent) => {
			const centerHeight = centerColumn?.clientHeight ?? window.innerHeight;
			if (centerHeight <= 0) {
				return;
			}
			const deltaPercent = ((event.clientY - drag.startY) / centerHeight) * 100;
			setComposerHeight(drag.startComposerHeightPercent - deltaPercent);
		};
		const handlePointerUp = () => {
			releaseDragCapture(drag);
			activeComposerDrag = null;
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

<WorkbenchTopbar
	inspectorMode={shellState.inspectorMode}
	onAddProject={() => actions.setAddProjectOpen(true)}
	onOpenSettings={() => actions.setSettingsOpen(true)}
	onToggleInspector={actions.toggleInspector}
	runtimeAvailable={shellState.workbenchState.runtimeAvailable}
/>

<WorkbenchMainGrid
	activeProject={shellState.activeProject}
	activeThread={shellState.activeThread}
	attachments={shellState.stagedAttachments}
	{canResizePanels}
	bind:centerColumnElement={centerColumn}
	{composerHeightPercent}
	composerHint={shellState.composerHint}
	{controller}
	draft={shellState.draft}
	bind:gridElement={workbenchGrid}
	inspectorMode={shellState.inspectorMode}
	{maxLeftWidth}
	{maxRightWidth}
	minInspectorWidth={MIN_INSPECTOR_WIDTH}
	{minProjectRailWidth}
	onAttach={actions.handleAttachFiles}
	onBeginComposerResize={beginComposerResize}
	onBeginResize={beginResize}
	onCreateThread={actions.handleCreateThreadForProject}
	onDraftChange={actions.handleDraftChange}
	onModelChange={actions.handleModelChange}
	onMoveProject={actions.handleMoveProject}
	onNudgeComposerHeight={nudgeComposerHeight}
	onNudgePaneWidth={nudgePaneWidth}
	onOpenDiff={actions.handleOpenDiff}
	onRefreshStatus={actions.handleRefreshStatus}
	onRemoveAttachment={actions.handleRemoveAttachment}
	onRemoveProject={actions.handleRemoveProject}
	onRemoveThread={actions.handleRemoveThread}
	onRenameProject={actions.handleRenameProject}
	onRenameThread={actions.handleRenameThread}
	onReasoningChange={actions.handleReasoningChange}
	onSelectProject={actions.handleProjectSelect}
	onSelectThread={actions.handleThreadSelect}
	onSend={actions.handleSend}
	onShipReviewContinue={actions.handleShipReviewContinue}
	onShipReviewDismiss={actions.handleShipReviewDismiss}
	onShipSlice={actions.handleShipSlice}
	onSpecPromptSelect={actions.handleSpecPromptSelect}
	onStageFiles={actions.handleStageComposerFiles}
	onStop={actions.handleStop}
	onStopThread={actions.handleStopThread}
	onToggleInspector={actions.setInspectorMode}
	{panelWidths}
	selectedModel={shellState.selectedModel}
	selectedModelKey={shellState.selectedModelKey}
	selectedProjectId={shellState.selectedProjectId}
	selectedReasoningLevel={shellState.selectedReasoningLevel}
	selectedThreadId={shellState.selectedThreadId}
	runtimeError={shellState.workbenchState.error}
	shipReviewDetail={shipReviewDetail(shellState.shipReview)}
	shipReviewIssueCount={shellState.shipReview.analysis?.risks.length ?? 0}
	shipReviewMaxRiskLevel={shipReviewMaxRiskLevel(shellState.shipReview)}
	shipReviewStatus={shellState.shipReview.status}
	snapshot={shellState.workbenchState.snapshot}
	{workbenchGridStyle}
/>

<WorkbenchDialogs
	addProjectDraft={shellState.addProjectDraft}
	addProjectOpen={shellState.addProjectOpen}
	codex={shellState.workbenchState.snapshot.integrations.codex}
	diffAnalysisModelKey={shellState.workbenchState.snapshot.settings.diffAnalysisModelKey}
	diagnosticLoggingEnabled={shellState.workbenchState.snapshot.settings.features
		.diagnosticLoggingEnabled}
	docparserEnabled={shellState.workbenchState.snapshot.settings.features.docparserEnabled}
	manualProjectPathOpen={shellState.manualProjectPathOpen}
	models={shellState.workbenchState.snapshot.models}
	onAddProjectDraftChange={actions.handleAddProjectDraftChange}
	onAddProjectSubmit={actions.handleAddProject}
	onBrowseProject={actions.handleBrowseProjectFolder}
	onCloseAddProject={actions.closeAddProjectModal}
	onCloseSettings={() => actions.setSettingsOpen(false)}
	onDiffAnalysisModelChange={actions.handleDiffAnalysisModelChange}
	onImportCodexOpenAiKey={actions.handleImportCodexOpenAiKey}
	onProviderDraftChange={actions.handleProviderDraftChange}
	onRefreshStatus={actions.handleRefreshStatus}
	onSaveProvider={actions.handleSaveProvider}
	onStartCodexLogin={actions.handleStartCodexLogin}
	onToggleDiagnosticLogging={actions.handleToggleDiagnosticLogging}
	onToggleDocparser={actions.handleToggleDocparser}
	onToggleManualPath={() => actions.setManualProjectPathOpen(!shellState.manualProjectPathOpen)}
	providerDrafts={shellState.providerDrafts}
	providers={shellState.workbenchState.snapshot.settings.providers}
	runtimeAvailable={shellState.workbenchState.runtimeAvailable}
	settingsOpen={shellState.settingsOpen}
/>
