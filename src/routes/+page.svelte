<script lang="ts">
	import AppShell from '$lib/components/workbench/AppShell.svelte';
	import { referenceWorkbenchData } from '$lib/data/reference-workspace';
</script>

<svelte:head>
	<title>DGCoder Pi</title>
	<meta
		content="Desktop workbench scaffold for Pi-driven coding tasks, built with SvelteKit, Carbon, and Tauri."
		name="description"
	/>
</svelte:head>

<AppShell data={referenceWorkbenchData} />
