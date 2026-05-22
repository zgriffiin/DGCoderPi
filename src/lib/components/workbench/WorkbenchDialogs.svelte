<script lang="ts">
	import type { CodexStatus, ModelOption, ProviderStatus } from '$lib/types/workbench';
	import AddProjectModal from './AddProjectModal.svelte';
	import SettingsModal from './SettingsModal.svelte';

	type Props = {
		addProjectDraft: string;
		addProjectOpen: boolean;
		cavemanLevel: string;
		codex: CodexStatus;
		diffAnalysisModelKey: string | null;
		diagnosticLoggingEnabled: boolean;
		docparserEnabled: boolean;
		manualProjectPathOpen: boolean;
		maxContextPercent: number;
		models: ModelOption[];
		onAddProjectDraftChange: (value: string) => void;
		onAddProjectSubmit: () => void;
		onBrowseProject: () => void;
		onCavemanLevelChange: (level: string) => void;
		onCloseAddProject: () => void;
		onCloseSettings: VoidFunction;
		onDiffAnalysisModelChange: (modelKey: string | null) => void;
		onImportCodexOpenAiKey: VoidFunction;
		onMaxContextPercentChange: (percent: number) => void;
		onProviderDraftChange: (provider: string, value: string) => void;
		onRefreshStatus: VoidFunction;
		onSaveProvider: (provider: string) => void;
		onStartCodexLogin: VoidFunction;
		onToggleDiagnosticLogging: (enabled: boolean) => void;
		onToggleDocparser: (enabled: boolean) => void;
		onToggleManualPath: () => void;
		providerDrafts: Record<string, string>;
		providers: ProviderStatus[];
		runtimeAvailable: boolean;
		settingsOpen: boolean;
	};

	let {
		addProjectDraft,
		addProjectOpen,
		cavemanLevel,
		codex,
		diffAnalysisModelKey,
		diagnosticLoggingEnabled,
		docparserEnabled,
		manualProjectPathOpen,
		maxContextPercent,
		models,
		onAddProjectDraftChange,
		onAddProjectSubmit,
		onBrowseProject,
		onCavemanLevelChange,
		onCloseAddProject,
		onCloseSettings,
		onDiffAnalysisModelChange,
		onImportCodexOpenAiKey,
		onMaxContextPercentChange,
		onProviderDraftChange,
		onRefreshStatus,
		onSaveProvider,
		onStartCodexLogin,
		onToggleDiagnosticLogging,
		onToggleDocparser,
		onToggleManualPath,
		providerDrafts,
		providers,
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
	{cavemanLevel}
	{codex}
	{diffAnalysisModelKey}
	{diagnosticLoggingEnabled}
	{docparserEnabled}
	{maxContextPercent}
	onClose={onCloseSettings}
	{onCavemanLevelChange}
	{onDiffAnalysisModelChange}
	{onImportCodexOpenAiKey}
	{onMaxContextPercentChange}
	{onProviderDraftChange}
	{onRefreshStatus}
	{onSaveProvider}
	{onStartCodexLogin}
	{onToggleDiagnosticLogging}
	{onToggleDocparser}
	{models}
	open={settingsOpen}
	{providerDrafts}
	{providers}
/>
