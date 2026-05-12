/**
 * Kiro Enterprise model catalog and helpers.
 *
 * Claude models available through Kiro Enterprise (AWS Bedrock via IAM Identity Center SSO).
 */

const KIRO_MODELS = [
	{
		id: 'claude-opus-4.6',
		label: 'Claude Opus 4.6',
		reasoning: true,
		input: ['text', 'image'],
		thinkingLevels: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']
	},
	{
		id: 'claude-sonnet-4.6',
		label: 'Claude Sonnet 4.6',
		reasoning: true,
		input: ['text', 'image'],
		thinkingLevels: ['off', 'minimal', 'low', 'medium', 'high']
	}
];

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
