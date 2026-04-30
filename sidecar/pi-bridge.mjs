import { readFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	ModelRegistry,
	SettingsManager
} from '@mariozechner/pi-coding-agent';
import { readCodexOauthCredential } from './codex-auth.mjs';
import { analyzeDiff } from './diff-analysis.mjs';
import { parseAttachment } from './docparser.mjs';
import {
	evictDormantSessions,
	recordSessionPreferences,
	sessionManagerForPayload,
	touchSession
} from './session-history.mjs';
import { buildActivity, buildThreadSnapshot } from './thread-snapshot.mjs';
const PROVIDERS = [
	['anthropic', 'Anthropic'],
	['openai-codex', 'ChatGPT Codex'],
	['openai', 'OpenAI'],
	['google', 'Google Gemini'],
	['deepseek', 'DeepSeek'],
	['openrouter', 'OpenRouter']
];
const UNSUPPORTED_CHATGPT_CODEX_MODELS = new Set([
	'gpt-5.1',
	'gpt-5.1-codex-max',
	'gpt-5.1-codex-mini'
]);
const SUPPORTED_THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];
const PREFERRED_MODEL_KEYS = [
	'openai-codex::gpt-5.5',
	'openai-codex::gpt-5.4',
	'openai::gpt-5.5',
	'openai::gpt-5.4',
	'openai::gpt-5.4-mini'
];
const MAX_IMAGE_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function formatBytes(bytes) {
	if (bytes >= 1024 * 1024) {
		return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
	}
	if (bytes >= 1024) {
		return `${Math.round((bytes / 1024) * 10) / 10} KB`;
	}
	return `${bytes} bytes`;
}

function isSupportedWorkbenchModel(model, usingChatGptSubscription) {
	if (
		(model.provider === 'openai' || model.provider === 'openai-codex') &&
		!model.id.startsWith('gpt-5')
	) {
		return false;
	}
	return !(
		usingChatGptSubscription &&
		model.provider === 'openai-codex' &&
		UNSUPPORTED_CHATGPT_CODEX_MODELS.has(model.id)
	);
}

function modelLabel(model) {
	const providerLabel =
		model.provider === 'openai-codex'
			? 'Pro Account'
			: model.provider === 'openai'
				? 'API'
				: PROVIDERS.find(([provider]) => provider === model.provider)?.[1];
	return providerLabel ? `${model.name} (${providerLabel})` : model.name;
}

class BridgeRuntime {
	constructor() {
		this.agentDir = '';
		this.authStorage = undefined;
		this.features = { docparserEnabled: true };
		this.modelRegistry = undefined;
		this.sessions = new Map();
	}

	async bootstrap(payload) {
		this.agentDir = path.join(payload.appDataDir, 'pi-agent');
		this.features = { docparserEnabled: Boolean(payload.docparserEnabled) };
		await mkdir(this.agentDir, { recursive: true });
		this.authStorage = AuthStorage.create(path.join(this.agentDir, 'auth.json'));
		this.modelRegistry = ModelRegistry.create(
			this.authStorage,
			path.join(this.agentDir, 'models.json')
		);
		this.disposeSessions();
		return this.buildEnvironment();
	}

	async listModels() {
		return this.buildEnvironment();
	}

	async setApiKey(payload) {
		const provider = payload.provider?.trim();
		if (!provider) {
			throw new Error('A provider id is required.');
		}

		const key = payload.key?.trim() ?? '';
		if (key) this.authStorage.set(provider, { type: 'api_key', key });
		else this.authStorage.remove(provider);

		this.disposeSessions();
		return this.buildEnvironment();
	}

	async setFeatures(payload) {
		this.features = { docparserEnabled: Boolean(payload.docparserEnabled) };
		this.disposeSessions();
		return this.buildEnvironment();
	}

	async parseAttachment(payload) {
		return parseAttachment({
			enabled: this.features.docparserEnabled,
			filePath: path.resolve(payload.path)
		});
	}

	async analyzeDiff(payload) {
		return analyzeDiff(this, payload);
	}

