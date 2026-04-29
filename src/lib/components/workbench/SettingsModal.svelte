<script lang="ts">
	import {
		Button,
		Modal,
		Select,
		SelectItem,
		Tag,
		TextInput,
		Toggle
	} from 'carbon-components-svelte';
	import type { CodexStatus, ModelOption, ProviderStatus } from '$lib/types/workbench';
	import { readEventValue } from '$lib/workbench/read-event-value';
	import ThemeToggle from './ThemeToggle.svelte';

	type SettingsSection = 'accounts' | 'appearance' | 'extensions' | 'providers';

	type Props = {
		codex: CodexStatus;
		diffAnalysisModelKey: string | null;
		docparserEnabled: boolean;
		models: ModelOption[];
		onClose: () => void;
		onDiffAnalysisModelChange: (modelKey: string | null) => void;
		onImportCodexOpenAiKey: () => void;
		onProviderDraftChange: (provider: string, value: string) => void;
		onRefreshStatus: () => void;
		onSaveProvider: (provider: string) => void;
		onStartCodexLogin: () => void;
		onToggleDocparser: (enabled: boolean) => void;
		open: boolean;
		providerDrafts: Record<string, string>;
		providers: ProviderStatus[];
	};

	let section = $state<SettingsSection>('accounts');

	function handleToggle(event: CustomEvent<{ toggled: boolean }>) {
		onToggleDocparser(event.detail.toggled);
	}

	function providerSummary(providers: ProviderStatus[]) {
		const configured = providers.filter((provider) => provider.configured).length;
		return configured === 0 ? 'No providers configured' : `${configured} providers configured`;
	}

	let {
		codex,
		diffAnalysisModelKey,
		docparserEnabled,
		models,
		onClose,
		onDiffAnalysisModelChange,
		onImportCodexOpenAiKey,
		onProviderDraftChange,
		onRefreshStatus,
		onSaveProvider,
		onStartCodexLogin,
		onToggleDocparser,
		open,
		providerDrafts,
		providers
	}: Props = $props();

	$effect(() => {
		if (open) {
			section = 'accounts';
		}
	});
</script>

