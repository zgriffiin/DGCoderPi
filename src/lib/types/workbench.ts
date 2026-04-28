type ActivityTone = 'assistant' | 'system' | 'tool';

type AttachmentKind = 'binary' | 'code' | 'data' | 'document' | 'image' | 'text';

type AttachmentParseStatus = 'failed' | 'idle' | 'parsing' | 'ready';

type AttachmentStage = 'sent' | 'staged';

type MessageRole = 'assistant' | 'system' | 'tool' | 'user';

type MessageStatus = 'failed' | 'ready' | 'streaming';

export type ThinkingLevel = 'high' | 'low' | 'medium' | 'minimal' | 'off' | 'xhigh';

export type InspectorMode = 'diff' | 'spec' | 'tasks';

export type PromptMode = 'follow-up' | 'prompt' | 'steer';

type QueueMode = 'follow-up' | 'steer';

type QueueStatus = 'failed' | 'pending';

type ThreadStatus = 'completed' | 'failed' | 'idle' | 'running';

export interface AppSnapshot {
	health: AppHealth;
	integrations: AppIntegrations;
	models: ModelOption[];
	projects: ProjectRecord[];
	selectedProjectId: string | null;
	selectedThreadId: string | null;
	settings: AppSettings;
}

interface AppHealth {
	bridgeStatus: string;
	configuredProviderCount: number;
	modelCount: number;
}

interface AppIntegrations {
	codex: CodexStatus;
}

interface AppSettings {
	features: FeatureSettings;
	providers: ProviderStatus[];
}

interface FeatureSettings {
	docparserEnabled: boolean;
}

export interface CodexStatus {
	authMode: string | null;
	authenticated: boolean;
	available: boolean;
	canImportOpenAiKey: boolean;
	cliPath: string | null;
	displayStatus: string;
}

export interface ProviderStatus {
	configured: boolean;
	label: string;
	provider: string;
	source: string | null;
}

export interface ModelOption {
	availableThinkingLevels?: ThinkingLevel[];
	configured: boolean;
	id: string;
	key: string;
	label: string;
	provider: string;
	supportsImages: boolean;
	supportsReasoning: boolean;
}

export interface ProjectRecord {
	branch: string;
	id: string;
	name: string;
	path: string;
	threads: ThreadRecord[];
}

export interface ThreadRecord {
	activities: ActivityRecord[];
	attachments: AttachmentRecord[];
	branch: string;
	id: string;
	lastError: string | null;
	messages: MessageRecord[];
	modelKey: string | null;
	queue: QueueEntry[];
	reasoningLevel: ThinkingLevel;
	status: ThreadStatus;
	title: string;
	updatedAtMs: number;
}

interface ActivityRecord {
	detail: string;
	id: string;
	timestampMs: number;
	title: string;
	tone: ActivityTone;
}

export interface AttachmentRecord {
	id: string;
	kind: AttachmentKind;
	mimeType: string;
	name: string;
	parseStatus: AttachmentParseStatus;
	path: string;
	previewText: string | null;
	sizeBytes: number;
	stage: AttachmentStage;
	warnings: string[];
}

export interface MessageRecord {
	id: string;
	role: MessageRole;
	status: MessageStatus;
	text: string;
	timestampMs: number;
}

export interface ProjectDiffSnapshot {
	branch: string;
	files: ProjectDiffEntry[];
	gitAvailable: boolean;
}

interface ProjectDiffEntry {
	code: string;
	path: string;
}

interface QueueEntry {
	id: string;
	mode: QueueMode;
	status: QueueStatus;
	text: string;
}
