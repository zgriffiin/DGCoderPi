import {
	createAgentSession,
	DefaultResourceLoader,
	SessionManager,
	SettingsManager,
	defineTool
} from '@mariozechner/pi-coding-agent';
import { normalizePriority } from './priority-utils.mjs';
import {
	coerceStructuredReviewShape,
	firstValue,
	hasStructuredReviewShape,
	safeText
} from './review-shape.mjs';
import { REVIEW_RESPONSE_SCHEMA, REVIEW_TOOL_SCHEMA } from './diff-analysis-schema.mjs';

const REVIEW_TOOL_NAME = 'diff_review_result';
const DIAGNOSTIC_TEXT_PREVIEW_ENABLED = process.env.DGCODER_PI_DIFF_ANALYSIS_DEBUG === 'true';
const OPENAI_RESPONSES_TIMEOUT_MS = 20_000;

function openAiResponsesUrl(baseUrl) {
	return /\/v1$/i.test(baseUrl) ? `${baseUrl}/responses` : `${baseUrl}/v1/responses`;
}

export async function analyzeDiff(runtime, payload) {
	const model = runtime.resolveModel(payload.modelKey);
	if (model.provider === 'openai' && model.api === 'openai-responses') {
		return analyzeDiffWithOpenAIResponses(runtime, payload, model);
	}

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
		const structuredResult = capturedResult
			? hasStructuredReviewShape(capturedResult)
				? capturedResult
				: null
			: extractStructuredReviewResult(session.getLastAssistantText());
		if (!structuredResult) {
			const diagnostics = buildDiffAnalysisDiagnostics(session, model, payload.modelKey);
			console.error('[diff-analysis]', JSON.stringify(diagnostics));
			throw new Error('Diff analysis did not return a structured result.');
		}
		return normalizeReviewResult(payload, structuredResult);
	} finally {
		session.dispose();
	}
}

async function analyzeDiffWithOpenAIResponses(runtime, payload, model) {
	const apiKey = await runtime.authStorage.getApiKey(model.provider);
	if (!apiKey) {
		throw new Error('OpenAI API key is not configured for diff analysis.');
	}
	const baseUrl =
		typeof model.baseUrl === 'string' && model.baseUrl ? model.baseUrl.replace(/\/$/, '') : null;
	if (!baseUrl) {
		throw new TypeError('OpenAI diff analysis requires a configured base URL.');
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), OPENAI_RESPONSES_TIMEOUT_MS);
	let response;
	try {
		response = await fetch(openAiResponsesUrl(baseUrl), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				input: [
					{ role: 'system', content: buildStructuredOutputSystemPrompt() },
					{ role: 'user', content: buildPrompt(payload, { useTool: false }) }
				],
				model: model.id,
				text: {
					format: {
						description: 'A structured diff review result.',
						name: 'diff_review_result',
						schema: REVIEW_RESPONSE_SCHEMA,
						strict: true,
						type: 'json_schema'
					}
				}
			}),
			signal: controller.signal
		});
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(
				`OpenAI diff analysis timed out after ${OPENAI_RESPONSES_TIMEOUT_MS / 1000} seconds.`,
				{ cause: error }
			);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}

	const body = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(body?.error?.message ?? `OpenAI diff analysis failed: ${response.status}`);
	}

	const text = extractResponseOutputText(body);
	const structuredResult = extractStructuredReviewResult(text);
	if (!structuredResult) {
		console.error(
			'[diff-analysis]',
			JSON.stringify({
				api: model.api,
				baseUrl: model.baseUrl,
				model: model.id,
				modelKey: payload.modelKey,
				outputTypes: Array.isArray(body?.output) ? body.output.map((item) => item.type) : [],
				provider: model.provider
			})
		);
		throw new Error('Diff analysis did not return a structured result.');
	}

	return normalizeReviewResult(payload, structuredResult);
}

function buildSystemPrompt() {
	return [
		'You are DGCoder Diff Review.',
		'Explain a code diff for a technical user who may not be a daily programmer.',
		'Ground every claim in the provided files and hunk ids.',
		'Prefer product behavior and user-facing consequences over internal jargon.',
		`Always finish by calling ${REVIEW_TOOL_NAME}.`,
		'If tool calls are unavailable, reply with JSON only. Do not include Markdown, prose, or code fences.',
		'Keep each list concise and avoid filler.'
	].join('\n');
}

function buildStructuredOutputSystemPrompt() {
	return [
		'You are DGCoder Diff Review.',
		'Explain a code diff for a technical user who may not be a daily programmer.',
		'Ground every claim in the provided files and hunk ids.',
		'Prefer product behavior and user-facing consequences over internal jargon.',
		'Return only the structured JSON object requested by the response schema.',
		'Keep each list concise and avoid filler.'
	].join('\n');
}

