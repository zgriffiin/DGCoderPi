import type { DiffAnalysis, ProjectDiffSnapshot } from '$lib/types/workbench';

export function createInProgressAnalysis(
	snapshot: ProjectDiffSnapshot,
	previous: DiffAnalysis | null = null
): DiffAnalysis {
	return mergeVisibleDiffAnalysis(previous, {
		changeBrief: [],
		continuationToken: null,
		error: null,
		fingerprint: snapshot.fingerprint,
		focusQueue: [],
		impact: [],
		modelKey: previous?.fingerprint === snapshot.fingerprint ? previous.modelKey : '',
		partial: false,
		progress: 0,
		risks: [],
		status: 'in-progress',
		suggestedFollowUps: [],
		updatedAtMs: Date.now()
	});
}

export function hasDiffReviewContent(analysis: DiffAnalysis | null) {
	return Boolean(
		analysis &&
		(analysis.changeBrief.length > 0 ||
			analysis.impact.length > 0 ||
			analysis.risks.length > 0 ||
			analysis.focusQueue.length > 0 ||
			analysis.suggestedFollowUps.length > 0)
	);
}

export function mergeVisibleDiffAnalysis(
	current: DiffAnalysis | null,
	next: DiffAnalysis
): DiffAnalysis {
	if (!shouldPreserveVisibleContent(current, next)) {
		return normalizedProgressAnalysis(next);
	}
	if (!current) {
		return normalizedProgressAnalysis(next);
	}

	return normalizedProgressAnalysis({
		...next,
		changeBrief: current.changeBrief,
		focusQueue: current.focusQueue,
		impact: current.impact,
		risks: current.risks,
		suggestedFollowUps: current.suggestedFollowUps
	});
}

function shouldPreserveVisibleContent(current: DiffAnalysis | null, next: DiffAnalysis) {
	return Boolean(
		current &&
		current.fingerprint === next.fingerprint &&
		hasDiffReviewContent(current) &&
		!hasDiffReviewContent(next) &&
		(next.status === 'pending' || next.status === 'in-progress')
	);
}

function normalizedProgressAnalysis(analysis: DiffAnalysis) {
	if (analysis.status !== 'complete' || analysis.progress >= 100) {
		return analysis;
	}

	return {
		...analysis,
		partial: false,
		progress: 100
	};
}
