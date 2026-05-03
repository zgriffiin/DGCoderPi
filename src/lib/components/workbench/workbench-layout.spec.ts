import { describe, expect, it } from 'vitest';
import {
	clampComposerHeightPercent,
	clampInspectorDetailHeightPercent,
	formatWorkbenchGridStyle
} from './workbench-layout';

describe('workbench layout', () => {
	it('clamps composer height percentages to the supported range', () => {
		expect(clampComposerHeightPercent(10)).toBe(18);
		expect(clampComposerHeightPercent(34)).toBe(34);
		expect(clampComposerHeightPercent(90)).toBe(70);
	});

	it('clamps inspector detail height percentages to the supported range', () => {
		expect(clampInspectorDetailHeightPercent(10)).toBe(18);
		expect(clampInspectorDetailHeightPercent(28)).toBe(28);
		expect(clampInspectorDetailHeightPercent(90)).toBe(70);
	});

	it('includes the composer height variable in the workbench grid style', () => {
		expect(formatWorkbenchGridStyle({ left: 288, right: 304 }, 41)).toContain(
			'--workbench-composer-height:41%;'
		);
	});
});
