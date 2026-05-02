import type { AppSettings, AppSnapshot, FeatureSettings } from '$lib/types/workbench';

const DEFAULT_FEATURE_SETTINGS: FeatureSettings = {
	diagnosticLoggingEnabled: true,
	docparserEnabled: true
};

const DEFAULT_APP_SETTINGS: AppSettings = {
	diffAnalysisModelKey: null,
	features: DEFAULT_FEATURE_SETTINGS,
	providers: [
		{ configured: false, label: 'Anthropic', provider: 'anthropic', source: null },
		{ configured: false, label: 'ChatGPT Codex', provider: 'openai-codex', source: null },
		{ configured: false, label: 'OpenAI', provider: 'openai', source: null },
		{ configured: false, label: 'Google Gemini', provider: 'google', source: null },
		{ configured: false, label: 'DeepSeek', provider: 'deepseek', source: null },
		{ configured: false, label: 'OpenRouter', provider: 'openrouter', source: null }
	]
};

export const EMPTY_SNAPSHOT: AppSnapshot = {
	health: {
		bridgeStatus: 'offline',
		configuredProviderCount: 0,
		modelCount: 0
	},
	integrations: {
		codex: {
			authMode: null,
			authenticated: false,
			available: false,
			canImportOpenAiKey: false,
			cliPath: null,
			displayStatus: 'Codex CLI not installed'
		}
	},
	models: [],
	projects: [],
	selectedProjectId: null,
	selectedThreadId: null,
	settings: DEFAULT_APP_SETTINGS
};
