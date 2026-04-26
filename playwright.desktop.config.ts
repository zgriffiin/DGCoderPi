import { defineConfig } from '@playwright/test';

export default defineConfig({
	testMatch: '**/*.desktop.e2e.{ts,js}',
	workers: 1
});
