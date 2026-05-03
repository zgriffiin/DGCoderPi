<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Tag } from 'carbon-components-svelte';
	import Close from 'carbon-icons-svelte/lib/Close.svelte';
	import DiffInspectorPanel from '$lib/components/workbench/diff/DiffInspectorPanel.svelte';
	import type {
		InspectorMode,
		ProjectRecord,
		SpecArtifactDocument,
		ThreadRecord
	} from '$lib/types/workbench';
	import type { WorkbenchController } from '$lib/workbench/controller';
	import type { SpecWorkflowStep } from '$lib/workbench/spec-workflow';
	import { latestSpecArtifactFallbackText } from '$lib/workbench/spec-workflow-artifacts';
	import {
		DEFAULT_INSPECTOR_DETAIL_HEIGHT_PERCENT,
		MAX_INSPECTOR_DETAIL_HEIGHT_PERCENT,
		MIN_INSPECTOR_DETAIL_HEIGHT_PERCENT,
		clampInspectorDetailHeightPercent,
		loadInspectorDetailHeightPercent,
		saveInspectorDetailHeightPercent
	} from '$lib/components/workbench/workbench-layout';
	import SpecArtifactViewer from './SpecArtifactViewer.svelte';
	import SpecWorkflowPanel from './SpecWorkflowPanel.svelte';
	import WorkbenchVerticalResizeHandle from './WorkbenchVerticalResizeHandle.svelte';

	type Props = {
		controller: WorkbenchController;
		mode: InspectorMode;
		onClose: () => void;
		onSpecPromptSelect: (step: SpecWorkflowStep) => void;
		project: ProjectRecord | null;
		thread: ThreadRecord | null;
	};

	function modeTitle(mode: InspectorMode) {
		if (mode === 'tasks') {
			return 'Tasks';
		}

		if (mode === 'diff') {
			return 'Diff';
		}

		return 'Spec';
	}

	function attachmentStatusType(parseStatus: ThreadRecord['attachments'][number]['parseStatus']) {
		if (parseStatus === 'ready') {
			return 'green';
		}

		if (parseStatus === 'failed') {
			return 'red';
		}

		return 'cool-gray';
	}

	function attachmentDisplayState(attachment: ThreadRecord['attachments'][number]) {
		if (attachment.parseStatus === 'failed') {
			return {
				label: 'failed',
				type: 'red'
			} as const;
		}

		if (attachment.warnings.length > 0) {
			return {
				label: 'limited',
				type: 'warm-gray'
			} as const;
		}

		return {
			label: attachment.parseStatus,
			type: attachmentStatusType(attachment.parseStatus)
		} as const;
	}

	let { controller, mode, onClose, onSpecPromptSelect, project, thread }: Props = $props();
	let artifactDocument = $state<SpecArtifactDocument | null>(null);
	let artifactError = $state<string | null>(null);
	let artifactLoading = $state(false);
	let selectedArtifact = $state<string | null>(null);
	let selectedStep = $state<SpecWorkflowStep | null>(null);
	let detailContent = $state<HTMLDivElement | null>(null);
	let detailHeightPercent = $state(DEFAULT_INSPECTOR_DETAIL_HEIGHT_PERCENT);
	let detailSection = $state<HTMLDivElement | null>(null);
	let activeDetailDrag = $state<{
		captureTarget: HTMLElement;
		pointerId: number;
		startDetailHeightPercent: number;
		startY: number;
	} | null>(null);
	let artifactRequestKey = 0;
	const artifactFallbackText = $derived(
		selectedStep ? latestSpecArtifactFallbackText(thread, selectedStep) : null
	);
	const specInspectorStyle = $derived(
		`--workbench-inspector-detail-height:${detailHeightPercent}%;`
	);

	onMount(() => {
		detailHeightPercent = loadInspectorDetailHeightPercent(window.localStorage);
	});

	function setDetailHeight(requestedPercent: number) {
		detailHeightPercent = clampInspectorDetailHeightPercent(requestedPercent);
	}

	function beginDetailResize(event: PointerEvent) {
		event.preventDefault();
		const captureTarget = event.currentTarget;
		if (!(captureTarget instanceof HTMLElement)) {
			return;
		}
		captureTarget.setPointerCapture(event.pointerId);
		activeDetailDrag = {
			captureTarget,
			pointerId: event.pointerId,
			startDetailHeightPercent: detailHeightPercent,
			startY: event.clientY
		};
	}

	function nudgeDetailHeight(delta: number) {
		setDetailHeight(detailHeightPercent - delta);
	}

	function releaseDragCapture(drag: { captureTarget: HTMLElement; pointerId: number }) {
		if (drag.captureTarget.hasPointerCapture(drag.pointerId)) {
			drag.captureTarget.releasePointerCapture(drag.pointerId);
		}
	}

	async function handleViewArtifact(step: SpecWorkflowStep) {
		if (!project) {
			return;
		}

		selectedStep = step;
		selectedArtifact = step.artifact;
		artifactDocument = null;
		artifactLoading = true;
		artifactError = null;
		const requestKey = artifactRequestKey + 1;
		artifactRequestKey = requestKey;

		try {
			const document = await controller.loadSpecArtifact(project.id, step.artifact);
			if (artifactRequestKey !== requestKey) {
				return;
			}
			artifactDocument = document;
		} catch (error) {
			if (artifactRequestKey !== requestKey) {
				return;
			}
			artifactDocument = null;
			artifactError = error instanceof Error ? error.message : String(error);
		} finally {
			if (artifactRequestKey === requestKey) {
				artifactLoading = false;
			}
		}
	}

	$effect(() => {
		const projectId = project?.id ?? null;
		const threadId = thread?.id ?? null;
		void projectId;
		void threadId;
		selectedArtifact = null;
		selectedStep = null;
		artifactDocument = null;
		artifactError = null;
		artifactLoading = false;
	});

	$effect(() => {
		const artifact = selectedArtifact;
		void artifact;
		detailContent?.scrollTo({ top: 0, behavior: 'auto' });
	});

	$effect(() => {
		if (activeDetailDrag) {
			return;
		}
		saveInspectorDetailHeightPercent(window.localStorage, detailHeightPercent);
	});

	$effect(() => {
		if (!activeDetailDrag) {
			return;
		}
		const drag = activeDetailDrag;

		const handlePointerMove = (event: PointerEvent) => {
			const detailHeight = detailSection?.clientHeight ?? window.innerHeight;
			if (detailHeight <= 0) {
				return;
			}
			const deltaPercent = ((event.clientY - drag.startY) / detailHeight) * 100;
			setDetailHeight(drag.startDetailHeightPercent - deltaPercent);
		};
		const handlePointerUp = () => {
			releaseDragCapture(drag);
			activeDetailDrag = null;
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

<aside class="inspector-rail">
	{#if mode !== 'diff'}
		<div class="inspector-rail__header">
			<h2>{modeTitle(mode)}</h2>
			<Button icon={Close} kind="ghost" size="small" onclick={onClose}>Close</Button>
		</div>
	{/if}

	{#if mode === 'tasks'}
		<div class="inspector-stack">
			<div class="inspector-block">
				<div class="inspector-summary">
					<p>Queue</p>
					<Tag type="blue">{thread?.queue?.length ?? 0}</Tag>
				</div>
			</div>

			{#if thread?.queue?.length}
				<ul class="inspector-list">
					{#each thread.queue as item (item.id)}
						<li>
							<div class="inspector-block">
								<div class="inspector-item">
									<div class="inspector-item__header">
										<Tag type={item.mode === 'steer' ? 'purple' : 'blue'}>{item.mode}</Tag>
										<Tag type="outline">{item.status}</Tag>
									</div>
									<p>{item.text}</p>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			{#if thread?.activities?.length}
				<ul class="inspector-list">
					{#each thread.activities as item (item.id)}
						<li>
							<div class="inspector-block">
								<div class="inspector-item">
									<div class="inspector-item__header">
										<p>{item.title}</p>
										<span>{new Date(item.timestampMs).toLocaleTimeString()}</span>
									</div>
									<p>{item.detail}</p>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="empty-panel">
					<p>No task activity</p>
				</div>
			{/if}
		</div>
	{:else if mode === 'diff'}
		<DiffInspectorPanel {controller} {onClose} {project} {thread} />
	{:else}
		<div
			bind:this={detailSection}
			class="inspector-stack inspector-stack--spec"
			style={specInspectorStyle}
		>
			<div class="inspector-stack__primary">
				<SpecWorkflowPanel
					onUsePrompt={onSpecPromptSelect}
					onViewArtifact={handleViewArtifact}
					{project}
					{thread}
				/>
			</div>

			<WorkbenchVerticalResizeHandle
				label="Resize spec details"
				max={MAX_INSPECTOR_DETAIL_HEIGHT_PERCENT}
				min={MIN_INSPECTOR_DETAIL_HEIGHT_PERCENT}
				onNudge={nudgeDetailHeight}
				onPointerDown={beginDetailResize}
				value={detailHeightPercent}
			/>

			<div bind:this={detailContent} class="inspector-stack__detail">
				<SpecArtifactViewer
					artifact={selectedArtifact}
					document={artifactDocument}
					error={artifactError}
					fallbackText={artifactFallbackText}
					loading={artifactLoading}
				/>

				{#if !selectedArtifact && thread?.attachments?.length}
					<ul class="inspector-list">
						{#each thread.attachments as attachment (attachment.id)}
							{@const displayState = attachmentDisplayState(attachment)}
							<li>
								<div class="inspector-block">
									<div class="inspector-item">
										<div class="inspector-item__header">
											<p>{attachment.name}</p>
											<Tag type={displayState.type}>{displayState.label}</Tag>
										</div>
										{#if attachment.warnings.length > 0}
											<p>{attachment.warnings[0]}</p>
										{/if}
										{#if attachment.previewText}
											<p>{attachment.previewText}</p>
										{:else}
											<p>{attachment.mimeType}</p>
										{/if}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<div class="empty-panel">
						<p>No spec context yet</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</aside>
