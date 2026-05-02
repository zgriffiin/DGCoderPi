const NULLABLE_LINE_NUMBER_SCHEMA = {
	anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }]
};

const RESPONSE_EVIDENCE_ITEM_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		endLine: NULLABLE_LINE_NUMBER_SCHEMA,
		file: { type: 'string' },
		hunkId: { type: 'string' },
		startLine: NULLABLE_LINE_NUMBER_SCHEMA
	},
	required: ['file', 'hunkId', 'startLine', 'endLine']
};

const TOOL_EVIDENCE_ITEM_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		endLine: { type: 'integer', minimum: 1 },
		file: { type: 'string' },
		hunkId: { type: 'string' },
		startLine: { type: 'integer', minimum: 1 }
	},
	required: ['file', 'hunkId']
};

function listObjectSchema(properties, required) {
	return {
		type: 'object',
		additionalProperties: false,
		properties,
		required
	};
}

function arrayOf(items) {
	return {
		type: 'array',
		items
	};
}

function changeBriefItemSchema(evidenceSchema) {
	return listObjectSchema(
		{
			detail: { type: 'string' },
			evidence: arrayOf(evidenceSchema),
			title: { type: 'string' }
		},
		['title', 'detail', 'evidence']
	);
}

const IMPACT_ITEM_SCHEMA = listObjectSchema(
	{
		area: { type: 'string' },
		detail: { type: 'string' },
		evidence: arrayOf({ type: 'string' })
	},
	['area', 'detail', 'evidence']
);

function riskItemSchema(evidenceSchema) {
	return listObjectSchema(
		{
			confidence: { enum: ['low', 'medium', 'high'] },
			detail: { type: 'string' },
			evidence: arrayOf(evidenceSchema),
			level: { enum: ['low', 'medium', 'high'] },
			title: { type: 'string' },
			whyItMatters: { type: 'string' }
		},
		['level', 'confidence', 'title', 'detail', 'whyItMatters', 'evidence']
	);
}

const FOCUS_QUEUE_ITEM_SCHEMA = listObjectSchema(
	{
		file: { type: 'string' },
		hunkId: { type: 'string' },
		priority: { enum: ['low', 'medium', 'high'] },
		reason: { type: 'string' }
	},
	['file', 'hunkId', 'reason', 'priority']
);

const SUGGESTED_FOLLOW_UP_ITEM_SCHEMA = listObjectSchema(
	{
		prompt: { type: 'string' },
		reason: { type: 'string' }
	},
	['prompt', 'reason']
);

export const REVIEW_TOOL_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		changeBrief: arrayOf(changeBriefItemSchema(TOOL_EVIDENCE_ITEM_SCHEMA)),
		impact: arrayOf(IMPACT_ITEM_SCHEMA),
		risks: arrayOf(riskItemSchema(TOOL_EVIDENCE_ITEM_SCHEMA)),
		focusQueue: arrayOf(FOCUS_QUEUE_ITEM_SCHEMA),
		suggestedFollowUps: arrayOf(SUGGESTED_FOLLOW_UP_ITEM_SCHEMA)
	},
	required: ['changeBrief', 'impact', 'risks', 'focusQueue', 'suggestedFollowUps']
};

export const REVIEW_RESPONSE_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		changeBrief: arrayOf(changeBriefItemSchema(RESPONSE_EVIDENCE_ITEM_SCHEMA)),
		focusQueue: arrayOf(FOCUS_QUEUE_ITEM_SCHEMA),
		impact: arrayOf(IMPACT_ITEM_SCHEMA),
		risks: arrayOf(riskItemSchema(RESPONSE_EVIDENCE_ITEM_SCHEMA)),
		suggestedFollowUps: arrayOf(SUGGESTED_FOLLOW_UP_ITEM_SCHEMA)
	},
	required: ['changeBrief', 'impact', 'risks', 'focusQueue', 'suggestedFollowUps']
};
