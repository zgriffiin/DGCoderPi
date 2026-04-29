import {
	createAgentSession,
	DefaultResourceLoader,
	SessionManager,
	SettingsManager,
	defineTool
} from '@mariozechner/pi-coding-agent';

const REVIEW_TOOL_NAME = 'diff_review_result';
const EVIDENCE_ITEM_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		file: { type: 'string' },
		hunkId: { type: 'string' },
		startLine: { type: 'integer', minimum: 1 },
		endLine: { type: 'integer', minimum: 1 }
	},
	required: ['file', 'hunkId']
};
const REVIEW_TOOL_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		changeBrief: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					title: { type: 'string' },
					detail: { type: 'string' },
					evidence: {
						type: 'array',
						items: EVIDENCE_ITEM_SCHEMA
					}
				},
				required: ['title', 'detail', 'evidence']
			}
		},
		impact: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					area: { type: 'string' },
					detail: { type: 'string' },
					evidence: { type: 'array', items: { type: 'string' } }
				},
				required: ['area', 'detail', 'evidence']
			}
		},
		risks: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					level: { enum: ['low', 'medium', 'high'] },
					confidence: { enum: ['low', 'medium', 'high'] },
					title: { type: 'string' },
					detail: { type: 'string' },
					whyItMatters: { type: 'string' },
					evidence: {
						type: 'array',
						items: EVIDENCE_ITEM_SCHEMA
					}
				},
				required: ['level', 'confidence', 'title', 'detail', 'whyItMatters', 'evidence']
			}
		},
		focusQueue: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					file: { type: 'string' },
					hunkId: { type: 'string' },
					reason: { type: 'string' },
					priority: { enum: ['low', 'medium', 'high'] }
				},
				required: ['file', 'hunkId', 'reason', 'priority']
			}
		},
		suggestedFollowUps: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					prompt: { type: 'string' },
					reason: { type: 'string' }
				},
				required: ['prompt', 'reason']
			}
		}
	},
	required: ['changeBrief', 'impact', 'risks', 'focusQueue', 'suggestedFollowUps']
};

export async function analyzeDiff(runtime, payload) {
	let capturedResult = null;
	const reviewTool = defineTool({
		name: REVIEW_TOOL_NAME,
		label: 'Diff Review Result',
		description: 'Submit the final structured diff review result.',
		parameters: REVIEW_TOOL_SCHEMA,
		promptSnippet: 'Return the final review as a structured diff tool result.',
		promptGuidelines: [
			`Call ${REVIEW_TOOL_NAME} exactly once when the review is complete.`,
			'Do not emit a normal assistant reply after calling the tool.'
		],
		async execute(_toolCallId, params) {
			capturedResult = params;
			return {
				content: [{ type: 'text', text: 'Saved diff review result.' }],
				details: params,
				terminate: true
			};
		}
	});

	const model = runtime.resolveModel(payload.modelKey);
	const settingsManager = SettingsManager.inMemory({
		compaction: { enabled: false },
		retry: { enabled: true, maxRetries: 1 }
	});
	const loader = new DefaultResourceLoader({
		agentDir: runtime.agentDir,
		cwd: process.cwd(),
		settingsManager,
		noContextFiles: true,
		noExtensions: true,
		noPromptTemplates: true,
		noSkills: true,
		noThemes: true,
		systemPromptOverride: () => buildSystemPrompt()
	});
	await loader.reload();

	const { session } = await createAgentSession({
		agentDir: runtime.agentDir,
		authStorage: runtime.authStorage,
		customTools: [reviewTool],
		cwd: process.cwd(),
		model,
		modelRegistry: runtime.modelRegistry,
		resourceLoader: loader,
		sessionManager: SessionManager.inMemory(),
		settingsManager,
		thinkingLevel: 'off',
		tools: []
	});

	try {
		await session.prompt(buildPrompt(payload));
		if (!capturedResult) {
			throw new Error('Diff analysis did not return a structured result.');
		}
		return normalizeReviewResult(payload, capturedResult);
	} finally {
		session.dispose();
	}
}

function buildSystemPrompt() {
	return [
		'You are Pi Diff Review.',
		'Explain a code diff for a technical user who may not be a daily programmer.',
		'Ground every claim in the provided files and hunk ids.',
		'Prefer product behavior and user-facing consequences over internal jargon.',
		`Always finish by calling ${REVIEW_TOOL_NAME}.`,
		'Keep each list concise and avoid filler.'
	].join('\n');
}

