import { expect, test } from '@playwright/test';

test('renders the browser fallback shell outside Tauri', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1, name: 'DGCoder Pi' })).toBeVisible();
	await expect(page.getByText('Desktop runtime')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add project' })).toBeDisabled();
});
