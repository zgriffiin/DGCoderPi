export type ResizablePane = 'left' | 'right';

export type DragState = {
	captureTarget: HTMLElement;
	pane: ResizablePane;
	pointerId: number;
	startWidth: number;
	startX: number;
};

type PanelWidths = {
	left: number;
	right: number;
};

export const DEFAULT_PANEL_WIDTHS: PanelWidths = {
	left: 288,
	right: 304
};

const HANDLE_WIDTH = 8;
const MIN_CENTER_WIDTH = 300;
export const MIN_INSPECTOR_WIDTH = 304;
export const MIN_PROJECT_RAIL_WIDTH = 224;
export const RESIZE_BREAKPOINT = 1100;
const WORKBENCH_LAYOUT_STORAGE_KEY = 'pi.workbench.layout.v1';

export function clampWidth(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function loadPanelWidths(storage: Storage): PanelWidths {
	const savedWidths = storage.getItem(WORKBENCH_LAYOUT_STORAGE_KEY);
	if (!savedWidths) {
		return DEFAULT_PANEL_WIDTHS;
	}

	try {
		const parsed = JSON.parse(savedWidths);
		return {
			left: typeof parsed?.left === 'number' ? parsed.left : DEFAULT_PANEL_WIDTHS.left,
			right: typeof parsed?.right === 'number' ? parsed.right : DEFAULT_PANEL_WIDTHS.right
		};
	} catch {
		return DEFAULT_PANEL_WIDTHS;
	}
}

export function savePanelWidths(storage: Storage, panelWidths: PanelWidths) {
	storage.setItem(WORKBENCH_LAYOUT_STORAGE_KEY, JSON.stringify(panelWidths));
}

export function formatWorkbenchGridStyle(panelWidths: PanelWidths) {
	return `--workbench-left-rail-width:${panelWidths.left}px; --workbench-inspector-width:${panelWidths.right}px;`;
}

export function maxLeftWidth(
	totalWidth: number,
	rightWidth: number,
	inspectorVisible: boolean,
	canResizePanels: boolean
) {
	const handleCount = canResizePanels ? (inspectorVisible ? 2 : 1) : 0;
	const maxWidth = totalWidth - rightWidth - MIN_CENTER_WIDTH - handleCount * HANDLE_WIDTH;
	return Math.max(MIN_PROJECT_RAIL_WIDTH, maxWidth);
}

export function maxRightWidth(totalWidth: number, leftWidth: number, canResizePanels: boolean) {
	const handleCount = canResizePanels ? 2 : 0;
	const maxWidth = totalWidth - leftWidth - MIN_CENTER_WIDTH - handleCount * HANDLE_WIDTH;
	return Math.max(MIN_INSPECTOR_WIDTH, maxWidth);
}
