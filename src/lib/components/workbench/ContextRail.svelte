<script lang="ts">
	import { Button, Tag, TextInput, Toggle } from 'carbon-components-svelte';
	import type { AppHealth, ProviderStatus, ThreadRecord } from '$lib/types/workbench';
	import { readEventValue } from '$lib/workbench/read-event-value';

	type Props = {
		health: AppHealth;
		onProviderDraftChange: (provider: string, value: string) => void;
		onSaveProvider: (provider: string) => void;
		onToggleDocparser: (enabled: boolean) => void;
		providerDrafts: Record<string, string>;
		providers: ProviderStatus[];
		thread: ThreadRecord | null;
		docparserEnabled: boolean;
	};

	function handleDocparserToggle(event: CustomEvent<{ toggled: boolean }>) {
		onToggleDocparser(event.detail.toggled);
	}

	let {
		health,
		onProviderDraftChange,
		onSaveProvider,
		onToggleDocparser,
		providerDrafts,
		providers,
		thread,
		docparserEnabled
	}: Props = $props();
</script>

<aside class="context-rail surface">
	<div class="rail-header">
		<div>
			<p class="eyebrow">Runtime</p>
			<h2>{health.bridgeStatus}</h2>
		</div>
	</div>

	<section class="context-section">
		<div class="context-card">
			<div class="context-card__header">
				<Tag size="sm" type="blue">{health.modelCount} models</Tag>
				<Tag size="sm" type="green">{health.configuredProviderCount} providers</Tag>
			</div>
			<p>The hidden Pi bridge owns model discovery and session transport.</p>
		</div>
	</section>

	<section class="context-section">
		<div class="context-section__header">
			<p class="eyebrow">Feature toggles</p>
		</div>
		<div class="context-card">
			<Toggle
				id="docparser-toggle"
				labelA="Off"
				labelB="On"
				labelText="Document parser"
				size="sm"
				toggled={docparserEnabled}
				on:toggle={handleDocparserToggle}
			/>
			<p>Enable direct parsing for PDFs, Office documents, spreadsheets, CSV, and images.</p>
		</div>
	</section>

	<section class="context-section">
		<div class="context-section__header">
			<p class="eyebrow">Providers</p>
		</div>
		<div class="provider-list">
			{#each providers as provider (provider.provider)}
				<div class="context-card">
					<div class="context-card__header">
						<Tag size="sm" type={provider.configured ? 'green' : 'cool-gray'}>
							{provider.configured ? 'configured' : 'missing'}
						</Tag>
						<span>{provider.label}</span>
					</div>
					<TextInput
						labelText={`${provider.label} API key`}
						placeholder="Paste API key"
						size="sm"
						type="password"
						value={providerDrafts[provider.provider] ?? ''}
						on:input={(event) => onProviderDraftChange(provider.provider, readEventValue(event))}
					/>
					<div class="provider-actions">
						<Button kind="ghost" size="small" on:click={() => onSaveProvider(provider.provider)}>
							Save key
						</Button>
						{#if provider.source}
							<span>{provider.source}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="context-section">
		<div class="context-section__header">
			<p class="eyebrow">Attachments</p>
		</div>
		{#if thread && thread.attachments.length > 0}
			<ul class="context-list">
				{#each thread.attachments as attachment (attachment.id)}
					<li class="context-card">
						<div class="context-card__header">
							<Tag size="sm" type={attachment.stage === 'staged' ? 'blue' : 'cool-gray'}>
								{attachment.stage}
							</Tag>
							<Tag
								size="sm"
								type={attachment.parseStatus === 'ready'
									? 'green'
									: attachment.parseStatus === 'failed'
										? 'red'
										: 'cool-gray'}
							>
								{attachment.parseStatus}
							</Tag>
						</div>
						<h3>{attachment.name}</h3>
						<p>{attachment.mimeType}</p>
						{#if attachment.previewText}
							<p class="attachment-preview">{attachment.previewText}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<div class="empty-panel">
				<p>No attachments staged.</p>
				<span>Use the composer to add files or paste clipboard content.</span>
			</div>
		{/if}
	</section>
</aside>
