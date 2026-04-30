<script lang="ts">
	import type { ResizablePane } from './workbench-layout';

	type Props = {
		label: string;
		max: number;
		min: number;
		onPointerDown: (event: PointerEvent) => void;
		onNudge: (delta: number) => void;
		pane: ResizablePane;
		value: number;
	};

	let { label, max, min, onPointerDown, onNudge, pane, value }: Props = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
			return;
		}

		event.preventDefault();
		const direction =
			pane === 'left'
				? event.key === 'ArrowLeft'
					? -16
					: 16
				: event.key === 'ArrowLeft'
					? -16
					: 16;
		onNudge(direction);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	aria-label={label}
	aria-orientation="vertical"
	aria-valuemax={max}
	aria-valuemin={min}
	aria-valuenow={value}
	class="workbench-resize-handle"
	role="separator"
	tabindex="0"
	onkeydown={handleKeydown}
	onpointerdown={onPointerDown}
></div>
