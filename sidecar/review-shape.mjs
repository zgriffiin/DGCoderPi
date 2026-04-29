import { normalizePriority } from './priority-utils.mjs';

export const REVIEW_FIELD_ALIASES = {
	changeBrief: ['changeBrief', 'change_brief', 'summary', 'changeSummary'],
	focusQueue: ['focusQueue', 'focus_queue', 'focusAreas', 'focus'],
	impact: ['impact', 'impacts'],
	risks: ['risks', 'riskReview', 'risk_review'],
	suggestedFollowUps: [
		'suggestedFollowUps',
		'suggested_follow_ups',
		'suggestedFollowUp',
		'followUps'
	]
};

const REVIEW_ITEM_VALIDATORS = {
	changeBrief: (item) =>
		hasTextFields(item, [
			['title', 'heading', 'summary', 'label'],
			['detail', 'description', 'body', 'text']
		]),
	focusQueue: (item) =>
		normalizePriority(item?.priority) !== 'unknown' &&
		hasTextFields(item, [
			['file', 'path'],
			['hunkId', 'hunk_id', 'id'],
			['reason', 'detail', 'description']
		]),
	impact: (item) =>
		hasTextFields(item, [
			['area', 'title', 'name'],
			['detail', 'description', 'body', 'text']
		]),
	risks: (item) =>
		normalizePriority(firstValue(item, ['level', 'severity'])) !== 'unknown' &&
		normalizePriority(firstValue(item, ['confidence', 'certainty'])) !== 'unknown' &&
		hasTextFields(item, [
			['title', 'heading', 'label'],
			['detail', 'description', 'body', 'text']
		]),
	suggestedFollowUps: (item) =>
		hasTextFields(item, [
			['prompt', 'question', 'text'],
			['reason', 'detail', 'description']
		])
};

export function hasStructuredReviewShape(value) {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const fields = Object.keys(REVIEW_FIELD_ALIASES);
	return (
		fields.every((key) => hasReviewField(value, key)) &&
		fields.every((key) =>
			readReviewField(value, key).every((item) => isValidReviewItem(key, item))
		) &&
		fields.some((key) => readReviewField(value, key).some((item) => isValidReviewItem(key, item)))
	);
}

function hasReviewField(value, key) {
	return REVIEW_FIELD_ALIASES[key].some((alias) => Array.isArray(value?.[alias]));
}

function readReviewField(value, key) {
	const matched = REVIEW_FIELD_ALIASES[key].map((alias) => value?.[alias]).find(isUsableValue);
	return Array.isArray(matched) ? matched : [];
}

function isValidReviewItem(key, item) {
	return Boolean(item && typeof item === 'object' && REVIEW_ITEM_VALIDATORS[key]?.(item));
}

function hasTextFields(item, fieldAliases) {
	return fieldAliases.every((aliases) => safeText(firstValue(item, aliases)));
}

function firstValue(item, keys) {
	for (const key of keys) {
		if (isUsableValue(item?.[key])) {
			return item[key];
		}
	}
	return null;
}

function isUsableValue(value) {
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === 'string') return value.trim().length > 0;
	return value !== undefined && value !== null;
}

function safeText(value) {
	return typeof value === 'string' ? value.trim() : '';
}
