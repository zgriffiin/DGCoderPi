import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';

const DESKTOP_DEBUG_URL = 'http://127.0.0.1:9333';
const DESKTOP_PAGE_URL_PREFIX = 'http://localhost:';

test.skip(process.platform !== 'win32', 'Desktop runtime verification is Windows-only.');

async function getDesktopPage() {
	const browser = await chromium.connectOverCDP(DESKTOP_DEBUG_URL);
	try {
		for (let attempt = 0; attempt < 120; attempt += 1) {
			const context = browser.contexts()[0];
			const page = context
				?.pages()
				.find((entry) => entry.url().startsWith(DESKTOP_PAGE_URL_PREFIX));
			if (page) {
				await page.waitForLoadState('domcontentloaded');
				return { browser, page };
			}

			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		throw new Error('The Tauri desktop page did not finish loading.');
	} catch (error) {
		await browser.close();
		throw error;
	}
}

test('runs the real desktop workflow through Tauri', async () => {
	const { browser, page } = await getDesktopPage();
	await expect(page.getByRole('heading', { level: 1, name: 'DGCoder Pi' })).toBeVisible();

	await page.getByLabel('Repository path').fill(process.cwd());
	await page.getByRole('button', { name: 'Add project' }).click();
	await expect(page.getByRole('heading', { level: 2, name: 'Explore repository' })).toBeVisible();

	await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'README.md'));
	await expect(page.getByRole('heading', { level: 3, name: 'README.md' })).toBeVisible();
	await expect(page.locator('.context-rail')).toContainText(
		'Windows-first desktop coding workbench'
	);

	await page.getByLabel('Prompt Pi').fill('Describe the current workbench state.');
	await page.getByRole('button', { name: 'Send to Pi' }).click();
	await expect(page.getByText('Select a configured model before sending a prompt.')).toBeVisible();

	await browser.close();
});
