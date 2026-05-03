<script lang="ts">
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
	import type { ShipReviewStatus } from '$lib/workbench/ship-review';
	import type { SpecWorkflowStep } from '$lib/workbench/spec-workflow';
	import { MAX_COMPOSER_HEIGHT_PERCENT, MIN_COMPOSER_HEIGHT_PERCENT } from './workbench-layout';
	import ComposerPanel from './ComposerPanel.svelte';
	import ConversationPane from './ConversationPane.svelte';
	import InspectorRail from './InspectorRail.svelte';
	import ProjectRail from './ProjectRail.svelte';
	import WorkbenchResizeHandle from './WorkbenchResizeHandle.svelte';
	import WorkbenchVerticalResizeHandle from './WorkbenchVerticalResizeHandle.svelte';

	type Props = {
		activeProject: ProjectRecord | null;
		activeThread: ThreadRecord | null;
		attachments: AttachmentRecord[];
		canResizePanels: boolean;
		centerColumnElement: HTMLDivElement | null;
		composerHeightPercent: number;
		composerHint: string;
		controller: WorkbenchController;
		draft: string;
		gridElement: HTMLDivElement | null;
		inspectorMode: InspectorMode | null;
		maxLeftWidth: () => number;
		maxRightWidth: () => number;
		minInspectorWidth: number;
		minProjectRailWidth: number;
		onAttach: () => void;
		onBeginResize: (pane: 'left' | 'right', event: PointerEvent) => void;
		onBeginComposerResize: (event: PointerEvent) => void;
		onCreateThread: (projectId: string) => void;
		onDraftChange: (value: string) => void;
		onMoveProject: (projectId: string, targetIndex: number) => void;
		onModelChange: (modelKey: string) => void;
		onNudgePaneWidth: (pane: 'left' | 'right', delta: number) => void;
		onOpenDiff: (projectId: string, threadId?: string) => void;
		onNudgeComposerHeight: (delta: number) => void;
		onRefreshStatus: () => void;
		onRemoveAttachment: (attachmentId: string) => void;
		onRemoveProject: (projectId: string) => void;
		onRemoveThread: (threadId: string) => void;
		onRenameProject: (projectId: string, name: string) => void;
		onRenameThread: (threadId: string, title: string) => void;
		onReasoningChange: (reasoningLevel: ThinkingLevel) => void;
		onSelectProject: (projectId: string) => void;
		onSelectThread: (projectId: string, threadId: string) => void;
		onSend: (mode: PromptMode) => void;
		onShipReviewContinue: () => void;
		onShipReviewDismiss: () => void;
		onShipSlice: () => void;
		onSpecPromptSelect: (step: SpecWorkflowStep) => void;
		onStageFiles: (files: File[]) => void;
		onStop: () => void;
		onStopThread: (threadId: string) => void;
		onToggleInspector: (mode: InspectorMode | null) => void;
		panelWidths: { left: number; right: number };
		selectedModel: ModelOption | null;
		selectedModelKey: string;
		selectedProjectId: string;
		selectedReasoningLevel: ThinkingLevel;
		selectedThreadId: string;
		runtimeError: string | null;
		shipReviewDetail: string | null;
		shipReviewIssueCount: number;
		shipReviewMaxRiskLevel: string | null;
		shipReviewStatus: ShipReviewStatus;
		snapshot: AppSnapshot;
		workbenchGridStyle: string;
	};

	let {
		activeProject,
		activeThread,
		attachments,
		canResizePanels,
		centerColumnElement = $bindable(null),
		composerHeightPercent,
		composerHint,
		controller,
		draft,
		gridElement = $bindable(null),
		inspectorMode,
		maxLeftWidth,
		maxRightWidth,
		minInspectorWidth,
		minProjectRailWidth,
		onAttach,
		onBeginResize,
		onBeginComposerResize,
		onCreateThread,
		onDraftChange,
		onMoveProject,
		onModelChange,
		onNudgePaneWidth,
		onOpenDiff,
		onNudgeComposerHeight,
		onRefreshStatus,
		onRemoveAttachment,
		onRemoveProject,
		onRemoveThread,
		onRenameProject,
		onRenameThread,
		onReasoningChange,
		onSelectProject,
		onSelectThread,
		onSend,
		onShipReviewContinue,
		onShipReviewDismiss,
		onShipSlice,
		onSpecPromptSelect,
		onStageFiles,
		onStop,
		onStopThread,
		onToggleInspector,
		panelWidths,
		selectedModel,
		selectedModelKey,
		selectedProjectId,
		selectedReasoningLevel,
		selectedThreadId,
		runtimeError,
		shipReviewDetail,
		shipReviewIssueCount,
		shipReviewMaxRiskLevel,
		shipReviewStatus,
		snapshot,
		workbenchGridStyle
	}: Props = $props();