function buildPrompt(payload, options = { useTool: true }) {
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
		`Review batch: ${payload.batchIndex ?? 1} of ${payload.batchCount ?? 1}.`,
		'',
		'Review requirements:',
		'- Review only the files and hunks included in this batch payload.',
		'- Write findings so they can be merged with other batch reviews.',
		'- Change Brief: 2-5 plain-English bullets about what changed.',
		'- Impact: concrete workflows, features, settings, or runtime behavior affected.',
		'- Risk Review: include only concrete concerns with level and confidence.',
		'- Focus Queue: the best files or hunks to inspect first.',
		'- Suggested Follow-Up: only grounded next questions or prompts.',
		'- Every item must point to real files and hunk ids when possible.',
		'- If the diff is mechanical, say so plainly instead of inventing risk.',
		options.useTool
			? '- Return the result by calling the diff_review_result tool.'
			: '- Return one JSON object matching the response schema.',
		options.useTool
			? '- If no tool call is made, your entire assistant message must be one JSON object with this exact top-level shape:'
			: '- The JSON object must have this exact top-level shape:',
		JSON.stringify(reviewResultJsonExample(payload.diff.files), null, 2),
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

function reviewResultJsonExample(files) {
	const safeFiles =
		Array.isArray(files) && files.length > 0 ? files : [{ path: 'path/to/file.ts', hunks: [] }];
	const firstFile =
		safeFiles.find((file) => Array.isArray(file.hunks) && file.hunks.length > 0) ?? safeFiles[0];
	const firstHunk = Array.isArray(firstFile?.hunks) ? firstFile.hunks[0] : null;
	const filePath = firstFile?.path ?? 'path/to/file.ts';
	const hunkId = firstHunk?.id ?? `${filePath}:1:1:0`;
	return {
		changeBrief: [
			{
				title: 'What changed',
				detail: 'Plain-language summary grounded in the diff.',
				evidence: [{ file: filePath, hunkId, startLine: 1, endLine: 1 }]
			}
		],
		impact: [
			{
				area: 'Runtime behavior',
				detail: 'What user-visible behavior may change.',
				evidence: [filePath]
			}
		],
		risks: [],
		focusQueue: [
			{ file: filePath, hunkId, priority: 'medium', reason: 'Best hunk to inspect first.' }
		],
		suggestedFollowUps: [
			{ prompt: 'Ask a grounded follow-up question.', reason: 'Why this is useful.' }
		]
	};
}

function buildDiffAnalysisDiagnostics(session, model, modelKey) {
	const lastAssistant = [...session.messages]
		.reverse()
		.find((message) => message.role === 'assistant');
	const assistantBlocks = Array.isArray(lastAssistant?.content)
		? lastAssistant.content.map((block) => block.type)
		: [];
	const toolCalls = Array.isArray(lastAssistant?.content)
		? lastAssistant.content
				.filter((block) => block.type === 'toolCall')
				.map((block) => ({
					id: block.id,
					name: block.name
				}))
		: [];

	const diagnostics = {
		api: model.api,
		assistantBlocks,
		baseUrl: model.baseUrl,
		model: model.id,
		modelKey,
		provider: model.provider,
		toolCallCount: toolCalls.length,
		toolCalls
	};

	if (DIAGNOSTIC_TEXT_PREVIEW_ENABLED) {
		diagnostics.lastAssistantTextPreview = truncateText(session.getLastAssistantText(), 800);
	}

	return diagnostics;
}

function extractStructuredReviewResult(text) {
	if (!text) {
		return null;
	}

	for (const candidate of reviewResultCandidates(text)) {
		const parsed = tryParseStructuredReview(candidate);
		if (parsed) {
			return coerceStructuredReviewShape(parsed);
		}
	}

	return null;
}

function extractResponseOutputText(response) {
	if (typeof response?.output_text === 'string') {
		return response.output_text;
	}

	return (Array.isArray(response?.output) ? response.output : [])
		.flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
		.map((content) => content?.text ?? '')
		.filter(Boolean)
		.join('\n');
}

function reviewResultCandidates(text) {
	const candidates = new Set();
	const trimmed = text.trim();
	if (trimmed) {
		candidates.add(trimmed);
	}

	const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fencedMatch?.[1]?.trim()) {
		candidates.add(fencedMatch[1].trim());
	}

	const firstBrace = trimmed.indexOf('{');
	const lastBrace = trimmed.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace > firstBrace) {
		candidates.add(trimmed.slice(firstBrace, lastBrace + 1));
	}

	return [...candidates];
}

function tryParseStructuredReview(candidate) {
	try {
		const parsed = unwrapStructuredReview(JSON.parse(candidate));
		const coerced = coerceStructuredReviewShape(parsed);
		return hasStructuredReviewShape(coerced) ? coerced : null;
	} catch {
		return null;
	}
}

function unwrapStructuredReview(value) {
	if (hasStructuredReviewShape(value)) {
		return value;
	}
	if (hasStructuredReviewShape(value?.diffReviewResult)) {
		return value.diffReviewResult;
	}
	if (hasStructuredReviewShape(value?.diff_review_result)) {
		return value.diff_review_result;
	}
	if (hasStructuredReviewShape(value?.review)) {
		return value.review;
	}
	if (hasStructuredReviewShape(value?.result)) {
		return value.result;
	}
	return value;
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

function truncateText(value, maxChars) {
	if (!value || value.length <= maxChars) {
		return value ?? '';
	}
	return `${value.slice(0, maxChars)}...`;
}
