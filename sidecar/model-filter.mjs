/**
 * Model filtering, labeling, and provider helpers for the bridge environment.
 */

const UNSUPPORTED_CHATGPT_CODEX_MODELS = new Set([
	'gpt-5.1',
	'gpt-5.1-codex-max',
	'gpt-5.1-codex-mini'
]);

const SUPPORTED_THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];

const PROVIDERS = [
	['anthropic', 'Anthropic'],
	['kiro', 'Kiro Enterprise'],
	['openai-codex', 'ChatGPT Codex'],
	['openai', 'OpenAI'],
	['google', 'Google Gemini'],
	['deepseek', 'DeepSeek'],
	['openrouter', 'OpenRouter']
];

const PREFERRED_MODEL_KEYS = [
	'openai-codex::gpt-5.5',
	'openai-codex::gpt-5.4',
	'kiro::claude-opus-4.6',
	'kiro::claude-sonnet-4.6',
	'openai::gpt-5.5',
	'openai::gpt-5.4',
	'openai::gpt-5.4-mini'
];

export {
	PREFERRED_MODEL_KEYS,
	PROVIDERS,
	SUPPORTED_THINKING_LEVELS,
	UNSUPPORTED_CHATGPT_CODEX_MODELS
};

export function isSupportedWorkbenchModel(model, usingChatGptSubscription) {
	if (model.provider === 'kiro') {
		return true;
	}
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

export function providerLabelForModel(model, codexCredential) {
	switch (model.provider) {
		case 'openai-codex':
			return codexCredential?.type === 'oauth' ? 'Pro Account' : 'API';
		case 'openai':
			return 'API';
		case 'kiro':
			return 'Enterprise SSO';
		default:
			return PROVIDERS.find(([provider]) => provider === model.provider)?.[1] ?? null;
	}
}

export function modelLabel(model, codexCredential) {
	const providerLabel = providerLabelForModel(model, codexCredential);
	return providerLabel ? `${model.name} (${providerLabel})` : model.name;
}
