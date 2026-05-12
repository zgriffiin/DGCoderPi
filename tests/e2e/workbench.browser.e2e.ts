import { expect, test } from '@playwright/test';

test('renders the browser fallback shell outside Tauri', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('button', { name: 'Add project' })).toBeVisible();
	await expect(page.getByText('Desktop runtime')).toBeVisible();
	await page.getByRole('button', { name: 'Dismiss error' }).click();
	await expect(page.getByText('Desktop runtime')).toBeHidden();
	await expect(page.getByRole('button', { name: 'Add project' })).toBeDisabled();
});
