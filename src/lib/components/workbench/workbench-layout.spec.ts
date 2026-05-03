import { describe, expect, it } from 'vitest';
import {
	clampComposerHeightPercent,
	clampInspectorDetailHeightPercent,
	DEFAULT_COMPOSER_HEIGHT_PERCENT,
	DEFAULT_INSPECTOR_DETAIL_HEIGHT_PERCENT,
	formatWorkbenchGridStyle,
	loadComposerHeightPercent,
	loadInspectorDetailHeightPercent,
	saveComposerHeightPercent,
	saveInspectorDetailHeightPercent
} from './workbench-layout';

function createStorageMock() {
	const values = new Map<string, string>();
	return {
		getItem(key: string) {
			return values.get(key) ?? null;
		},
		setItem(key: string, value: string) {
			values.set(key, value);
		}
	} as Storage;
}

describe('workbench layout', () => {
	it('clamps composer height percentages to the supported range', () => {
		expect(clampComposerHeightPercent(10)).toBe(18);
		expect(clampComposerHeightPercent(34)).toBe(34);
		expect(clampComposerHeightPercent(90)).toBe(70);
	});

	it('loads the default composer height when nothing is saved', () => {
		expect(loadComposerHeightPercent(createStorageMock())).toBe(DEFAULT_COMPOSER_HEIGHT_PERCENT);
	});

	it('clamps inspector detail height percentages to the supported range', () => {
		expect(clampInspectorDetailHeightPercent(10)).toBe(18);
		expect(clampInspectorDetailHeightPercent(28)).toBe(28);
		expect(clampInspectorDetailHeightPercent(90)).toBe(70);
	});

	it('loads the default inspector detail height when nothing is saved', () => {
		expect(loadInspectorDetailHeightPercent(createStorageMock())).toBe(
			DEFAULT_INSPECTOR_DETAIL_HEIGHT_PERCENT
		);
	});

	it('persists and restores composer height as a percentage', () => {
		const storage = createStorageMock();
		saveComposerHeightPercent(storage, 42.5);

		expect(loadComposerHeightPercent(storage)).toBe(42.5);
	});

	it('persists and restores inspector detail height as a percentage', () => {
		const storage = createStorageMock();
		saveInspectorDetailHeightPercent(storage, 36.5);

		expect(loadInspectorDetailHeightPercent(storage)).toBe(36.5);
	});

	it('includes the composer height variable in the workbench grid style', () => {
		expect(formatWorkbenchGridStyle({ left: 288, right: 304 }, 41)).toContain(
			'--workbench-composer-height:41%;'
		);
	});
});
