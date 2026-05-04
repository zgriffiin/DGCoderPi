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
	import type {
		CodexStatus,
		ModelOption,
		ProviderStatus,
		ResponseVerbosity,
		ReviewPolicy
	} from '$lib/types/workbench';
	import { readEventValue } from '$lib/workbench/read-event-value';
	import ThemeToggle from './ThemeToggle.svelte';

	type SettingsSection = 'accounts' | 'appearance' | 'extensions' | 'providers' | 'workflow';

	type Props = {
		blockTaskAdvanceOnReviewFindings: boolean;
		codex: CodexStatus;
		diffAnalysisModelKey: string | null;
		diagnosticLoggingEnabled: boolean;
		docparserEnabled: boolean;
		models: ModelOption[];
		onClose: () => void;
		onDiffAnalysisModelChange: (modelKey: string | null) => void;
		onImportCodexOpenAiKey: () => void;
		onProviderDraftChange: (provider: string, value: string) => void;
		onRefreshStatus: () => void;
		onResponseVerbosityChange: (value: ResponseVerbosity) => void;
		onReviewPolicyChange: (value: ReviewPolicy) => void;
		onSaveProvider: (provider: string) => void;
		onStartCodexLogin: () => void;
		onToggleBlockTaskAdvanceOnReviewFindings: (enabled: boolean) => void;
		onToggleDiagnosticLogging: (enabled: boolean) => void;
		onToggleDocparser: (enabled: boolean) => void;
		open: boolean;
		providerDrafts: Record<string, string>;
		providers: ProviderStatus[];
		responseVerbosity: ResponseVerbosity;
		reviewPolicy: ReviewPolicy;
	};

	let section = $state<SettingsSection>('accounts');

	function handleDocparserToggle(event: CustomEvent<{ toggled: boolean }>) {
		onToggleDocparser(event.detail.toggled);
	}

	function handleDiagnosticLoggingToggle(event: CustomEvent<{ toggled: boolean }>) {
		onToggleDiagnosticLogging(event.detail.toggled);
	}

	function handleBlockTaskAdvanceToggle(event: CustomEvent<{ toggled: boolean }>) {
		onToggleBlockTaskAdvanceOnReviewFindings(event.detail.toggled);
	}

	function providerSummary(providers: ProviderStatus[]) {
		const configured = providers.filter((provider) => provider.configured).length;
		return configured === 0 ? 'No providers configured' : `${configured} providers configured`;
	}

	let {
		blockTaskAdvanceOnReviewFindings,
		codex,
		diffAnalysisModelKey,
		diagnosticLoggingEnabled,
		docparserEnabled,
		models,
		onClose,
		onDiffAnalysisModelChange,
		onImportCodexOpenAiKey,
		onProviderDraftChange,
		onRefreshStatus,
		onResponseVerbosityChange,
		onReviewPolicyChange,
		onSaveProvider,
		onStartCodexLogin,
		onToggleBlockTaskAdvanceOnReviewFindings,
		onToggleDiagnosticLogging,
		onToggleDocparser,
		open,
		providerDrafts,
		providers,
		responseVerbosity,
		reviewPolicy
	}: Props = $props();

	const diffReviewModels = $derived(
		models.filter((model) => !model.key.startsWith('openai-codex::'))
	);
	const selectedDiffAnalysisModelKey = $derived(
		diffReviewModels.some((model) => model.key === diffAnalysisModelKey)
			? diffAnalysisModelKey
			: null
	);

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
				aria-pressed={section === 'workflow'}
				class="settings-nav__item"
				data-selected={section === 'workflow' ? 'true' : undefined}
				type="button"
				onclick={() => (section = 'workflow')}
			>
				Workflow
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
								<Tag type={selectedDiffAnalysisModelKey ? 'blue' : 'cool-gray'}>
									{selectedDiffAnalysisModelKey ? 'configured' : 'auto'}
								</Tag>
							</div>
							<div class="provider-row__controls">
								<Select
									id="diff-analysis-model"
									labelText="Diff review model"
									size="sm"
									value={selectedDiffAnalysisModelKey ?? ''}
									on:change={(event) => {
										const value = readEventValue(event);
										const trimmed = value.trim();
										onDiffAnalysisModelChange(trimmed ? trimmed : null);
									}}
								>
									<SelectItem text="Auto-select smallest available model" value="" />
									{#each diffReviewModels as model (model.key)}
										<SelectItem text={model.label} value={model.key} />
									{/each}
								</Select>
								<p>
									Codex login-only models are excluded. AI Review currently requires an API-backed
									model.
								</p>
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
			{:else if section === 'workflow'}
				<section class="settings-section">
					<header class="settings-section__header">
						<div>
							<h3>Workflow</h3>
							<p>Agent review policy, response density, and task-advance rules.</p>
						</div>
					</header>

					<div class="provider-list">
						<section class="provider-row">
							<div class="provider-row__header">
								<div>
									<h4>Review policy</h4>
									<p>Choose whether external review tooling is optional, disabled, or required.</p>
								</div>
								<Tag type={reviewPolicy === 'required' ? 'red' : 'blue'}>
									{reviewPolicy}
								</Tag>
							</div>
							<div class="provider-row__controls">
								<Select
									id="review-policy"
									labelText="Review policy"
									size="sm"
									value={reviewPolicy}
									on:change={(event) => onReviewPolicyChange(readEventValue(event) as ReviewPolicy)}
								>
									<SelectItem text="Fallback review tooling" value="fallback" />
									<SelectItem text="No external review tooling" value="off" />
									<SelectItem text="Require configured review tooling" value="required" />
								</Select>
								<p>
									<code>fallback</code> uses the strongest available review path.
									<code>required</code>
									blocks when the configured tool is unavailable. <code>off</code> disables external review-tool
									requirements.
								</p>
							</div>
						</section>

						<section class="provider-row">
							<div class="provider-row__header">
								<div>
									<h4>Caveman verbosity</h4>
									<p>
										Caveman response density for routine progress, failures, and review results.
									</p>
								</div>
								<Tag type="cool-gray">{responseVerbosity}</Tag>
							</div>
							<div class="provider-row__controls">
								<Select
									id="response-verbosity"
									labelText="Caveman verbosity"
									size="sm"
									value={responseVerbosity}
									on:change={(event) =>
										onResponseVerbosityChange(readEventValue(event) as ResponseVerbosity)}
								>
									<SelectItem text="Lite" value="lite" />
									<SelectItem text="Full" value="full" />
									<SelectItem text="Ultra" value="ultra" />
								</Select>
								<p>
									Default is <code>full</code>. <code>lite</code> is terse. <code>ultra</code> allows
									more detail when you want deeper reasoning in the visible output.
								</p>
							</div>
						</section>

						<section class="extension-row">
							<div>
								<h4>Block task advance on review findings</h4>
								<p>
									Disable later spec-stage runs while the current Implement or Review output still
									has unresolved blocker findings.
								</p>
							</div>
							<Toggle
								id="block-task-advance-toggle"
								labelA="Off"
								labelB="On"
								labelText="Block task advance on review findings"
								size="sm"
								toggled={blockTaskAdvanceOnReviewFindings}
								on:toggle={handleBlockTaskAdvanceToggle}
							/>
						</section>
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
							on:toggle={handleDocparserToggle}
						/>
					</div>

					<div class="extension-row">
						<div>
							<h4>Diagnostic logging</h4>
							<p>Log prompt, agent, tool, and timing events to the desktop console.</p>
						</div>
						<Toggle
							id="diagnostic-logging-toggle"
							labelA="Off"
							labelB="On"
							labelText="Diagnostic logging"
							size="sm"
							toggled={diagnosticLoggingEnabled}
							on:toggle={handleDiagnosticLoggingToggle}
						/>
					</div>
				</section>
			{/if}
		</div>
	</div>
</Modal>