function buildPrompt(payload) {
	const threadContext = payload.threadContext
		? [
				`Thread title: ${payload.threadContext.threadTitle ?? 'n/a'}`,
				`Latest user request: ${payload.threadContext.latestUserRequest ?? 'n/a'}`,
				`Latest assistant summary: ${payload.threadContext.latestAssistantSummary ?? 'n/a'}`,
				`Latest completed turn id: ${payload.threadContext.latestCompletedTurnId ?? 'n/a'}`
			].join('\n')
		: 'No thread context was provided.';

	return [
		`Project: ${payload.projectName}`,
		`Branch: ${payload.diff.branch}`,
		`Diff fingerprint: ${payload.diff.fingerprint}`,
		`Stats: ${payload.diff.stats.filesChanged} files, ${payload.diff.stats.additions} additions, ${payload.diff.stats.deletions} deletions.`,
		'',
		'Review requirements:',
		'- Change Brief: 2-5 plain-English bullets about what changed.',
		'- Impact: concrete workflows, features, settings, or runtime behavior affected.',
		'- Risk Review: include only concrete concerns with level and confidence.',
		'- Focus Queue: the best files or hunks to inspect first.',
		'- Suggested Follow-Up: only grounded next questions or prompts.',
		'- Every item must point to real files and hunk ids when possible.',
		'- If the diff is mechanical, say so plainly instead of inventing risk.',
		'',
		'Thread context:',
		threadContext,
		'',
		'Diff payload:',
		JSON.stringify(compactDiffPayload(payload.diff), null, 2)
	].join('\n');
}

function compactDiffPayload(diff) {
	return {
		branch: diff.branch,
		fingerprint: diff.fingerprint,
		stats: diff.stats,
		files: diff.files.map((file) => ({
			id: file.id,
			path: file.path,
			originalPath: file.originalPath,
			status: file.status,
			statusCode: file.statusCode,
			isBinary: file.isBinary,
			isGenerated: file.isGenerated,
			isTooLarge: file.isTooLarge,
			additions: file.additions,
			deletions: file.deletions,
			hunks: file.hunks.map((hunk) => ({
				id: hunk.id,
				header: hunk.header,
				oldStart: hunk.oldStart,
				oldLines: hunk.oldLines,
				newStart: hunk.newStart,
				newLines: hunk.newLines,
				lines: hunk.lines.slice(0, 40)
			}))
		}))
	};
}

function normalizeReviewResult(payload, review) {
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
		title: safeText(item?.title),
		detail: safeText(item?.detail),
		evidence: normalizeEvidence(item?.evidence)
	}));
}

function normalizeImpactItems(items) {
	return (Array.isArray(items) ? items : []).slice(0, 5).map((item) => ({
		area: safeText(item?.area),
		detail: safeText(item?.detail),
		evidence: Array.isArray(item?.evidence) ? item.evidence.map((value) => safeText(value)) : []
	}));
}

function normalizeRiskItems(items) {
	return (Array.isArray(items) ? items : []).slice(0, 6).map((item) => ({
		level: normalizePriority(item?.level),
		confidence: normalizePriority(item?.confidence),
		title: safeText(item?.title),
		detail: safeText(item?.detail),
		whyItMatters: safeText(item?.whyItMatters),
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
			file: safeText(item?.file),
			hunkId: safeText(item?.hunkId),
			priority: normalizePriority(item?.priority),
			reason: safeText(item?.reason)
		}))
		.filter((item) => validHunks.get(item.hunkId) === item.file);
}

function normalizeFollowUps(items) {
	return (Array.isArray(items) ? items : []).slice(0, 4).map((item) => ({
		prompt: safeText(item?.prompt),
		reason: safeText(item?.reason)
	}));
}

function normalizeEvidence(items) {
	return (Array.isArray(items) ? items : []).slice(0, 3).map((item) => ({
		file: safeText(item?.file),
		hunkId: safeText(item?.hunkId),
		startLine: Number.isInteger(item?.startLine) && item.startLine > 0 ? item.startLine : null,
		endLine: Number.isInteger(item?.endLine) && item.endLine > 0 ? item.endLine : null
	}));
}

function normalizePriority(value) {
	return value === 'high' || value === 'medium' ? value : 'low';
}

function safeText(value) {
	return typeof value === 'string' ? value.trim() : '';
}
