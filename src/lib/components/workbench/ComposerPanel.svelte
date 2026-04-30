<script lang="ts">
	import { Button, Dropdown, Tag, TextArea } from 'carbon-components-svelte';
	import Add from 'carbon-icons-svelte/lib/Add.svelte';
	import ArrowRight from 'carbon-icons-svelte/lib/ArrowRight.svelte';
	import Stop from 'carbon-icons-svelte/lib/StopFilledAlt.svelte';
	import type {
		AttachmentRecord,
		ModelOption,
		PromptMode,
		ThinkingLevel,
		ThreadRecord
	} from '$lib/types/workbench';
	import { readEventValue } from '$lib/workbench/read-event-value';

	type Props = {
		attachments: AttachmentRecord[];
		canSend: boolean;
		draft: string;
		hint: string;
		models: ModelOption[];
		onAttach: () => void;
		onDraftChange: (value: string) => void;
		onModelChange: (modelKey: string) => void;
		onReasoningChange: (reasoningLevel: ThinkingLevel) => void;
		onRemoveAttachment: (attachmentId: string) => void;
		onSend: (mode: PromptMode) => void;
		onShipSlice: () => void;
		onStageFiles: (files: File[]) => void;
		onStop: () => void;
		selectedModel: ModelOption | null;
		selectedModelKey: string;
		selectedReasoningLevel: ThinkingLevel;
		threadStatus: ThreadRecord['status'];
	};

	type SelectItem = {
		id: string;
		text: string;
	};

	const THINKING_LABELS: Record<ThinkingLevel, string> = {
		off: 'No reasoning',
		minimal: 'Minimal',
		low: 'Low',
		medium: 'Medium',
		high: 'High',
		xhigh: 'Extra High'
	};

	function isThinkingLevel(value: string): value is ThinkingLevel {
		return value in THINKING_LABELS;
	}

	function handleModelSelect(event: CustomEvent<{ selectedId: string }>) {
		onModelChange(event.detail.selectedId);
	}

	function handleReasoningSelect(event: CustomEvent<{ selectedId: string }>) {
		const availableThinkingLevels = selectedModel?.availableThinkingLevels?.length
			? selectedModel.availableThinkingLevels
			: ['off'];
		if (
			isThinkingLevel(event.detail.selectedId) &&
			availableThinkingLevels.includes(event.detail.selectedId)
		) {
			onReasoningChange(event.detail.selectedId);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!canSend || !draft.trim() || event.key !== 'Enter' || event.shiftKey || event.isComposing) {
			return;
		}

		event.preventDefault();
		if (threadStatus === 'running') {
			onSend('follow-up');
			return;
		}

		onSend('prompt');
	}

	function fileListFromDataTransfer(dataTransfer: DataTransfer | null) {
		if (!dataTransfer) {
			return [];
		}

		return Array.from(dataTransfer.files).filter((file) => file.size > 0);
	}

	function handlePaste(event: ClipboardEvent) {
		const files = fileListFromDataTransfer(event.clipboardData);
		if (files.length === 0) {
			return;
		}

		event.preventDefault();
		onStageFiles(files);
	}

	function handleDragOver(event: DragEvent) {
		const types = Array.from(event.dataTransfer?.types ?? []);
		const hasFiles = types.some((value) => value.toLowerCase() === 'files');
		if (!hasFiles || !event.dataTransfer) {
			return;
		}

		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	}

	function handleDrop(event: DragEvent) {
		const files = fileListFromDataTransfer(event.dataTransfer);
		if (files.length === 0) {
			return;
		}

		event.preventDefault();
		onStageFiles(files);
	}

	function attachmentStatusType(attachment: AttachmentRecord) {
		if (attachment.parseStatus === 'failed') {
			return 'red';
		}

		if (attachment.parseStatus === 'ready') {
			return 'green';
		}

		return 'cool-gray';
	}

	function attachmentDetail(attachment: AttachmentRecord) {
		return (
			attachment.warnings[0] ?? `${attachment.mimeType} · ${formatFileSize(attachment.sizeBytes)}`
		);
	}

	function formatFileSize(sizeBytes: number) {
		if (sizeBytes >= 1024 * 1024) {
			return `${Math.round((sizeBytes / (1024 * 1024)) * 10) / 10} MB`;
		}

		if (sizeBytes >= 1024) {
			return `${Math.round((sizeBytes / 1024) * 10) / 10} KB`;
		}

		return `${sizeBytes} bytes`;
	}

	let {
		attachments,
		canSend,
		draft,
		hint,
		models,
		onAttach,
		onDraftChange,
		onModelChange,
		onReasoningChange,
		onRemoveAttachment,
		onSend,
		onShipSlice,
		onStageFiles,
		onStop,
		selectedModel,
		selectedModelKey,
		selectedReasoningLevel,
		threadStatus
	}: Props = $props();

	const modelItems = $derived.by<SelectItem[]>(() =>
		models.map((model) => ({ id: model.key, text: model.label }))
	);

	const reasoningItems = $derived.by<SelectItem[]>(() => {
		const levels =
			selectedModel?.availableThinkingLevels && selectedModel.availableThinkingLevels.length > 0
				? selectedModel.availableThinkingLevels
				: ['off'];
		return levels.filter(isThinkingLevel).map((level) => ({
			id: level,
			text: THINKING_LABELS[level]
		}));
	});
	const effectiveReasoningLevel = $derived.by<ThinkingLevel>(() => {
		const selectedLevel = reasoningItems.find((item) => item.id === selectedReasoningLevel)?.id;
		return (selectedLevel ?? reasoningItems[0]?.id ?? 'off') as ThinkingLevel;
	});

	const running = $derived(threadStatus === 'running');
	const startLabel = $derived(running ? 'Queue' : 'Start');
	let lastRequestedReasoningLevel = $state<ThinkingLevel | null>(null);

	$effect(() => {
		if (selectedReasoningLevel === effectiveReasoningLevel) {
			lastRequestedReasoningLevel = null;
			return;
		}

		if (lastRequestedReasoningLevel !== effectiveReasoningLevel) {
			lastRequestedReasoningLevel = effectiveReasoningLevel;
			onReasoningChange(effectiveReasoningLevel);
		}
	});
