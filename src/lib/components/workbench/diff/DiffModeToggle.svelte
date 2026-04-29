<script lang="ts">
	type DiffReviewMode = 'ai-review' | 'patch-view';

	type Props = {
		mode: DiffReviewMode;
		onChange: (mode: DiffReviewMode) => void;
	};

	let { mode, onChange }: Props = $props();
</script>

<div class="diff-mode-toggle" role="tablist" aria-label="Diff review mode">
	<button
		type="button"
		role="tab"
		class="diff-mode-toggle__button"
		aria-selected={mode === 'ai-review'}
		data-selected={mode === 'ai-review' ? 'true' : undefined}
		onclick={() => onChange('ai-review')}
	>
		AI Review
	</button>
	<button
		type="button"
		role="tab"
		class="diff-mode-toggle__button"
		aria-selected={mode === 'patch-view'}
		data-selected={mode === 'patch-view' ? 'true' : undefined}
		onclick={() => onChange('patch-view')}
	>
		Patch View
	</button>
</div>
