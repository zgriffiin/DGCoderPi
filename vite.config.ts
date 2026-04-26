import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { optimizeCss } from 'carbon-preprocess-svelte';

export default defineConfig({
	plugins: [sveltekit(), optimizeCss()],
	optimizeDeps: {
		include: [
			'carbon-components-svelte/src/Button/Button.svelte',
			'carbon-components-svelte/src/ContentSwitcher/ContentSwitcher.svelte',
			'carbon-components-svelte/src/ContentSwitcher/Switch.svelte',
			'carbon-components-svelte/src/Dropdown/Dropdown.svelte',
			'carbon-components-svelte/src/Notification/InlineNotification.svelte',
			'carbon-components-svelte/src/ProgressBar/ProgressBar.svelte',
			'carbon-components-svelte/src/Search/Search.svelte',
			'carbon-components-svelte/src/Tag/Tag.svelte',
			'carbon-components-svelte/src/TextArea/TextArea.svelte',
			'carbon-components-svelte/src/Toggle/Toggle.svelte',
			'carbon-icons-svelte/lib/ArrowRight.svelte',
			'carbon-icons-svelte/lib/Document.svelte',
			'carbon-icons-svelte/lib/DocumentTasks.svelte',
			'carbon-icons-svelte/lib/DocumentView.svelte',
			'carbon-icons-svelte/lib/FolderDetails.svelte'
		]
	},
	test: {
		expect: {
			requireAssertions: true
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [
							{
								browser: 'chromium',
								headless: true
							}
						]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
