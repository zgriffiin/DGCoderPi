/**
 * Kiro Enterprise model catalog and helpers.
 *
 * Claude models available through Kiro Enterprise (AWS Bedrock via IAM Identity Center SSO).
 */

const KIRO_MODELS = [
	{
		id: 'us.anthropic.claude-opus-4-6',
		label: 'Claude Opus 4.6',
		reasoning: true,
		input: ['text', 'image'],
		thinkingLevels: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'],
		contextWindow: 1_000_000,
		maxTokens: 32_000
	},
	{
		id: 'us.anthropic.claude-sonnet-4-6',
		label: 'Claude Sonnet 4.6',
		reasoning: true,
		input: ['text', 'image'],
		thinkingLevels: ['off', 'minimal', 'low', 'medium', 'high'],
		contextWindow: 1_000_000,
		maxTokens: 32_000
	}
];

const KIRO_THINKING_LEVELS = new Map(KIRO_MODELS.map((model) => [model.id, model.thinkingLevels]));

/**
 * Returns the thinking levels supported by a specific Kiro model id, or null
 * when the id is not part of the Kiro catalog.
 */
export function kiroThinkingLevelsForId(id) {
	return KIRO_THINKING_LEVELS.get(id) ?? null;
}

export function buildKiroModelOptions() {
	return KIRO_MODELS.map((model) => ({
		availableThinkingLevels: model.thinkingLevels,
		configured: true,
		id: model.id,
		key: `kiro::${model.id}`,
		label: `${model.label} (Enterprise SSO)`,
		provider: 'kiro',
		supportsImages: model.input.includes('image'),
		supportsReasoning: model.reasoning
	}));
}

export function registerKiroProvider(modelRegistry, credential) {
	if (!credential) {
		modelRegistry.unregisterProvider('kiro');
		delete process.env.AWS_BEARER_TOKEN_BEDROCK;
		return;
	}

	const bearerToken = credential.key;
	if (!bearerToken || !credential.region) {
		modelRegistry.unregisterProvider('kiro');
		delete process.env.AWS_BEARER_TOKEN_BEDROCK;
		return;
	}

	process.env.AWS_BEARER_TOKEN_BEDROCK = bearerToken;
	process.env.AWS_REGION = credential.region;
	modelRegistry.registerProvider('kiro', {
		api: 'bedrock-converse-stream',
		apiKey: 'kiro-sso-token',
		baseUrl: `https://bedrock-runtime.${credential.region}.amazonaws.com`,
		models: KIRO_MODELS.map((model) => ({
			id: model.id,
			name: model.label,
			api: 'bedrock-converse-stream',
			reasoning: model.reasoning,
			input: model.input,
			contextWindow: model.contextWindow,
			maxTokens: model.maxTokens,
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0
			}
		}))
	});
}
