import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';

const DESKTOP_DEBUG_URL = 'http://127.0.0.1:9333';
const DESKTOP_PAGE_MARKER = 'DGCoder Pi';

test.setTimeout(120_000);

async function isWorkbenchPage(page: import('@playwright/test').Page) {
	try {
		await page.waitForLoadState('domcontentloaded', { timeout: 1_000 });
		return await page.evaluate((marker) => {
			const title = document.title ?? '';
			const heading = document.querySelector('h1')?.textContent ?? '';
			return title.includes(marker) || heading.includes(marker);
		}, DESKTOP_PAGE_MARKER);
	} catch {
		return false;
	}
}

test.skip(process.platform !== 'win32', 'Desktop runtime verification is Windows-only.');

async function getDesktopPage() {
	const browser = await chromium.connectOverCDP(DESKTOP_DEBUG_URL);
	try {
		for (let attempt = 0; attempt < 120; attempt += 1) {
			for (const context of browser.contexts()) {
				for (const page of context.pages()) {
					if (await isWorkbenchPage(page)) {
						return { browser, page };
					}
				}
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
	try {
		await page.waitForFunction(() => {
			return document.querySelector('h1')?.textContent?.includes('DGCoder Pi');
		});
		await expect(page.getByRole('heading', { level: 1, name: 'DGCoder Pi' })).toBeVisible({
			timeout: 15_000
		});

		await page.getByRole('button', { name: 'Add project' }).click();
		await page.getByRole('button', { name: 'Paste path' }).click();
		await page.getByLabel('Repository path').fill(process.cwd());
		await page.getByRole('button', { name: 'Add from path' }).click();
		await expect(
			page.getByRole('heading', { level: 2, name: /DGCoder-pi - Explore repository/ })
		).toBeVisible();

		await expect(page.getByRole('button', { name: 'New thread' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Create thread in DGCoder-pi' }).click();
		await expect(
			page.getByRole('heading', { level: 2, name: /DGCoder-pi - New thread/ })
		).toBeVisible();
		await expect(page.getByText('Start a conversation.')).toHaveCount(0);
		await expect(page.getByText('1 queued message')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Attach' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Ship' })).toBeVisible();

		await page.getByRole('button', { name: 'Settings' }).click();
		const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
		await expect(settingsDialog).toBeVisible();
		await expect(settingsDialog.getByRole('heading', { level: 3, name: 'Codex' })).toBeVisible();
		await settingsDialog.getByRole('button', { name: 'Providers' }).click();
		await expect(
			settingsDialog.getByRole('heading', { level: 3, name: 'Providers' })
		).toBeVisible();
		await settingsDialog.getByLabel('Close the modal').click();

		await page.getByRole('button', { name: 'Diff' }).click();
		await expect(page.getByRole('heading', { level: 2, name: 'Diff' })).toBeVisible();

		await page
			.locator('input[type="file"]')
			.setInputFiles(path.resolve(process.cwd(), 'README.md'));
		await page.getByRole('button', { name: 'Spec' }).click();
		await expect(page.locator('.inspector-rail').getByText('README.md').first()).toBeVisible();
		const modelEmptyState = page.locator('.model-empty-state');
		if (await modelEmptyState.isVisible()) {
			await page.getByLabel('Prompt Pi').fill('Describe the current workbench state.');
			await page.getByRole('button', { name: 'Start' }).click();
			await expect(
				page.getByText('Select a configured model before sending a prompt.')
			).toBeVisible();
		} else {
			await expect(page.locator('.composer-panel .bx--list-box').first()).toBeVisible();
			await page.getByLabel('Prompt Pi').fill('Reply with the word ready.');
			await page.getByRole('button', { name: 'Start' }).click();
			await expect(page.locator('.message-row[data-tone="user"] .message-row__body')).toContainText(
				'Reply with the word ready.'
			);
			await expect(
				page.locator('.message-row[data-tone="assistant"] .message-row__body').first()
			).toContainText('ready', { timeout: 120_000 });
		}
	} finally {
		await browser.close();
	}
});