	async sendPrompt(payload) {
		return this.runTurn(payload, (session, prompt, images) => session.prompt(prompt, { images }));
	}

	async steer(payload) {
		return this.runTurn(payload, (session, prompt, images) => session.steer(prompt, images));
	}

	async followUp(payload) {
		return this.runTurn(payload, (session, prompt, images) => session.followUp(prompt, images));
	}

	async runTurn(payload, executeTurn) {
		const sessionEntry = await this.ensureSession(payload);
		touchSession(sessionEntry);
		const images = await this.collectImages(payload.attachments, sessionEntry.model);
		const prompt = this.formatPrompt(payload.text, payload.attachments);
		this.runSessionCommand(payload.threadId, () =>
			executeTurn(sessionEntry.session, prompt, images)
		);
		return {};
	}

	async abort(payload) {
		const sessionEntry = this.sessions.get(payload.threadId);
		if (sessionEntry) {
			touchSession(sessionEntry);
			await sessionEntry.session.abort();
			this.emitThreadUpdate(payload.threadId, sessionEntry.session, {
				detail: 'The current run was stopped.',
				title: 'Run stopped',
				tone: 'system'
			});
		}
		return {};
	}

	async buildEnvironment() {
		await this.syncCodexOauth();
		this.modelRegistry.refresh();
		const codexCredential = this.authStorage.get('openai-codex');
		const usingChatGptSubscription = codexCredential?.type === 'oauth';
		const modelRank = new Map(PREFERRED_MODEL_KEYS.map((key, index) => [key, index]));
		return {
			models: this.modelRegistry
				.getAvailable()
				.filter((model) => isSupportedWorkbenchModel(model, usingChatGptSubscription))
				.map((model) => ({
					availableThinkingLevels: model.reasoning ? SUPPORTED_THINKING_LEVELS : ['off'],
					configured: true,
					id: model.id,
					key: `${model.provider}::${model.id}`,
					label: modelLabel(model),
					provider: model.provider,
					supportsImages: Array.isArray(model.input) && model.input.includes('image'),
					supportsReasoning: Boolean(model.reasoning)
				}))
				.sort((left, right) => {
					const leftRank = modelRank.get(left.key) ?? Number.MAX_SAFE_INTEGER;
					const rightRank = modelRank.get(right.key) ?? Number.MAX_SAFE_INTEGER;
					if (leftRank !== rightRank) {
						return leftRank - rightRank;
					}
					return left.label.localeCompare(right.label);
				}),
			providers: PROVIDERS.map(([provider, label]) => {
				const status = this.authStorage.getAuthStatus(provider);
				const credential = this.authStorage.get(provider);
				return {
					configured: status.configured,
					label,
					provider,
					source:
						credential?.type === 'oauth' && provider === 'openai-codex'
							? 'ChatGPT subscription'
							: (status.source ?? null)
				};
			})
		};
	}

	async syncCodexOauth() {
		const current = this.authStorage.get('openai-codex');
		if (current && current.type !== 'oauth') return;
		const credential = await readCodexOauthCredential();
		if (!credential) {
			if (current?.type === 'oauth') {
				this.authStorage.remove('openai-codex');
				this.disposeSessions();
			}
			return;
		}
		if (
			current?.type === 'oauth' &&
			current.access === credential.access &&
			current.refresh === credential.refresh &&
			current.expires === credential.expires &&
			current.accountId === credential.accountId
		) {
			return;
		}
		this.authStorage.set('openai-codex', { type: 'oauth', ...credential });
		this.disposeSessions();
	}

	createLoader(cwd, settingsManager) {
		const docparserPath = path.resolve('node_modules/pi-docparser/extensions/docparser/index.ts');
		return new DefaultResourceLoader({
			agentDir: this.agentDir,
			cwd,
			settingsManager,
			additionalExtensionPaths: this.features.docparserEnabled ? [docparserPath] : [],
			extensionsOverride: (base) => ({
				...base,
				extensions: this.features.docparserEnabled
					? base.extensions.filter((extension) => extension.resolvedPath === docparserPath)
					: []
			}),
			noExtensions: !this.features.docparserEnabled,
			noThemes: true
		});
	}

