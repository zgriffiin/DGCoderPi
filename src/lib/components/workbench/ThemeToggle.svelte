<script lang="ts">
	import { Toggle } from 'carbon-components-svelte';
	import { setTheme, theme } from '$lib/theme/theme';

	function handleToggle(event: CustomEvent<{ toggled: boolean }>) {
		setTheme(event.detail.toggled ? 'g100' : 'g10');
	}
</script>

<div class="theme-toggle">
	<span class="theme-toggle__label">Theme</span>

	<Toggle
		hideLabel
		id="theme-toggle"
		labelA="Light"
		labelB="Dark"
		labelText="Theme"
		size="sm"
		toggled={$theme === 'g100'}
		on:toggle={handleToggle}
	/>
</div>
