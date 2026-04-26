<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AppShell from '$lib/components/workbench/AppShell.svelte';
	import { referenceWorkbenchData } from '$lib/data/reference-workspace';

	const { Story } = defineMeta({
		title: 'Workbench/AppShell',
		component: AppShell,
		tags: ['autodocs'],
		args: {
			data: referenceWorkbenchData
		}
	});
</script>

<Story name="Default" />
