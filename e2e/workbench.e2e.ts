import { expect, test } from '@playwright/test';

test('renders the desktop workbench shell', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1, name: 'DGCoder Pi' })).toBeVisible();
	await expect(
		page.getByRole('heading', { level: 2, name: 'Build the desktop workbench shell' })
	).toBeVisible();
	await expect(
		page.locator('.context-rail').getByText('Finish Carbon workbench shell')
	).toBeVisible();
});
