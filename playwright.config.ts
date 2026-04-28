import { defineConfig } from '@playwright/test';

export default defineConfig({
	outputDir: 'tests/results/browser',
	testDir: 'tests/e2e',
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 5182,
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.browser.e2e.{ts,js}'
});
