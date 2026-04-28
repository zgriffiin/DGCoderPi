import { defineConfig } from '@playwright/test';

export default defineConfig({
	outputDir: 'tests/results/desktop',
	testDir: 'tests/e2e',
	testMatch: '**/*.desktop.e2e.{ts,js}',
	workers: 1
});