<Modal passiveModal size="lg" {open} modalHeading="Settings" on:close={onClose}>
	<div class="settings-layout">
		<nav aria-label="Settings sections" class="settings-nav">
			<button
				aria-pressed={section === 'accounts'}
				class="settings-nav__item"
				data-selected={section === 'accounts' ? 'true' : undefined}
				type="button"
				onclick={() => (section = 'accounts')}
			>
				Accounts
			</button>
			<button
				aria-pressed={section === 'providers'}
				class="settings-nav__item"
				data-selected={section === 'providers' ? 'true' : undefined}
				type="button"
				onclick={() => (section = 'providers')}
			>
				Providers
			</button>
			<button
				aria-pressed={section === 'appearance'}
				class="settings-nav__item"
				data-selected={section === 'appearance' ? 'true' : undefined}
				type="button"
				onclick={() => (section = 'appearance')}
			>
				Appearance
			</button>
			<button
				aria-pressed={section === 'extensions'}
				class="settings-nav__item"
				data-selected={section === 'extensions' ? 'true' : undefined}
				type="button"
				onclick={() => (section = 'extensions')}
			>
				Extensions
			</button>
		</nav>

		<div class="settings-panel">
			{#if section === 'accounts'}
				<section class="settings-section">
					<header class="settings-section__header">
						<div>
							<h3>Codex</h3>
							<p>{codex.displayStatus}</p>
						</div>
						<div class="settings-card__tags">
							<Tag type={codex.available ? 'green' : 'cool-gray'}>
								{codex.available ? 'installed' : 'missing'}
							</Tag>
							<Tag type={codex.authenticated ? 'blue' : 'cool-gray'}>
								{codex.authenticated ? 'signed in' : 'signed out'}
							</Tag>
						</div>
					</header>

					<dl class="settings-detail-list">
						<div>
							<dt>Mode</dt>
							<dd>{codex.authMode ?? 'unknown'}</dd>
						</div>
						<div>
							<dt>CLI</dt>
							<dd>{codex.cliPath ?? 'Not installed'}</dd>
						</div>
						<div>
							<dt>OpenAI key import</dt>
							<dd>{codex.canImportOpenAiKey ? 'Available' : 'Not available'}</dd>
						</div>
					</dl>

					<div class="settings-inline-actions">
						{#if codex.available}
							<Button kind="secondary" size="small" on:click={onStartCodexLogin}>
								Connect ChatGPT
							</Button>
							<Button kind="ghost" size="small" on:click={onRefreshStatus}>Refresh status</Button>
						{/if}
						{#if codex.canImportOpenAiKey}
							<Button kind="secondary" size="small" on:click={onImportCodexOpenAiKey}>
								Use Codex OpenAI key
							</Button>
						{/if}
						{#if codex.available && !codex.authenticated}
							<p>
								Connect launches the official <code>codex login</code> flow in a terminal window.
							</p>
						{/if}
					</div>
				</section>
			{:else if section === 'providers'}
				<section class="settings-section">
					<header class="settings-section__header">
						<div>
							<h3>Providers</h3>
							<p>{providerSummary(providers)}</p>
						</div>
					</header>

					<div class="provider-list">
						<section class="provider-row">
							<div class="provider-row__header">
								<div>
									<h4>Diff review model</h4>
									<p>Used for AI Review in the diff inspector.</p>
								</div>
								<Tag type={diffAnalysisModelKey ? 'blue' : 'cool-gray'}>
									{diffAnalysisModelKey ? 'configured' : 'auto'}
								</Tag>
							</div>
							<div class="provider-row__controls">
								<Select
									id="diff-analysis-model"
									labelText="Diff review model"
									size="sm"
									value={diffAnalysisModelKey ?? ''}
									on:change={(event) => {
										const value = readEventValue(event);
										const trimmed = value.trim();
										onDiffAnalysisModelChange(trimmed ? trimmed : null);
									}}
								>
									<SelectItem text="Auto-select smallest available model" value="" />
									{#each models as model (model.key)}
										<SelectItem text={model.label} value={model.key} />
									{/each}
								</Select>
							</div>
						</section>

						{#each providers as provider (provider.provider)}
							<section class="provider-row">
								<div class="provider-row__header">
									<div>
										<h4>{provider.label}</h4>
										<p>{provider.source ?? 'Manual key'}</p>
									</div>
									<Tag type={provider.configured ? 'green' : 'cool-gray'}>
										{provider.configured ? 'configured' : 'missing'}
									</Tag>
								</div>

								{#if provider.provider === 'openai-codex'}
									<div class="provider-row__controls">
										<p>
											Managed by Codex CLI login. Use the Accounts tab to connect or reconnect your
											ChatGPT subscription.
										</p>
									</div>
								{:else}
									<div class="provider-row__controls">
										<TextInput
											labelText={`${provider.label} API key`}
											placeholder="Paste API key"
											size="sm"
											type="password"
											value={providerDrafts[provider.provider] ?? ''}
											on:input={(event) =>
												onProviderDraftChange(provider.provider, readEventValue(event))}
										/>
										<Button
											kind="ghost"
											size="small"
											on:click={() => onSaveProvider(provider.provider)}
										>
											Save
										</Button>
									</div>
								{/if}
							</section>
						{/each}
					</div>
				</section>
			{:else if section === 'appearance'}
				<section class="settings-section">
					<header class="settings-section__header">
						<div>
							<h3>Appearance</h3>
							<p>Workbench theme and surface density</p>
						</div>
					</header>

					<div class="extension-row">
						<div>
							<h4>Theme</h4>
							<p>Switch between Carbon light and dark themes.</p>
						</div>
						<ThemeToggle />
					</div>
				</section>
			{:else}
				<section class="settings-section">
					<header class="settings-section__header">
						<div>
							<h3>Extensions</h3>
							<p>Attachment parsing and local helpers</p>
						</div>
					</header>

					<div class="extension-row">
						<div>
							<h4>Document parser</h4>
							<p>Enable direct parsing for PDFs, Office files, spreadsheets, and images.</p>
						</div>
						<Toggle
							id="docparser-toggle"
							labelA="Off"
							labelB="On"
							labelText="Document parser"
							size="sm"
							toggled={docparserEnabled}
							on:toggle={handleToggle}
						/>
					</div>
				</section>
			{/if}
		</div>
	</div>
</Modal>
