<script lang="ts">
	import { Button, InlineNotification, Modal, TextInput } from 'carbon-components-svelte';
	import FolderOpen from 'carbon-icons-svelte/lib/FolderOpen.svelte';
	import { readEventValue } from '$lib/workbench/read-event-value';

	type Props = {
		draftPath: string;
		manualPathOpen: boolean;
		onBrowse: () => void;
		onClose: () => void;
		onDraftPathChange: (value: string) => void;
		onSubmit: () => void;
		onToggleManualPath: () => void;
		open: boolean;
		runtimeAvailable: boolean;
	};

	let {
		draftPath,
		manualPathOpen,
		onBrowse,
		onClose,
		onDraftPathChange,
		onSubmit,
		onToggleManualPath,
		open,
		runtimeAvailable
	}: Props = $props();
</script>

<Modal passiveModal size="sm" {open} modalHeading="Add project" on:close={onClose}>
	<div class="modal-stack">
		<Button
			disabled={!runtimeAvailable}
			icon={FolderOpen}
			kind="primary"
			size="small"
			on:click={onBrowse}
		>
			Open folder
		</Button>

		{#if draftPath}
			<div class="modal-selection">
				<p>Selected</p>
				<span>{draftPath}</span>
			</div>
		{/if}

		<Button kind="ghost" size="small" on:click={onToggleManualPath}>
			{manualPathOpen ? 'Hide path entry' : 'Paste path'}
		</Button>

		{#if manualPathOpen}
			<div class="modal-stack">
				<TextInput
					labelText="Repository path"
					placeholder="C:\\Repos\\project"
					size="sm"
					value={draftPath}
					on:input={(event) => onDraftPathChange(readEventValue(event))}
				/>
				<Button disabled={!draftPath.trim()} kind="tertiary" size="small" on:click={onSubmit}>
					Add from path
				</Button>
			</div>
		{/if}

		{#if !runtimeAvailable}
			<InlineNotification
				hideCloseButton
				kind="warning"
				lowContrast
				subtitle="Folder browsing only works in the Tauri desktop shell."
				title="Desktop only"
			/>
		{/if}
	</div>
</Modal>