	async ensureSession(payload) {
		const existing = this.sessions.get(payload.threadId);
		const model = this.resolveModel(payload.modelKey);
		const requestedCwd = typeof payload.cwd === 'string' ? payload.cwd.trim() : '';
		if (
			existing &&
			existing.cwd === requestedCwd &&
			existing.modelKey === payload.modelKey &&
			existing.thinkingLevel === payload.thinkingLevel
		) {
			touchSession(existing);
			return existing;
		}

		const { cwd, sessionManager } = sessionManagerForPayload(existing, payload, this.agentDir);

		if (existing) {
			recordSessionPreferences(existing, model, payload.thinkingLevel);
			existing.unsubscribe();
			existing.session.dispose();
			this.sessions.delete(payload.threadId);
		}

		const settingsManager = SettingsManager.inMemory({
			compaction: { enabled: false },
			retry: { enabled: true, maxRetries: 2 }
		});
		const loader = this.createLoader(cwd, settingsManager);
		await loader.reload();

		const { session } = await createAgentSession({
			agentDir: this.agentDir,
			authStorage: this.authStorage,
			cwd,
			model,
			modelRegistry: this.modelRegistry,
			resourceLoader: loader,
			sessionManager,
			settingsManager,
			thinkingLevel: payload.thinkingLevel
		});

		const unsubscribe = session.subscribe((event) => {
			this.emitThreadUpdate(payload.threadId, session, buildActivity(event));
		});

		const entry = {
			cwd,
			lastTouchedAt: Date.now(),
			model,
			modelKey: payload.modelKey,
			session,
			sessionManager,
			thinkingLevel: payload.thinkingLevel,
			unsubscribe
		};
		this.sessions.set(payload.threadId, entry);
		evictDormantSessions(this.sessions);
		this.emitThreadUpdate(payload.threadId, session, {
			detail: `Session ready in ${cwd}.`,
			title: 'Thread ready',
			tone: 'system'
		});
		return entry;
	}

	resolveModel(modelKey) {
		const [provider, ...rest] = modelKey.split('::');
		const modelId = rest.join('::');
		const model = this.modelRegistry.find(provider, modelId);
		if (!model) {
			throw new Error(`Configured model was not found: ${modelKey}`);
		}
		return model;
	}

	disposeSessions() {
		for (const entry of this.sessions.values()) {
			entry.unsubscribe();
			entry.session.dispose();
		}
		this.sessions.clear();
	}

	runSessionCommand(threadId, command) {
		void (async () => {
			const sessionEntry = this.sessions.get(threadId);
			if (!sessionEntry) return;
			try {
				touchSession(sessionEntry);
				await command();
				if (this.sessions.get(threadId) !== sessionEntry) {
					return;
				}

				touchSession(sessionEntry);
				const assistantError = findLatestAssistantError(sessionEntry.session);
				if (assistantError) {
					logSessionCommandFailure(assistantError, sessionEntry);
					this.emitThreadUpdate(threadId, sessionEntry.session, {
						detail: describeSessionCommandError(assistantError, sessionEntry),
						title: 'Session command failed',
						tone: 'system'
					});
					return;
				}
				this.emitThreadUpdate(threadId, sessionEntry.session, null);
			} catch (error) {
				if (this.sessions.get(threadId) !== sessionEntry) {
					return;
				}

				touchSession(sessionEntry);
				logSessionCommandFailure(error, sessionEntry);
				this.emitThreadUpdate(threadId, sessionEntry.session, {
					detail: describeSessionCommandError(error, sessionEntry),
					title: 'Session command failed',
					tone: 'system'
				});
			}
		})();
	}

