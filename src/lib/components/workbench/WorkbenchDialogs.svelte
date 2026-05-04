<script lang="ts">
	import type {
		CodexStatus,
		ModelOption,
		ProviderStatus,
		ResponseVerbosity,
		ReviewPolicy
	} from '$lib/types/workbench';
	import AddProjectModal from './AddProjectModal.svelte';
	import SettingsModal from './SettingsModal.svelte';

	type Props = {
		addProjectDraft: string;
		addProjectOpen: boolean;
		blockTaskAdvanceOnReviewFindings: boolean;
		codex: CodexStatus;
		diffAnalysisModelKey: string | null;
		diagnosticLoggingEnabled: boolean;
		docparserEnabled: boolean;
		manualProjectPathOpen: boolean;
		models: ModelOption[];
		onAddProjectDraftChange: (value: string) => void;
		onAddProjectSubmit: () => void;
		onBrowseProject: () => void;
		onCloseAddProject: () => void;
		onCloseSettings: VoidFunction;
		onDiffAnalysisModelChange: (modelKey: string | null) => void;
		onImportCodexOpenAiKey: VoidFunction;
		onProviderDraftChange: (provider: string, value: string) => void;
		onRefreshStatus: VoidFunction;
		onResponseVerbosityChange: (value: ResponseVerbosity) => void;
		onReviewPolicyChange: (value: ReviewPolicy) => void;
		onSaveProvider: (provider: string) => void;
		onStartCodexLogin: VoidFunction;
		onToggleBlockTaskAdvanceOnReviewFindings: (enabled: boolean) => void;
		onToggleDiagnosticLogging: (enabled: boolean) => void;
		onToggleDocparser: (enabled: boolean) => void;
		onToggleManualPath: () => void;
		providerDrafts: Record<string, string>;
		providers: ProviderStatus[];
		responseVerbosity: ResponseVerbosity;
		reviewPolicy: ReviewPolicy;
		runtimeAvailable: boolean;
		settingsOpen: boolean;
	};

	let {
		addProjectDraft,
		addProjectOpen,
		blockTaskAdvanceOnReviewFindings,
		codex,
		diffAnalysisModelKey,
		diagnosticLoggingEnabled,
		docparserEnabled,
		manualProjectPathOpen,
		models,
		onAddProjectDraftChange,
		onAddProjectSubmit,
		onBrowseProject,
		onCloseAddProject,
		onCloseSettings,
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
		onToggleManualPath,
		providerDrafts,
		providers,
		responseVerbosity,
		reviewPolicy,
		runtimeAvailable,
		settingsOpen
	}: Props = $props();
</script>

<AddProjectModal
	draftPath={addProjectDraft}
	manualPathOpen={manualProjectPathOpen}
	onBrowse={onBrowseProject}
	onClose={onCloseAddProject}
	onDraftPathChange={onAddProjectDraftChange}
	onSubmit={onAddProjectSubmit}
	{onToggleManualPath}
	open={addProjectOpen}
	{runtimeAvailable}
/>

<SettingsModal
	{codex}
	{diffAnalysisModelKey}
	{diagnosticLoggingEnabled}
	{docparserEnabled}
	{blockTaskAdvanceOnReviewFindings}
	onClose={onCloseSettings}
	{onDiffAnalysisModelChange}
	{onImportCodexOpenAiKey}
	{onProviderDraftChange}
	{onRefreshStatus}
	{onResponseVerbosityChange}
	{onReviewPolicyChange}
	{onSaveProvider}
	{onStartCodexLogin}
	{onToggleBlockTaskAdvanceOnReviewFindings}
	{onToggleDiagnosticLogging}
	{onToggleDocparser}
	{models}
	open={settingsOpen}
	{providerDrafts}
	{providers}
	{responseVerbosity}
	{reviewPolicy}
/>