</script>

<div
	bind:this={gridElement}
	class="workbench-grid"
	data-has-inspector={inspectorMode ? 'true' : 'false'}
	data-can-resize={canResizePanels ? 'true' : 'false'}
	style={workbenchGridStyle}
>
	<ProjectRail
		{onCreateThread}
		{onMoveProject}
		{onOpenDiff}
		{onRefreshStatus}
		{onRemoveProject}
		{onRemoveThread}
		{onRenameProject}
		{onRenameThread}
		{onSelectProject}
		{onSelectThread}
		{onStopThread}
		projects={snapshot.projects}
		{selectedProjectId}
		{selectedThreadId}
	/>

	{#if canResizePanels}
		<WorkbenchResizeHandle
			label="Resize project rail"
			max={maxLeftWidth()}
			min={minProjectRailWidth}
			onNudge={(delta) => onNudgePaneWidth('left', delta)}
			onPointerDown={(event) => onBeginResize('left', event)}
			pane="left"
			value={panelWidths.left}
		/>
	{/if}

	<div bind:this={centerColumnElement} class="center-column">
		<ConversationPane project={activeProject} {runtimeError} thread={activeThread} />
		{#if canResizePanels}
			<WorkbenchVerticalResizeHandle
				label="Resize conversation and composer"
				max={MAX_COMPOSER_HEIGHT_PERCENT}
				min={MIN_COMPOSER_HEIGHT_PERCENT}
				onNudge={onNudgeComposerHeight}
				onPointerDown={onBeginComposerResize}
				value={composerHeightPercent}
			/>
		{/if}
		<ComposerPanel
			{attachments}
			canSend={Boolean(activeThread) && snapshot.models.length > 0}
			{draft}
			hint={composerHint}
			models={snapshot.models}
			{onAttach}
			{onDraftChange}
			{onModelChange}
			{onRemoveAttachment}
			{onReasoningChange}
			{onSend}
			{onShipReviewContinue}
			{onShipReviewDismiss}
			{onShipSlice}
			{onStageFiles}
			{onStop}
			{selectedModel}
			{selectedModelKey}
			{selectedReasoningLevel}
			{shipReviewDetail}
			{shipReviewIssueCount}
			{shipReviewMaxRiskLevel}
			{shipReviewStatus}
			threadStatus={activeThread?.status ?? 'idle'}
		/>
	</div>

	{#if inspectorMode}
		{#if canResizePanels}
			<WorkbenchResizeHandle
				label="Resize inspector rail"
				max={maxRightWidth()}
				min={minInspectorWidth}
				onNudge={(delta) => onNudgePaneWidth('right', delta)}
				onPointerDown={(event) => onBeginResize('right', event)}
				pane="right"
				value={panelWidths.right}
			/>
		{/if}

		<InspectorRail
			{controller}
			mode={inspectorMode}
			onClose={() => onToggleInspector(null)}
			{onSpecPromptSelect}
			project={activeProject}
			thread={activeThread}
		/>
	{/if}
</div>
