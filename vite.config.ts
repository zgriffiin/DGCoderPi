import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { optimizeCss } from 'carbon-preprocess-svelte';

const DEV_PORT = 5182;

export default defineConfig({
	plugins: [sveltekit(), optimizeCss()],
	server: {
		host: '127.0.0.1',
		port: DEV_PORT,
		strictPort: true
	},
	preview: {
		host: '127.0.0.1',
		port: DEV_PORT,
		strictPort: true
	},
	optimizeDeps: {
		include: [
			'@tauri-apps/api/core',
			'@tauri-apps/api/event',
			'@tauri-apps/plugin-dialog',
			'carbon-components-svelte/src/Button/Button.svelte',
			'carbon-components-svelte/src/Dropdown/Dropdown.svelte',
			'carbon-components-svelte/src/Modal/Modal.svelte',
			'carbon-components-svelte/src/Notification/InlineNotification.svelte',
			'carbon-components-svelte/src/Search/Search.svelte',
			'carbon-components-svelte/src/Tag/Tag.svelte',
			'carbon-components-svelte/src/TextArea/TextArea.svelte',
			'carbon-components-svelte/src/TextInput/TextInput.svelte',
			'carbon-components-svelte/src/Tile/Tile.svelte',
			'carbon-components-svelte/src/Toggle/Toggle.svelte',
			'carbon-icons-svelte/lib/Add.svelte',
			'carbon-icons-svelte/lib/ArrowRight.svelte',
			'carbon-icons-svelte/lib/Close.svelte',
			'carbon-icons-svelte/lib/Code.svelte',
			'carbon-icons-svelte/lib/DocumentRequirements.svelte',
			'carbon-icons-svelte/lib/FolderOpen.svelte',
			'carbon-icons-svelte/lib/Settings.svelte',
			'carbon-icons-svelte/lib/StopFilledAlt.svelte',
			'carbon-icons-svelte/lib/Task.svelte'
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
