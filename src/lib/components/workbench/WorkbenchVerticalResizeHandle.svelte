<script lang="ts">
	type Props = {
		label: string;
		max: number;
		min: number;
		onPointerDown: (event: PointerEvent) => void;
		onNudge: (delta: number) => void;
		value: number;
	};

	let { label, max, min, onPointerDown, onNudge, value }: Props = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
			return;
		}

		event.preventDefault();
		onNudge(event.key === 'ArrowDown' ? 4 : -4);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	aria-label={label}
	aria-orientation="vertical"
	aria-valuemax={max}
	aria-valuemin={min}
	aria-valuenow={Math.round(value * 10) / 10}
	class="workbench-vertical-resize-handle"
	role="separator"
	tabindex="0"
	onkeydown={handleKeydown}
	onpointerdown={onPointerDown}
></div>
