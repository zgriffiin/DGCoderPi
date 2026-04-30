<script lang="ts">
	import { Button, Tag } from 'carbon-components-svelte';
	import type { DiffAnalysis, DiffEvidence, ProjectDiffSnapshot } from '$lib/types/workbench';

	type Props = {
		analysis: DiffAnalysis | null;
		diff: ProjectDiffSnapshot;
		onJumpToHunk: (hunkId: string) => void;
		onRefresh: () => void;
		requestError: string | null;
	};

	let { analysis, diff, onJumpToHunk, onRefresh, requestError }: Props = $props();

	function evidenceLabel(evidence: DiffEvidence) {
		const range =
			evidence.startLine && evidence.endLine
				? ` lines ${evidence.startLine}-${evidence.endLine}`
				: evidence.startLine
					? ` line ${evidence.startLine}`
					: '';
		return `${evidence.file}${range}`;
	}

	function isGenerating() {
		return analysis?.status === 'in-progress' || analysis?.status === 'pending';
	}

	function hasReviewContent() {
		return Boolean(
			analysis &&
			(analysis.changeBrief.length > 0 ||
				analysis.impact.length > 0 ||
				analysis.risks.length > 0 ||
				analysis.focusQueue.length > 0 ||
				analysis.suggestedFollowUps.length > 0)
		);
	}

	function statusLabel() {
		if (analysis?.status === 'failed') {
			return 'Review stopped early';
		}
		return isGenerating() ? 'Review in progress' : 'Grounded review ready';
	}

	function progressLabel(analysis: DiffAnalysis) {
		if (analysis.progress > 0) {
			return `${analysis.progress}%`;
		}

		return analysis.partial ? 'partial' : 'starting';
	}
</script>

<div class="ai-review-panel">
	{#if diff.files.length === 0}
		<div class="empty-panel">
			<p>Clean working tree</p>
			<span>AI review is available once the project has local changes.</span>
		</div>
	{:else if requestError}
		<div class="empty-panel">
			<p>{requestError}</p>
			<Button kind="ghost" size="small" onclick={onRefresh}>Retry analysis</Button>
		</div>
	{:else if analysis?.status === 'failed' && !hasReviewContent()}
		<div class="empty-panel">
			<p>{analysis.error ?? 'AI review failed.'}</p>
			<Button kind="ghost" size="small" onclick={onRefresh}>Retry analysis</Button>
		</div>
	{:else if !analysis}
		<div class="empty-panel">
			<p>Preparing AI review</p>
			<Button kind="ghost" size="small" onclick={onRefresh}>Start analysis</Button>
		</div>
	{:else}
		<div class="inspector-block ai-review-panel__status">
			<div class="inspector-summary">
				<p>{statusLabel()}</p>
				{#if isGenerating() || analysis.partial}
					<Tag type="warm-gray">
						{progressLabel(analysis)}
					</Tag>
				{/if}
			</div>
			<Button kind="ghost" size="small" onclick={onRefresh}>Refresh review</Button>
			{#if analysis.status === 'failed' && analysis.error}
				<p>{analysis.error}</p>
			{/if}
		</div>

		<div class="ai-review-panel__body">
			{#if analysis.changeBrief.length}
				<section class="inspector-block">
					<div class="inspector-item">
						<div class="inspector-item__header">
							<p>Change Brief</p>
						</div>
						<ul class="ai-review-list">
							{#each analysis.changeBrief as item, itemIndex (itemIndex)}
								<li>
									<strong>{item.title}</strong>
									<p>{item.detail}</p>
									{#if item.evidence.length}
										<div class="ai-review-evidence">
											{#each item.evidence as evidence, evidenceIndex (evidenceIndex)}
												<button
													type="button"
													class="diff-link-button"
													onclick={() => onJumpToHunk(evidence.hunkId)}
												>
													{evidenceLabel(evidence)}
												</button>
											{/each}
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				</section>
			{/if}

			{#if analysis.impact.length}
				<section class="inspector-block">
					<div class="inspector-item">
						<div class="inspector-item__header">
							<p>Impact</p>
						</div>
						<ul class="ai-review-list">
							{#each analysis.impact as item, itemIndex (itemIndex)}
								<li>
									<strong>{item.area}</strong>
									<p>{item.detail}</p>
								</li>
							{/each}
						</ul>
					</div>
				</section>
			{/if}

			{#if analysis.risks.length}
				<section class="inspector-block">
					<div class="inspector-item">
						<div class="inspector-item__header">
							<p>Risk Review</p>
						</div>
						<ul class="ai-review-list">
							{#each analysis.risks as item, itemIndex (itemIndex)}
								<li>
									<div class="ai-review-risk-header">
										<strong>{item.title}</strong>
										<div class="patch-file__tags">
											<Tag
												type={item.level === 'high'
													? 'red'
													: item.level === 'medium'
														? 'warm-gray'
														: 'cool-gray'}
											>
												{item.level} risk
											</Tag>
											<Tag type="outline">{item.confidence} confidence</Tag>
										</div>
									</div>
									<p>{item.detail}</p>
									<p>{item.whyItMatters}</p>
									{#if item.evidence.length}
										<div class="ai-review-evidence">
											{#each item.evidence as evidence, evidenceIndex (evidenceIndex)}
												<button
													type="button"
													class="diff-link-button"
													onclick={() => onJumpToHunk(evidence.hunkId)}
												>
													{evidenceLabel(evidence)}
												</button>
											{/each}
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				</section>
			{/if}

			{#if analysis.focusQueue.length}
				<section class="inspector-block">
					<div class="inspector-item">
						<div class="inspector-item__header">
							<p>Files To Inspect</p>
						</div>
						<ul class="ai-review-list">
							{#each analysis.focusQueue as item, itemIndex (itemIndex)}
								<li>
									<div class="ai-review-risk-header">
										<strong>{item.file}</strong>
										<Tag
											type={item.priority === 'high'
												? 'red'
												: item.priority === 'medium'
													? 'warm-gray'
													: 'cool-gray'}
										>
											{item.priority}
										</Tag>
									</div>
									<p>{item.reason}</p>
									<button
										type="button"
										class="diff-link-button"
										onclick={() => onJumpToHunk(item.hunkId)}
									>
										Jump to hunk
									</button>
								</li>
							{/each}
						</ul>
					</div>
				</section>
			{/if}

			{#if analysis.suggestedFollowUps.length}
				<section class="inspector-block">
					<div class="inspector-item">
						<div class="inspector-item__header">
							<p>Suggested Follow-Up</p>
						</div>
						<ul class="ai-review-list">
							{#each analysis.suggestedFollowUps as item, itemIndex (itemIndex)}
								<li>
									<p>{item.prompt}</p>
									<span>{item.reason}</span>
								</li>
							{/each}
						</ul>
					</div>
				</section>
			{/if}

			{#if !hasReviewContent() && !isGenerating()}
				<div class="empty-panel">
					<p>No review sections returned.</p>
					<Button kind="ghost" size="small" onclick={onRefresh}>Retry analysis</Button>
				</div>
			{/if}
		</div>
	{/if}
</div>
