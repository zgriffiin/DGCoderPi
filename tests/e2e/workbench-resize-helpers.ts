import { expect, type Locator } from '@playwright/test';

export async function verifyKeyboardResize(inspector: Locator, resizeHandle: Locator) {
	await resizeHandle.focus();
	await normalizeResizeHandleValue(resizeHandle);
	const keyboardWidthBefore = await readResizeHandleValue(resizeHandle);
	await resizeHandle.press('ArrowLeft');
	const keyboardWidthAfterLeft = await readResizeHandleValue(resizeHandle);
	expect(keyboardWidthAfterLeft).toBeLessThan(keyboardWidthBefore - 8);
	await resizeHandle.press('ArrowRight');
	const keyboardWidthAfterRight = await readResizeHandleValue(resizeHandle);
	expect(keyboardWidthAfterRight).toBeGreaterThan(keyboardWidthAfterLeft + 8);
	await expect(inspector).toBeVisible();
}

export async function normalizeVerticalResizeHandleValue(resizeHandle: Locator) {
	const value = Number(await resizeHandle.getAttribute('aria-valuenow'));
	const min = Number(await resizeHandle.getAttribute('aria-valuemin'));
	const max = Number(await resizeHandle.getAttribute('aria-valuemax'));
	if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
		return;
	}
	let current = value;
	for (let attempt = 0; current - min < 8 && attempt < 8; attempt += 1) {
		await resizeHandle.press('ArrowDown');
		current = await readResizeHandleValue(resizeHandle);
	}
	for (let attempt = 0; max - current < 8 && attempt < 8; attempt += 1) {
		await resizeHandle.press('ArrowUp');
		current = await readResizeHandleValue(resizeHandle);
	}
}

async function normalizeResizeHandleValue(resizeHandle: Locator) {
	const value = Number(await resizeHandle.getAttribute('aria-valuenow'));
	const min = Number(await resizeHandle.getAttribute('aria-valuemin'));
	const max = Number(await resizeHandle.getAttribute('aria-valuemax'));
	if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
		return;
	}
	let current = value;
	for (let attempt = 0; current - min < 64 && attempt < 8; attempt += 1) {
		await resizeHandle.press('ArrowRight');
		current = await readResizeHandleValue(resizeHandle);
	}
	for (let attempt = 0; max - current < 64 && attempt < 8; attempt += 1) {
		await resizeHandle.press('ArrowLeft');
		current = await readResizeHandleValue(resizeHandle);
	}
}

async function readResizeHandleValue(resizeHandle: Locator) {
	const rawValue = await resizeHandle.getAttribute('aria-valuenow');
	const value = Number(rawValue);
	if (!Number.isFinite(value)) {
		throw new Error(`Resize handle aria-valuenow was not numeric: ${rawValue ?? 'null'}`);
	}
	return value;
}
