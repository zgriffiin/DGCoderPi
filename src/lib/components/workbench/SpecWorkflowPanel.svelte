<script lang="ts">
	import { Button, Tag } from 'carbon-components-svelte';
	import ArrowRight from 'carbon-icons-svelte/lib/ArrowRight.svelte';
	import type { ProjectRecord, ThreadRecord } from '$lib/types/workbench';
	import type { SpecWorkflowStep } from '$lib/workbench/spec-workflow';
	import { SPEC_WORKFLOW_STEPS } from '$lib/workbench/spec-workflow';
	import { specWorkflowStageStatus } from '$lib/workbench/spec-workflow-status';

	type Props = {
		onUsePrompt: (step: SpecWorkflowStep) => void;
		onViewArtifact: (step: SpecWorkflowStep) => void;
		project: ProjectRecord | null;
		thread: ThreadRecord | null;
	};

	function activeStepIndex(thread: ThreadRecord | null) {
		if (!thread) {
			return 0;
		}

		const index = SPEC_WORKFLOW_STEPS.findIndex((step) => step.intent === thread.intent);
		return index >= 0 ? index : 0;
	}

	let { onUsePrompt, onViewArtifact, project, thread }: Props = $props();
	let selectedStepLabel = $state<string | null>(null);
	let lastThreadId = $state<string | null>(null);
	let lastThreadIntent = $state<string | null>(null);
	const currentStepIndex = $derived.by(() => {
		if (selectedStepLabel) {
			const selectedIndex = SPEC_WORKFLOW_STEPS.findIndex(
				(step) => step.label === selectedStepLabel
			);
			if (selectedIndex >= 0) {
				return selectedIndex;
			}
		}
		return activeStepIndex(thread);
	});

	function useStep(step: SpecWorkflowStep) {
		selectedStepLabel = step.label;
		onUsePrompt(step);
	}

	$effect(() => {
		const threadId = thread?.id ?? null;
		const threadIntent = thread?.intent ?? null;
		if (threadId !== lastThreadId) {
			lastThreadId = threadId;
			lastThreadIntent = threadIntent;
			selectedStepLabel = null;
			return;
		}
		if (threadIntent !== lastThreadIntent) {
			lastThreadIntent = threadIntent;
			selectedStepLabel = null;
		}
	});
</script>

<div class="spec-workflow">
	{#if project}
		<div class="inspector-block">
			<div class="inspector-item">
				<div class="inspector-item__header">
					<p>Workspace</p>
					<Tag type="cool-gray">{project.branch}</Tag>
				</div>
				<p>{project.path}</p>
			</div>
		</div>
	{/if}

	<ol class="spec-workflow__rail" aria-label="Spec workflow">
		{#each SPEC_WORKFLOW_STEPS as step, index (step.label)}
			{@const stageStatus = specWorkflowStageStatus(thread, step)}
			<li
				aria-current={index === currentStepIndex ? 'step' : undefined}
				class="spec-step"
				data-active={index === currentStepIndex ? 'true' : undefined}
				data-complete={index < currentStepIndex ? 'true' : undefined}
			>
				<div class="spec-step__marker">
					<span>{index + 1}</span>
				</div>
				<div class="spec-step__content">
					<div class="spec-step__header">
						<div>
							<h3>{step.label}</h3>
							<p>{step.artifact}</p>
						</div>
						<Tag size="sm" type={index <= currentStepIndex ? 'blue' : 'gray'}>
							{step.gateLabel}
						</Tag>
						<Button
							aria-label={`Run ${step.label}`}
							disabled={!thread}
							icon={ArrowRight}
							kind={index === currentStepIndex ? 'primary' : 'ghost'}
							size="small"
							onclick={() => useStep(step)}
						>
							Run
						</Button>
						<Button
							aria-label={`View ${step.label} artifact ${step.artifact}`}
							disabled={!project || !step.artifact.endsWith('.md')}
							kind="ghost"
							size="small"
							onclick={() => onViewArtifact(step)}
						>
							View
						</Button>
					</div>
					<p>{step.body}</p>
					<div class="spec-step__coverage">
						<Tag size="sm" type={stageStatus.coverage.tone}>{stageStatus.coverage.label}</Tag>
						<Tag size="sm" type={stageStatus.blocking.tone}>{stageStatus.blocking.label}</Tag>
					</div>
				</div>
			</li>
		{/each}
	</ol>
</div>
