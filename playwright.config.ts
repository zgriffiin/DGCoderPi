import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'pnpm build && pnpm preview --host 0.0.0.0',
		port: 4173,
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.browser.e2e.{ts,js}'
});
