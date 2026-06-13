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
	import { trackWindowPointerDrag } from '$lib/workbench/pointer-drag';
	import type { SpecWorkflowStep } from '$lib/workbench/spec-workflow';

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

	let { controller, mode, onClose, onSpecPromptSelect, project, thread }: Props = $props();
	let artifactDocument = $state<SpecArtifactDocument | null>(null);
	let artifactError = $state<string | null>(null);
	let artifactLoading = $state(false);
	let selectedArtifact = $state<string | null>(null);
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
	let lastArtifactScopeKey = '';
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

	async function handleViewArtifact(step: SpecWorkflowStep) {
		if (!project) {
			return;
		}

		selectedArtifact = step.artifact;
		artifactDocument = null;
		artifactLoading = true;
		artifactError = null;
		const requestKey = artifactRequestKey + 1;
		const scopeKey = lastArtifactScopeKey;
		artifactRequestKey = requestKey;

		try {
			const document = await controller.loadSpecArtifact(project.id, step.artifact);
			if (artifactRequestKey !== requestKey || scopeKey !== lastArtifactScopeKey) {
				return;
			}
			artifactDocument = document;
		} catch (error) {
			if (artifactRequestKey !== requestKey || scopeKey !== lastArtifactScopeKey) {
				return;
			}
			artifactDocument = null;
			artifactError = error instanceof Error ? error.message : String(error);
		} finally {
			if (artifactRequestKey === requestKey && scopeKey === lastArtifactScopeKey) {
				artifactLoading = false;
			}
		}
	}

	$effect(() => {
		const projectId = project?.id ?? null;
		const threadId = thread?.id ?? null;
		const scopeKey = `${projectId ?? ''}::${threadId ?? ''}`;
		if (scopeKey === lastArtifactScopeKey) {
			return;
		}

		lastArtifactScopeKey = scopeKey;
		selectedArtifact = null;
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

		return trackWindowPointerDrag(drag, {
			onMove(event) {
				const detailHeight = detailSection?.clientHeight ?? window.innerHeight;
				if (detailHeight <= 0) {
					return;
				}
				const deltaPercent = ((event.clientY - drag.startY) / detailHeight) * 100;
				setDetailHeight(drag.startDetailHeightPercent - deltaPercent);
			},
			onEnd() {
				activeDetailDrag = null;
			}
		});
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
					loading={artifactLoading}
				/>

				{#if !selectedArtifact}
					<div class="empty-panel">
						<p>No spec context yet</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</aside>
