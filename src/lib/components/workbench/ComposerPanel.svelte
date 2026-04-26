<script lang="ts">
	import { Button, Dropdown, Tag, TextArea } from 'carbon-components-svelte';
	import Add from 'carbon-icons-svelte/lib/Add.svelte';
	import ArrowRight from 'carbon-icons-svelte/lib/ArrowRight.svelte';
	import Stop from 'carbon-icons-svelte/lib/StopFilledAlt.svelte';
	import { readEventValue } from '$lib/workbench/read-event-value';
	import type {
		AttachmentRecord,
		ModelOption,
		PromptMode,
		ThreadRecord
	} from '$lib/types/workbench';

	type Props = {
		attachments: AttachmentRecord[];
		draft: string;
		models: ModelOption[];
		onDraftChange: (value: string) => void;
		onFileDialogOpen: () => void;
		onFilesSelected: (files: FileList | null) => void;
		onModelChange: (modelKey: string) => void;
		onRemoveAttachment: (attachmentId: string) => void;
		onSend: (mode: PromptMode) => void;
		onStop: () => void;
		selectedModelKey: string;
		statusMessage: string;
		threadStatus: ThreadRecord['status'];
	};

	type ModelItem = {
		id: string;
		text: string;
	};

	function handleModelSelect(event: CustomEvent<{ selectedId: string }>) {
		onModelChange(event.detail.selectedId);
	}

	async function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.files;
		if (!items || items.length === 0) {
			return;
		}

		event.preventDefault();
		onFilesSelected(items);
	}

	function handleFileInput(event: Event) {
		const input = event.target as HTMLInputElement;
		onFilesSelected(input.files);
		input.value = '';
	}

	let fileInput: HTMLInputElement | null = null;

	let {
		attachments,
		draft,
		models,
		onDraftChange,
		onFileDialogOpen,
		onFilesSelected,
		onModelChange,
		onRemoveAttachment,
		onSend,
		onStop,
		selectedModelKey,
		statusMessage,
		threadStatus
	}: Props = $props();

	const modelItems = $derived.by<ModelItem[]>(() => {
		return models.map((model) => ({ id: model.key, text: `${model.label} (${model.provider})` }));
	});
</script>

<section class="composer-panel surface">
	<div class="composer-panel__controls">
		<Dropdown
			items={modelItems}
			labelText="Model"
			selectedId={selectedModelKey}
			size="sm"
			on:select={handleModelSelect}
		/>

		<div class="composer-panel__pills">
			<input
				bind:this={fileInput}
				accept="*/*"
				class="visually-hidden"
				multiple
				type="file"
				onchange={handleFileInput}
			/>
			<Button
				icon={Add}
				kind="ghost"
				size="small"
				on:click={() => {
					onFileDialogOpen();
					fileInput?.click();
				}}
			>
				Attach files
			</Button>
			{#if threadStatus === 'running'}
				<Button kind="ghost" size="small" on:click={() => onSend('steer')}>Queue steer</Button>
				<Button kind="ghost" size="small" on:click={() => onSend('follow-up')}>
					Queue follow-up
				</Button>
			{/if}
		</div>
	</div>

	<TextArea
		helperText="Ctrl+V supports pasted files and images when the desktop runtime exposes them."
		labelText="Prompt Pi"
		maxCount={4000}
		placeholder="Describe the next coding task, review, or steering instruction."
		rows={5}
		value={draft}
		on:input={(event) => onDraftChange(readEventValue(event))}
		on:paste={handlePaste}
	/>

	{#if attachments.length > 0}
		<div class="attachment-strip">
			{#each attachments as attachment (attachment.id)}
				<div class="attachment-chip">
					<div>
						<p>{attachment.name}</p>
						<span>{attachment.kind} · {attachment.parseStatus}</span>
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
		<p>{statusMessage}</p>
		<div class="composer-panel__actions">
			<Button icon={Stop} kind="ghost" size="small" on:click={onStop}>Stop</Button>
			<Button icon={ArrowRight} kind="primary" size="small" on:click={() => onSend('prompt')}>
				Send to Pi
			</Button>
		</div>
	</div>
</section>
