type ActivityTone = 'assistant' | 'system' | 'tool';

type AttachmentKind = 'binary' | 'code' | 'data' | 'document' | 'image' | 'text';

type AttachmentParseStatus = 'failed' | 'idle' | 'parsing' | 'ready';

type AttachmentStage = 'sent' | 'staged';

type DiffAnalysisStatus = 'complete' | 'failed' | 'in-progress' | 'pending';

type DiffLineKind = 'added' | 'context' | 'meta' | 'removed';

type DiffPriority = 'high' | 'low' | 'medium';

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

export interface AppHealth {
	bridgeStatus: string;
	configuredProviderCount: number;
	modelCount: number;
}

interface AppIntegrations {
	codex: CodexStatus;
}

export interface AppSettings {
	diffAnalysisModelKey: string | null;
	features: FeatureSettings;
	providers: ProviderStatus[];
}

export interface FeatureSettings {
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
	availableThinkingLevels: ThinkingLevel[];
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
	lastUserMessageAtMs: number;
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
	files: ProjectDiffFile[];
	fingerprint: string;
	generatedAtMs: number;
	gitAvailable: boolean;
	stats: ProjectDiffStats;
}

interface ProjectDiffStats {
	additions: number;
	deletions: number;
	filesChanged: number;
}

export interface ProjectDiffFile {
	additions: number;
	deletions: number;
	hunks: ProjectDiffHunk[];
	id: string;
	isBinary: boolean;
	isGenerated: boolean;
	isTooLarge: boolean;
	originalPath: string | null;
	path: string;
	status: string;
	statusCode: string;
}

export interface ProjectDiffHunk {
	header: string;
	id: string;
	lines: ProjectDiffLine[];
	newLines: number;
	newStart: number;
	oldLines: number;
	oldStart: number;
}

interface ProjectDiffLine {
	kind: DiffLineKind;
	newLine: number | null;
	oldLine: number | null;
	text: string;
}

export interface DiffEvidence {
	endLine: number | null;
	file: string;
	hunkId: string;
	startLine: number | null;
}

interface DiffAnalysisBriefItem {
	detail: string;
	evidence: DiffEvidence[];
	title: string;
}

interface DiffAnalysisImpactItem {
	area: string;
	detail: string;
	evidence: string[];
}

interface DiffAnalysisRiskItem {
	confidence: DiffPriority;
	detail: string;
	evidence: DiffEvidence[];
	level: DiffPriority;
	title: string;
	whyItMatters: string;
}

interface DiffAnalysisFocusItem {
	file: string;
	hunkId: string;
	priority: DiffPriority;
	reason: string;
}

interface DiffAnalysisFollowUpItem {
	prompt: string;
	reason: string;
}

export interface DiffAnalysis {
	changeBrief: DiffAnalysisBriefItem[];
	continuationToken: string | null;
	error: string | null;
	fingerprint: string;
	focusQueue: DiffAnalysisFocusItem[];
	impact: DiffAnalysisImpactItem[];
	modelKey: string;
	partial: boolean;
	progress: number;
	risks: DiffAnalysisRiskItem[];
	status: DiffAnalysisStatus;
	suggestedFollowUps: DiffAnalysisFollowUpItem[];
	updatedAtMs: number;
}

interface QueueEntry {
	id: string;
	mode: QueueMode;
	status: QueueStatus;
	text: string;
}

export interface AppUpdate {
	events: AppEvent[];
}

export type AppEvent =
	| {
			type: 'project-upserted';
			project: ProjectRecord;
			selectedProjectId: string | null;
			selectedThreadId: string | null;
	  }
	| {
			type: 'project-order-changed';
			projectIds: string[];
			selectedProjectId: string | null;
			selectedThreadId: string | null;
	  }
	| {
			type: 'thread-upserted';
			projectId: string;
			selectedProjectId: string | null;
			selectedThreadId: string | null;
			thread: ThreadRecord;
	  }
	| {
			type: 'settings-updated';
			settings: AppSettings;
	  }
	| {
			type: 'models-updated';
			models: ModelOption[];
	  }
	| {
			type: 'health-updated';
			health: AppHealth;
	  }
	| {
			type: 'integrations-updated';
			integrations: AppIntegrations;
	  };
