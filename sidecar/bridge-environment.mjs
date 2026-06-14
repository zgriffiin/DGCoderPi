import { readCodexOauthCredential } from './codex-auth.mjs';
import { syncKiroSso as syncKiroSsoCredential } from './bridge-kiro.mjs';
import { registerKiroProvider, kiroThinkingLevelsForId } from './kiro-models.mjs';
import {
	isSupportedWorkbenchModel,
	modelLabel,
	PREFERRED_MODEL_KEYS,
	PROVIDERS,
	SUPPORTED_THINKING_LEVELS
} from './model-filter.mjs';

function thinkingLevelsForModel(model) {
	if (!model.reasoning) return ['off'];
	if (model.provider === 'kiro') {
		return kiroThinkingLevelsForId(model.id) ?? SUPPORTED_THINKING_LEVELS;
	}
	return SUPPORTED_THINKING_LEVELS;
}

export async function buildEnvironment(runtime) {
	await syncCodexOauth(runtime);
	await syncKiroSso(runtime);
	await runtime.modelRegistry.refresh();
	const codexCredential = runtime.authStorage.get('openai-codex');
	const kiroCredential = runtime.authStorage.get('kiro');
	registerKiroProvider(runtime.modelRegistry, kiroCredential);
	const usingChatGptSubscription = codexCredential?.type === 'oauth';
	const modelRank = new Map(PREFERRED_MODEL_KEYS.map((key, index) => [key, index]));
	const registryModels = runtime.modelRegistry
		.getAvailable()
		.filter((model) => isSupportedWorkbenchModel(model, usingChatGptSubscription))
		.map((model) => ({
			availableThinkingLevels: thinkingLevelsForModel(model),
			configured: true,
			id: model.id,
			key: `${model.provider}::${model.id}`,
			label: modelLabel(model, codexCredential),
			provider: model.provider,
			supportsImages: Array.isArray(model.input) && model.input.includes('image'),
			supportsReasoning: Boolean(model.reasoning)
		}));

	const allModels = registryModels.sort((left, right) => {
		const lr = modelRank.get(left.key) ?? Number.MAX_SAFE_INTEGER;
		const rr = modelRank.get(right.key) ?? Number.MAX_SAFE_INTEGER;
		return lr !== rr ? lr - rr : left.label.localeCompare(right.label);
	});

	return {
		models: allModels,
		providers: PROVIDERS.map(([provider, label]) => {
			if (provider === 'kiro') {
				const configured = Boolean(kiroCredential);
				return {
					configured,
					label,
					provider,
					source: configured ? 'IAM Identity Center SSO' : null
				};
			}
			const status = runtime.authStorage.getAuthStatus(provider);
			const cred = runtime.authStorage.get(provider);
			const source =
				cred?.type === 'oauth' && provider === 'openai-codex'
					? 'ChatGPT subscription'
					: (status.source ?? null);
			return { configured: status.configured, label, provider, source };
		})
	};
}

export async function syncCodexOauth(runtime) {
	const current = runtime.authStorage.get('openai-codex');
	if (current && current.type !== 'oauth') return;
	const credential = await readCodexOauthCredential();
	if (!credential) {
		if (current?.type === 'oauth') {
			runtime.authStorage.remove('openai-codex');
			runtime.disposeSessions();
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
	runtime.authStorage.set('openai-codex', { type: 'oauth', ...credential });
	runtime.disposeSessions();
}

export async function syncKiroSso(runtime) {
	await syncKiroSsoCredential(runtime.agentDir, runtime.authStorage, () =>
		runtime.disposeSessions()
	);
}
