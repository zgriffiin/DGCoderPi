import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	ModelRegistry,
	SessionManager,
	SettingsManager
} from '@mariozechner/pi-coding-agent';

import { readCodexOauthCredential } from './codex-auth.mjs';
import { parseAttachment } from './docparser.mjs';
import {
	flattenAssistantContent,
	flattenToolResultContent,
	flattenUserContent
} from './message-content-format.mjs';

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

const PREFERRED_MODEL_KEYS = ['openai-codex::gpt-5.4'];

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
		if (!key) {
			this.authStorage.remove(provider);
		} else {
			this.authStorage.set(provider, { type: 'api_key', key });
		}

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
			await sessionEntry.session.abort();
			this.emitThreadUpdate(payload.threadId, sessionEntry.session, {
				detail: 'Pi was asked to stop the current run.',
				title: 'Run stopped',
				tone: 'system'
			});
		}
		return {};
	}

	buildEnvironment() {
		this.syncCodexOauth();
		this.modelRegistry.refresh();
		const codexCredential = this.authStorage.get('openai-codex');
		const usingChatGptSubscription = codexCredential?.type === 'oauth';
		const modelRank = new Map(PREFERRED_MODEL_KEYS.map((key, index) => [key, index]));
		return {
			models: this.modelRegistry
				.getAvailable()
				.filter(
					(model) =>
						!(
							usingChatGptSubscription &&
							model.provider === 'openai-codex' &&
							UNSUPPORTED_CHATGPT_CODEX_MODELS.has(model.id)
						)
				)
				.map((model) => ({
					availableThinkingLevels: model.reasoning
						? ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']
						: ['off'],
					configured: true,
					id: model.id,
					key: `${model.provider}::${model.id}`,
					label: model.name,
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

	syncCodexOauth() {
		const current = this.authStorage.get('openai-codex');
		const credential = readCodexOauthCredential();
		if (!credential) {
			if (current?.type === 'oauth') this.authStorage.remove('openai-codex');
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
			noContextFiles: true,
			noExtensions: !this.features.docparserEnabled,
			noPromptTemplates: true,
			noSkills: true,
			noThemes: true
		});
	}

	async ensureSession(payload) {
		const existing = this.sessions.get(payload.threadId);
		if (
			existing &&
			existing.cwd === payload.cwd &&
			existing.modelKey === payload.modelKey &&
			existing.thinkingLevel === payload.thinkingLevel
		) {
			return existing;
		}

		if (existing) {
			existing.unsubscribe();
			existing.session.dispose();
			this.sessions.delete(payload.threadId);
		}

		const model = this.resolveModel(payload.modelKey);
		const settingsManager = SettingsManager.inMemory({
			compaction: { enabled: false },
			retry: { enabled: true, maxRetries: 2 }
		});
		const loader = this.createLoader(payload.cwd, settingsManager);
		await loader.reload();

		const { session } = await createAgentSession({
			agentDir: this.agentDir,
			authStorage: this.authStorage,
			cwd: payload.cwd,
			model,
			modelRegistry: this.modelRegistry,
			resourceLoader: loader,
			sessionManager: SessionManager.inMemory(payload.cwd),
			settingsManager,
			thinkingLevel: payload.thinkingLevel
		});

		const unsubscribe = session.subscribe((event) => {
			this.emitThreadUpdate(payload.threadId, session, this.buildActivity(event));
		});

		const entry = {
			cwd: payload.cwd,
			model,
			modelKey: payload.modelKey,
			session,
			thinkingLevel: payload.thinkingLevel,
			unsubscribe
		};
		this.sessions.set(payload.threadId, entry);
		this.emitThreadUpdate(payload.threadId, session, {
			detail: `Session ready in ${payload.cwd}.`,
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
			try {
				await command();
				const sessionEntry = this.sessions.get(threadId);
				if (!sessionEntry) {
					return;
				}

				this.emitThreadUpdate(threadId, sessionEntry.session, null);
			} catch (error) {
				const sessionEntry = this.sessions.get(threadId);
				if (!sessionEntry) {
					return;
				}

				this.emitThreadUpdate(threadId, sessionEntry.session, {
					detail: error instanceof Error ? error.message : String(error),
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

			const data = await readFileBase64(attachment.path);
			images.push({ data, mimeType: attachment.mimeType, type: 'image' });
		}
		return images;
	}

	buildActivity(event) {
		if (event.type === 'agent_start') {
			return { detail: 'Pi accepted the current turn.', title: 'Run started', tone: 'system' };
		}

		if (event.type === 'agent_end') {
			return { detail: 'Pi finished the current turn.', title: 'Run complete', tone: 'system' };
		}

		if (event.type === 'tool_execution_start') {
			return {
				detail: `${event.toolName} started.`,
				title: 'Tool running',
				tone: 'tool'
			};
		}

		if (event.type === 'tool_execution_end') {
			return {
				detail: event.isError
					? `${event.toolName} reported an error.`
					: `${event.toolName} completed successfully.`,
				title: 'Tool finished',
				tone: 'tool'
			};
		}

		if (event.type === 'queue_update') {
			return {
				detail: `${event.steering.length} steer and ${event.followUp.length} follow-up items pending.`,
				title: 'Queue updated',
				tone: 'system'
			};
		}

		if (event.type === 'auto_retry_start') {
			return {
				detail: `Retry ${event.attempt} of ${event.maxAttempts} after ${event.delayMs}ms.`,
				title: 'Retry scheduled',
				tone: 'system'
			};
		}

		if (event.type === 'compaction_start') {
			return {
				detail: `Compaction started because of ${event.reason}.`,
				title: 'Compaction running',
				tone: 'system'
			};
		}

		return null;
	}

	emitThreadUpdate(threadId, session, activity) {
		writeMessage({
			activity,
			snapshot: {
				lastError: session.state.errorMessage ?? this.lastAssistantError(session.messages),
				messages: session.messages.map((message, index) => serializeMessage(message, index)),
				queue: [
					...serializeQueue(session.getSteeringMessages(), 'steer'),
					...serializeQueue(session.getFollowUpMessages(), 'follow-up')
				],
				status: this.sessionStatus(session)
			},
			threadId,
			type: 'thread-update'
		});
	}

	lastAssistantError(messages) {
		const lastAssistant = [...messages]
			.reverse()
			.find((message) => message && message.role === 'assistant');
		return lastAssistant?.errorMessage ?? null;
	}

	sessionStatus(session) {
		if (session.isStreaming) {
			return 'running';
		}

		if (session.state.errorMessage || this.lastAssistantError(session.messages)) {
			return 'failed';
		}

		return session.messages.length === 0 ? 'idle' : 'completed';
	}
}

function serializeQueue(items, mode) {
	return items.map((text, index) => ({
		id: `${mode}-${index}`,
		mode,
		status: 'pending',
		text
	}));
}

function serializeMessage(message, index) {
	if (message.role === 'user') {
		return {
			id: `${message.timestamp}-user-${index}`,
			role: 'user',
			status: 'ready',
			text: flattenUserContent(message.content),
			timestampMs: message.timestamp
		};
	}

	if (message.role === 'assistant') {
		return {
			id: `${message.timestamp}-assistant-${index}`,
			role: 'assistant',
			status: message.stopReason === 'error' ? 'failed' : 'ready',
			text: flattenAssistantContent(message.content),
			timestampMs: message.timestamp
		};
	}

	if (message.role === 'toolResult') {
		return {
			id: `${message.timestamp}-tool-${index}`,
			role: 'tool',
			status: message.isError ? 'failed' : 'ready',
			text: flattenToolResultContent(message.content),
			timestampMs: message.timestamp
		};
	}

	return {
		id: `${Date.now()}-system-${index}`,
		role: 'system',
		status: 'ready',
		text: 'Unsupported message type.',
		timestampMs: Date.now()
	};
}

async function readFileBase64(filePath) {
	const buffer = await readFile(filePath);
	return buffer.toString('base64');
}

function writeMessage(message) {
	process.stdout.write(`${JSON.stringify(message)}\n`);
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
