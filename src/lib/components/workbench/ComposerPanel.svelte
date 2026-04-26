<script lang="ts">
	import { Button, Dropdown, TextArea } from 'carbon-components-svelte';
	import ArrowRight from 'carbon-icons-svelte/lib/ArrowRight.svelte';
	import type { ModelOption } from '$lib/types/workbench';

	type Props = {
		draft: string;
		models: ModelOption[];
		onDraftChange: (value: string) => void;
		onModelChange: (modelId: string) => void;
		onSend: () => void;
		onStop: () => void;
		selectedModelId: string;
		statusMessage: string;
	};

	type ModelItem = {
		id: string;
		text: string;
	};

	function handleDraftInput(event: Event) {
		const input = event.target as HTMLTextAreaElement;
		onDraftChange(input.value);
	}

	function handleModelSelect(event: CustomEvent<{ selectedId: string }>) {
		onModelChange(event.detail.selectedId);
	}

	let {
		draft,
		models,
		onDraftChange,
		onModelChange,
		onSend,
		onStop,
		selectedModelId,
		statusMessage
	}: Props = $props();

	const modelItems = $derived.by<ModelItem[]>(() => {
		return models.map((model) => ({ id: model.id, text: model.text }));
	});

	const selectedModel = $derived(models.find((model) => model.id === selectedModelId) ?? models[0]);
</script>

<section class="composer-panel surface">
	<div class="composer-panel__controls">
		<Dropdown
			items={modelItems}
			labelText="Model"
			selectedId={selectedModelId}
			size="sm"
			on:select={handleModelSelect}
		/>

		<div class="composer-panel__pills">
			<Button kind="ghost" size="small">Spec mode</Button>
			<Button kind="ghost" size="small">Attach context</Button>
		</div>
	</div>

	<TextArea
		helperText={selectedModel?.helperText ?? ''}
		labelText="Prompt Pi"
		maxCount={4000}
		placeholder="Describe the next coding task, review, or spec artifact."
		rows={4}
		value={draft}
		on:input={handleDraftInput}
	/>

	<div class="composer-panel__footer">
		<p>{statusMessage}</p>
		<div class="composer-panel__actions">
			<Button kind="ghost" size="small" on:click={onStop}>Stop</Button>
			<Button icon={ArrowRight} kind="primary" size="small" on:click={onSend}>Send to Pi</Button>
		</div>
	</div>
</section>
