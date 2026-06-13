import { normalizePriority } from './priority-utils.mjs';
import { firstValue, safeText } from './review-shape.mjs';

export function normalizeReviewResult(payload, review) {
	return {
		changeBrief: normalizeBriefItems(review.changeBrief),
		continuationToken: null,
		error: null,
		fingerprint: payload.diff.fingerprint,
		focusQueue: normalizeFocusQueue(review.focusQueue, payload.diff.files),
		impact: normalizeImpactItems(review.impact),
		modelKey: payload.modelKey,
		partial: false,
		progress: 100,
		risks: normalizeRiskItems(review.risks),
		status: 'complete',
		suggestedFollowUps: normalizeFollowUps(review.suggestedFollowUps),
		updatedAtMs: Date.now()
	};
}

function normalizeBriefItems(items) {
	return (Array.isArray(items) ? items : []).slice(0, 5).map((item) => ({
		title: firstText(item, ['title', 'heading', 'summary', 'label']),
		detail: firstText(item, ['detail', 'description', 'body', 'text']),
		evidence: normalizeEvidence(item?.evidence)
	}));
}

function normalizeImpactItems(items) {
	return (Array.isArray(items) ? items : []).slice(0, 5).map((item) => ({
		area: firstText(item, ['area', 'title', 'name']),
		detail: firstText(item, ['detail', 'description', 'body', 'text']),
		evidence: Array.isArray(item?.evidence) ? item.evidence.map((value) => safeText(value)) : []
	}));
}

function normalizeRiskItems(items) {
	return (Array.isArray(items) ? items : []).slice(0, 6).map((item) => ({
		level: normalizePriority(firstValue(item, ['level', 'severity'])),
		confidence: normalizePriority(firstValue(item, ['confidence', 'certainty'])),
		title: firstText(item, ['title', 'heading', 'label']),
		detail: firstText(item, ['detail', 'description', 'body', 'text']),
		whyItMatters: firstText(item, ['whyItMatters', 'impact', 'consequence']),
		evidence: normalizeEvidence(item?.evidence)
	}));
}

function normalizeFocusQueue(items, files) {
	const validHunks = new Map(
		files.flatMap((file) => file.hunks.map((hunk) => [hunk.id, safeText(file.path)]))
	);
	return (Array.isArray(items) ? items : [])
		.slice(0, 6)
		.map((item) => ({
			file: firstText(item, ['file', 'path']),
			hunkId: firstText(item, ['hunkId', 'hunk_id', 'id']),
			priority: normalizePriority(item?.priority),
			reason: firstText(item, ['reason', 'detail', 'description'])
		}))
		.filter((item) => validHunks.get(item.hunkId) === item.file);
}

function normalizeFollowUps(items) {
	return (Array.isArray(items) ? items : []).slice(0, 4).map((item) => ({
		prompt: firstText(item, ['prompt', 'question', 'text']),
		reason: firstText(item, ['reason', 'detail', 'description'])
	}));
}

function normalizeEvidence(items) {
	return (Array.isArray(items) ? items : [])
		.slice(0, 3)
		.map((item) => ({
			file: firstText(item, ['file', 'path']),
			hunkId: firstText(item, ['hunkId', 'hunk_id', 'id']),
			startLine: normalizeLineNumber(firstValue(item, ['startLine', 'start_line', 'lineStart'])),
			endLine: normalizeLineNumber(firstValue(item, ['endLine', 'end_line', 'lineEnd']))
		}))
		.filter((item) => item.file && item.hunkId);
}

function normalizeLineNumber(value) {
	if (Number.isInteger(value) && value > 0) {
		return value;
	}
	if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
		return Number(value);
	}
	return null;
}

function firstText(item, keys) {
	return safeText(firstValue(item, keys));
}
