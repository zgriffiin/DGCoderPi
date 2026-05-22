<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import Add from 'carbon-icons-svelte/lib/Add.svelte';
	import Code from 'carbon-icons-svelte/lib/Code.svelte';
	import DocumentRequirements from 'carbon-icons-svelte/lib/DocumentRequirements.svelte';
	import SidePanelOpen from 'carbon-icons-svelte/lib/SidePanelOpen.svelte';
	import Settings from 'carbon-icons-svelte/lib/Settings.svelte';
	import Terminal from 'carbon-icons-svelte/lib/Terminal.svelte';
	import type { InspectorMode } from '$lib/types/workbench';

	type Props = {
		inspectorMode: InspectorMode | null;
		onAddProject: () => void;
		onOpenSettings: () => void;
		onToggleInspector: (mode: InspectorMode) => void;
		onToggleProjectRail: () => void;
		projectRailVisible: boolean;
		runtimeAvailable: boolean;
	};

	let {
		inspectorMode,
		onAddProject,
		onOpenSettings,
		onToggleInspector,
		onToggleProjectRail,
		projectRailVisible,
		runtimeAvailable
	}: Props = $props();
</script>

<header class="topbar">
	<div class="topbar__left">
		<Button
			aria-label={projectRailVisible ? 'Hide project panel' : 'Show project panel'}
			aria-pressed={projectRailVisible}
			icon={SidePanelOpen}
			kind={projectRailVisible ? 'ghost' : 'primary'}
			size="small"
			onclick={onToggleProjectRail}
		/>
		<Button
			disabled={!runtimeAvailable}
			icon={Add}
			kind="ghost"
			size="small"
			onclick={onAddProject}
		>
			Add project
		</Button>
	</div>

	<div class="topbar__actions">
		<Button
			aria-pressed={inspectorMode === 'diff'}
			icon={Code}
			kind={inspectorMode === 'diff' ? 'primary' : 'ghost'}
			size="small"
			onclick={() => onToggleInspector('diff')}
		>
			Diff
		</Button>
		<Button
			aria-pressed={inspectorMode === 'spec'}
			icon={DocumentRequirements}
			kind={inspectorMode === 'spec' ? 'primary' : 'ghost'}
			size="small"
			onclick={() => onToggleInspector('spec')}
		>
			Spec
		</Button>
		<Button
			aria-pressed={inspectorMode === 'terminal'}
			icon={Terminal}
			kind={inspectorMode === 'terminal' ? 'primary' : 'ghost'}
			size="small"
			onclick={() => onToggleInspector('terminal')}
		>
			Terminal
		</Button>
		<Button icon={Settings} kind="ghost" size="small" onclick={onOpenSettings}>Settings</Button>
	</div>
</header>
