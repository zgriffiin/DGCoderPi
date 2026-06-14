import { defineConfig } from '@playwright/test';

export default defineConfig({
	outputDir: 'tests/results/desktop',
	testDir: 'tests/e2e',
	testMatch: '**/*.desktop.e2e.{ts,js}',
	// The desktop workflow drives a real Tauri runtime and live agent backend, so allow one retry to
	// absorb transient backend latency without masking genuine regressions.
	retries: 1,
	workers: 1
});
