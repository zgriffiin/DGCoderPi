import type { DiffAnalysis } from '$lib/types/workbench';
import type { WorkbenchController } from '$lib/workbench/controller';

export type ShipReviewStatus = 'idle' | 'reviewing' | 'blocked' | 'needs-decision';

export type ShipReviewState = {
	analysis: DiffAnalysis | null;
	error: string | null;
	projectId: string | null;
	status: ShipReviewStatus;
	threadId: string | null;
};

const SHIP_REVIEW_POLL_INTERVAL_MS = 1500;
const SHIP_REVIEW_TIMEOUT_MS = 10 * 60 * 1000;

export function createIdleShipReview(): ShipReviewState {
	return {
		analysis: null,
		error: null,
		projectId: null,
		status: 'idle',
		threadId: null
	};
}

export function createReviewingShipReview(projectId: string, threadId: string): ShipReviewState {
	return {
		analysis: null,
		error: null,
		projectId,
		status: 'reviewing',
		threadId
	};
}

export function shipReviewDetail(shipReview: ShipReviewState) {
	if (shipReview.status === 'reviewing') {
		return 'Reviewing changes before commit...';
	}

	if (shipReview.status === 'blocked') {
		return shipReview.error ?? shipReview.analysis?.error ?? 'Diff review failed.';
	}

	if (shipReview.status === 'needs-decision' && shipReview.analysis) {
		return shipReviewSummary(shipReview.analysis);
	}

	return null;
}

export function shipReviewMaxRiskLevel(shipReview: ShipReviewState) {
	const risks = shipReview.analysis?.risks ?? [];
	if (risks.some((risk) => risk.level === 'high')) {
		return 'high';
	}
	if (risks.some((risk) => risk.level === 'medium')) {
		return 'medium';
	}
	if (risks.length > 0) {
		return 'low';
	}
	return null;
}

export function buildShipReviewFixPrompt(analysis: DiffAnalysis) {
	const issueCount = analysis.risks.length;
	const issueLines = analysis.risks.flatMap((risk, index) => [
		`${index + 1}. ${risk.title || 'Untitled risk'} (${risk.level} risk, ${risk.confidence} confidence)`,
		`   Detail: ${risk.detail || 'No detail provided.'}`,
		`   Why it matters: ${risk.whyItMatters || 'No impact detail provided.'}`,
		`   Evidence: ${formatEvidenceList(risk.evidence)}`
	]);
	const focusLines = analysis.focusQueue.map(
		(item, index) =>
			`${index + 1}. ${item.file} (${item.priority}): ${item.reason} [${item.hunkId}]`
	);

	return [
		`Fix the ${issueCount} ship review issue${issueCount === 1 ? '' : 's'} before shipping.`,
		'',
		'Rules:',
		'- Inspect each cited file and hunk before editing.',
		'- Fix every real issue with the smallest correct code change.',
		'- If a finding is a false positive, explain why with file-level evidence.',
		'- Validate user-visible fixes through the real app UI with Playwright where applicable.',
		'- Rerun the diff review or ship gate after fixes and report remaining findings.',
		'',
		'Ship review issues:',
		...issueLines,
		'',
		'Files to inspect first:',
		...(focusLines.length > 0 ? focusLines : ['No focus queue was returned.'])
	].join('\n');
}

export function shipReviewScopeMatches(
	shipReview: ShipReviewState,
	projectId: string | null,
	threadId: string | null
) {
	return shipReview.projectId === projectId && shipReview.threadId === threadId;
}

async function waitForShipReview(
	controller: WorkbenchController,
	projectId: string,
	threadId: string | null,
	shouldContinue: () => boolean
) {
	let analysis = await controller.loadDiffAnalysis(projectId, threadId, false);
	if (analysis.status === 'pending' || analysis.status === 'failed') {
		analysis = await controller.refreshDiffAnalysis(projectId, threadId, false);
	}

	const startedAt = Date.now();
	while (analysis.status === 'pending' || analysis.status === 'in-progress') {
		if (!shouldContinue()) {
			throw new Error('Ship review was cancelled.');
		}
		if (Date.now() - startedAt >= SHIP_REVIEW_TIMEOUT_MS) {
			throw new Error('Diff review did not finish after 10 minutes. Retry before committing.');
		}
		await new Promise((resolve) => window.setTimeout(resolve, SHIP_REVIEW_POLL_INTERVAL_MS));
		analysis = await controller.loadDiffAnalysis(projectId, threadId, false);
	}

	return analysis;
}

export async function runShipReviewGate(
	controller: WorkbenchController,
	projectId: string,
	threadId: string,
	shouldContinue: () => boolean
): Promise<ShipReviewState | null> {
	try {
		const diff = await controller.loadProjectDiff(projectId, false);
		if (!diff.gitAvailable || diff.files.length === 0) {
			return null;
		}

		const analysis = await waitForShipReview(controller, projectId, threadId, shouldContinue);
		if (analysis.status === 'failed') {
			return {
				analysis,
				error: analysis.error ?? 'Diff review failed.',
				projectId,
				status: 'blocked',
				threadId
			};
		}

		if (shipReviewHasIssues(analysis)) {
			return { analysis, error: null, projectId, status: 'needs-decision', threadId };
		}

		return null;
	} catch (error) {
		return {
			analysis: null,
			error: error instanceof Error ? error.message : String(error),
			projectId,
			status: 'blocked',
			threadId
		};
	}
}

function shipReviewHasIssues(analysis: DiffAnalysis) {
	return analysis.risks.length > 0;
}

function formatEvidenceList(evidence: DiffAnalysis['risks'][number]['evidence']) {
	if (evidence.length === 0) {
		return 'No direct hunk evidence returned.';
	}

	return evidence
		.map((item) => {
			const lines =
				item.startLine && item.endLine
					? item.startLine === item.endLine
						? ` line ${item.startLine}`
						: ` lines ${item.startLine}-${item.endLine}`
					: '';
			return `${item.file}${lines} [${item.hunkId}]`;
		})
		.join('; ');
}

function shipReviewSummary(analysis: DiffAnalysis) {
	if (analysis.risks.length === 0) {
		return 'Review found no risk items.';
	}

	const high = analysis.risks.filter((risk) => risk.level === 'high').length;
	const medium = analysis.risks.filter((risk) => risk.level === 'medium').length;
	const low = analysis.risks.filter((risk) => risk.level === 'low').length;
	return `${analysis.risks.length} risk item${analysis.risks.length === 1 ? '' : 's'} found: ${high} high, ${medium} medium, ${low} low.`;
}
