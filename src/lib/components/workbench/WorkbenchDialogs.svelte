<script lang="ts">
	import type { CodexStatus, ModelOption, ProviderStatus } from '$lib/types/workbench';
	import AddProjectModal from './AddProjectModal.svelte';
	import SettingsModal from './SettingsModal.svelte';

	type Props = {
		addProjectDraft: string;
		addProjectOpen: boolean;
		codex: CodexStatus;
		diffAnalysisModelKey: string | null;
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
		onSaveProvider: (provider: string) => void;
		onStartCodexLogin: VoidFunction;
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
		codex,
		diffAnalysisModelKey,
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
		onSaveProvider,
		onStartCodexLogin,
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
	{codex}
	{diffAnalysisModelKey}
	{docparserEnabled}
	onClose={onCloseSettings}
	{onDiffAnalysisModelChange}
	{onImportCodexOpenAiKey}
	{onProviderDraftChange}
	{onRefreshStatus}
	{onSaveProvider}
	{onStartCodexLogin}
	{onToggleDocparser}
	{models}
	open={settingsOpen}
	{providerDrafts}
	{providers}
/>
