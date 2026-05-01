<script lang="ts">
	import { Button, Tag } from 'carbon-components-svelte';
	import ArrowRight from 'carbon-icons-svelte/lib/ArrowRight.svelte';
	import type { ProjectRecord, ThreadRecord } from '$lib/types/workbench';
	import type { SpecWorkflowStep } from '$lib/workbench/spec-workflow';
	import { SPEC_WORKFLOW_STEPS } from '$lib/workbench/spec-workflow';

	type Props = {
		onUsePrompt: (step: SpecWorkflowStep) => void;
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

	let { onUsePrompt, project, thread }: Props = $props();
	let selectedStepLabel = $state<string | null>(null);
	let lastThreadId = $state<string | null>(null);
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
		if (threadId === lastThreadId) {
			return;
		}

		lastThreadId = threadId;
		selectedStepLabel = null;
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

	<div class="spec-workflow__rail" aria-label="Spec workflow">
		{#each SPEC_WORKFLOW_STEPS as step, index (step.label)}
			<section
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
						<Button
							disabled={!thread}
							icon={ArrowRight}
							kind={index === currentStepIndex ? 'primary' : 'ghost'}
							size="small"
							onclick={() => useStep(step)}
						>
							Use
						</Button>
					</div>
					<p>{step.body}</p>
				</div>
			</section>
		{/each}
	</div>
</div>
