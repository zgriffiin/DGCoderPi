<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import 'carbon-components-svelte/css/all.css';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
