<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import Add from 'carbon-icons-svelte/lib/Add.svelte';
	import Code from 'carbon-icons-svelte/lib/Code.svelte';
	import DocumentRequirements from 'carbon-icons-svelte/lib/DocumentRequirements.svelte';
	import Settings from 'carbon-icons-svelte/lib/Settings.svelte';
	import Task from 'carbon-icons-svelte/lib/Task.svelte';
	import type { InspectorMode } from '$lib/types/workbench';

	type Props = {
		inspectorMode: InspectorMode | null;
		onAddProject: () => void;
		onOpenSettings: () => void;
		onToggleInspector: (mode: InspectorMode) => void;
		runtimeAvailable: boolean;
	};

	let { inspectorMode, onAddProject, onOpenSettings, onToggleInspector, runtimeAvailable }: Props =
		$props();
</script>

<header class="topbar">
	<div class="topbar__brand">
		<div class="brand-mark">PI</div>
		<div class="topbar__title">
			<h1>DGCoder Pi</h1>
		</div>
	</div>

	<div class="topbar__actions">
		<Button
			disabled={!runtimeAvailable}
			icon={Add}
			kind="secondary"
			size="small"
			onclick={onAddProject}
		>
			Add project
		</Button>
		<Button
			aria-pressed={inspectorMode === 'tasks'}
			icon={Task}
			kind={inspectorMode === 'tasks' ? 'primary' : 'ghost'}
			size="small"
			onclick={() => onToggleInspector('tasks')}
		>
			Tasks
		</Button>
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
		<Button icon={Settings} kind="ghost" size="small" onclick={onOpenSettings}>Settings</Button>
	</div>
</header>