	formatPrompt(text, attachments) {
		if (!attachments || attachments.length === 0) {
			return text;
		}

		const lines = attachments.map((attachment) => {
			const preview = attachment.previewText ? `\n  Preview: ${attachment.previewText}` : '';
			return `- ${attachment.name} (${attachment.mimeType}) at ${attachment.path}${preview}`;
		});

		return `${text}\n\nAttached files:\n${lines.join('\n')}\nUse the local file paths above when you need to inspect these attachments.`;
	}

	async collectImages(attachments, model) {
		if (
			!attachments ||
			attachments.length === 0 ||
			!Array.isArray(model.input) ||
			!model.input.includes('image')
		) {
			return [];
		}

		const images = [];
		for (const attachment of attachments) {
			if (attachment.kind !== 'image') {
				continue;
			}

			const metadata = await stat(attachment.path);
			if (metadata.size > MAX_IMAGE_ATTACHMENT_BYTES) {
				throw new Error(
					`Image attachment exceeds ${formatBytes(MAX_IMAGE_ATTACHMENT_BYTES)}: ${attachment.name}`
				);
			}
			const data = (await readFile(attachment.path)).toString('base64');
			images.push({ data, mimeType: attachment.mimeType, type: 'image' });
		}
		return images;
	}

	emitThreadUpdate(threadId, session, activity) {
		writeMessage({
			activity,
			snapshot: buildThreadSnapshot(session),
			threadId,
			type: 'thread-update'
		});
	}
}

function writeMessage(message) {
	process.stdout.write(`${JSON.stringify(message)}\n`);
}

function describeSessionCommandError(error, sessionEntry) {
	const message = error instanceof Error ? error.message : String(error);
	const modelKey = sessionEntry?.modelKey ?? 'unknown model';
	const thinkingLevel = sessionEntry?.thinkingLevel ?? 'unknown reasoning';
	return `${modelKey} (${thinkingLevel}) failed: ${message}`;
}

function logSessionCommandFailure(error, sessionEntry) {
	const details = {
		cause: serializeErrorCause(error),
		error: error instanceof Error ? error.message : String(error),
		modelKey: sessionEntry?.modelKey ?? null,
		provider: sessionEntry?.model?.provider ?? null,
		stack: error instanceof Error ? error.stack : null,
		thinkingLevel: sessionEntry?.thinkingLevel ?? null
	};
	console.error('[session-command-failed]', JSON.stringify(details));
}

function findLatestAssistantError(session) {
	const messages = Array.isArray(session?.messages) ? session.messages : [];
	const latestAssistant = [...messages].reverse().find((message) => message?.role === 'assistant');
	if (latestAssistant?.stopReason !== 'error' || !latestAssistant.errorMessage) {
		return null;
	}
	return new Error(latestAssistant.errorMessage);
}

function serializeErrorCause(error) {
	if (!(error instanceof Error) || !error.cause) {
		return null;
	}

	const cause = error.cause;
	if (cause instanceof Error) {
		return {
			code: cause.code ?? null,
			message: cause.message,
			name: cause.name
		};
	}

	return String(cause);
}

async function dispatch(runtime, line) {
	const command = JSON.parse(line);
	if (!command || typeof command.type !== 'string') {
		throw new Error('Invalid bridge command payload.');
	}

	const handlerName = commandName(command.type);
	if (typeof runtime[handlerName] !== 'function') {
		throw new Error(`Unsupported bridge command: ${command.type}`);
	}

	const payload = await runtime[handlerName](command.payload ?? {});
	writeMessage({ id: command.id, ok: true, payload });
}

function commandName(value) {
	return value
		.split('-')
		.map((segment, index) =>
			index === 0 ? segment : `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`
		)
		.join('');
}

async function main() {
	const runtime = new BridgeRuntime();
	const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

	for await (const line of rl) {
		if (!line.trim()) {
			continue;
		}

		try {
			await dispatch(runtime, line);
		} catch (error) {
			const command = safeParse(line);
			writeMessage({
				error: error instanceof Error ? error.message : String(error),
				id: command?.id ?? '',
				ok: false
			});
		}
	}
}

function safeParse(text) {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