</script>

<section class="composer-panel">
	<div role="presentation" ondragover={handleDragOver} ondrop={handleDrop}>
		<TextArea
			disabled={!canSend}
			hideLabel
			labelText="Prompt"
			maxlength={4000}
			placeholder={hint}
			rows={3}
			value={draft}
			on:input={(event) => onDraftChange(readEventValue(event))}
			on:keydown={handleKeydown}
			on:paste={handlePaste}
		/>
	</div>

	{#if attachments.length > 0}
		<div class="attachment-strip">
			{#each attachments as attachment (attachment.id)}
				<div class="attachment-chip">
					<div>
						<p>{attachment.name}</p>
						<div class="attachment-chip__meta">
							<Tag size="sm" type={attachmentStatusType(attachment)}>{attachment.parseStatus}</Tag>
							<span>{attachmentDetail(attachment)}</span>
						</div>
					</div>
					<div class="attachment-chip__actions">
						{#if attachment.stage === 'staged'}
							<Tag size="sm" type="blue">staged</Tag>
						{/if}
						<Button kind="ghost" size="small" on:click={() => onRemoveAttachment(attachment.id)}>
							Remove
						</Button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<div class="composer-panel__footer">
		<div class="composer-panel__controls">
			<Button disabled={!running} icon={Stop} kind="ghost" size="small" on:click={onStop}>
				Stop
			</Button>
			<Button
				disabled={!canSend || !draft.trim()}
				icon={ArrowRight}
				kind="primary"
				size="small"
				on:click={() => onSend(running ? 'follow-up' : 'prompt')}
			>
				{startLabel}
			</Button>

			{#if modelItems.length > 0}
				<div class="composer-select" title="Model">
					<Dropdown
						hideLabel
						items={modelItems}
						label="Model"
						selectedId={selectedModelKey}
						size="sm"
						labelText="Model"
						on:select={handleModelSelect}
					/>
				</div>
			{:else}
				<div aria-live="polite" class="model-empty-state">
					<p>No models available</p>
				</div>
			{/if}

			<div class="composer-select" title="Reasoning">
				<Dropdown
					disabled={!canSend || !selectedModel?.supportsReasoning}
					hideLabel
					items={reasoningItems}
					label="Reasoning"
					selectedId={effectiveReasoningLevel}
					size="sm"
					labelText="Reasoning"
					on:select={handleReasoningSelect}
				/>
			</div>

			<Button disabled={!canSend} icon={Add} kind="ghost" size="small" on:click={onAttach}>
				Attach
			</Button>
			<Button
				disabled={!canSend}
				kind="ghost"
				size="small"
				title="Run validations, commit, push, create or update the PR, address review findings, and merge to main."
				on:click={onShipSlice}
			>
				Ship
			</Button>
		</div>
	</div>
</section>
