import { browser } from '$app/environment';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { get, writable } from 'svelte/store';
import type {
	AppEvent,
	AppHealth,
	AppSettings,
	AppSnapshot,
	AppUpdate,
	FeatureSettings,
	ProjectDiffSnapshot,
	PromptMode,
	ThinkingLevel
} from '$lib/types/workbench';

const UPDATE_EVENT = 'app://update';

const DEFAULT_FEATURE_SETTINGS: FeatureSettings = {
	docparserEnabled: true
};

const DEFAULT_APP_SETTINGS: AppSettings = {
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

declare global {
	interface Window {
		__PI_DEBUG__?: {
			invoke: typeof invoke;
		};
	}
}

type WorkbenchState = {
	error: string | null;
	heartbeatPending: boolean;
	lastSnapshotAtMs: number | null;
	runtimeAvailable: boolean;
	snapshot: AppSnapshot;
};

const EMPTY_SNAPSHOT: AppSnapshot = {
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

async function runCommand<T>(command: string, args?: Record<string, unknown>) {
	return invoke<T>(command, args);
}

function applyUnavailableState(store: ReturnType<typeof writable<WorkbenchState>>) {
	store.update((state) => ({
		...state,
		error: 'Open the desktop shell with pnpm tauri:dev.',
		heartbeatPending: false,
		runtimeAvailable: false
	}));
}

function createSnapshotApplier(store: ReturnType<typeof writable<WorkbenchState>>) {
	return (snapshot: AppSnapshot) => {
		store.update((state) => ({
			...state,
			error: null,
			heartbeatPending: false,
			lastSnapshotAtMs: Date.now(),
			runtimeAvailable: true,
			snapshot
		}));
	};
}

function applySelection(
	snapshot: AppSnapshot,
	selectedProjectId: string | null,
	selectedThreadId: string | null
) {
	snapshot.selectedProjectId = selectedProjectId;
	snapshot.selectedThreadId = selectedThreadId;
}

function upsertProject(snapshot: AppSnapshot, project: AppSnapshot['projects'][number]) {
	const index = snapshot.projects.findIndex((entry) => entry.id === project.id);
	if (index === -1) {
		snapshot.projects = [...snapshot.projects, project];
		return;
	}

	snapshot.projects = snapshot.projects.map((entry, currentIndex) =>
		currentIndex === index ? project : entry
	);
}

function upsertThread(
	snapshot: AppSnapshot,
	projectId: string,
	thread: AppSnapshot['projects'][number]['threads'][number]
) {
	snapshot.projects = snapshot.projects.map((project) => {
		if (project.id !== projectId) {
			return project;
		}

		const threadIndex = project.threads.findIndex((entry) => entry.id === thread.id);
		const threads =
			threadIndex === -1
				? [...project.threads, thread]
				: project.threads.map((entry, index) => (index === threadIndex ? thread : entry));
		return { ...project, threads };
	});
}

function reorderProjects(snapshot: AppSnapshot, projectIds: string[]) {
	const projectById = new Map(snapshot.projects.map((project) => [project.id, project]));
	const orderedProjects = projectIds
		.map((projectId) => projectById.get(projectId))
		.filter((project): project is NonNullable<typeof project> => Boolean(project));
	const remainingProjects = snapshot.projects.filter((project) => !projectIds.includes(project.id));
	snapshot.projects = [...orderedProjects, ...remainingProjects];
}

function applyUpdateToSnapshot(snapshot: AppSnapshot, update: AppUpdate) {
	for (const event of update.events) {
		applyEventToSnapshot(snapshot, event);
	}
}

function cloneSnapshotShell(snapshot: AppSnapshot): AppSnapshot {
	return {
		...snapshot,
		health: { ...snapshot.health },
		integrations: {
			codex: { ...snapshot.integrations.codex }
		},
		models: [...snapshot.models],
		projects: snapshot.projects.map((project) => ({
			...project,
			threads: [...project.threads]
		})),
		settings: {
			...snapshot.settings,
			features: { ...snapshot.settings.features },
			providers: [...snapshot.settings.providers]
		}
	};
}

function applyEventToSnapshot(snapshot: AppSnapshot, event: AppEvent) {
	if (event.type === 'project-upserted') {
		upsertProject(snapshot, event.project);
		applySelection(snapshot, event.selectedProjectId, event.selectedThreadId);
		return;
	}

	if (event.type === 'project-order-changed') {
		reorderProjects(snapshot, event.projectIds);
		applySelection(snapshot, event.selectedProjectId, event.selectedThreadId);
		return;
	}

	if (event.type === 'thread-upserted') {
		upsertThread(snapshot, event.projectId, event.thread);
		applySelection(snapshot, event.selectedProjectId, event.selectedThreadId);
		return;
	}

	if (event.type === 'settings-updated') {
		snapshot.settings = event.settings;
		return;
	}

	if (event.type === 'models-updated') {
		snapshot.models = event.models;
		return;
	}

	if (event.type === 'health-updated') {
		snapshot.health = event.health;
		return;
	}

	if (event.type === 'integrations-updated') {
		snapshot.integrations = event.integrations;
	}
}

function createUpdateApplier(store: ReturnType<typeof writable<WorkbenchState>>) {
	return (update: AppUpdate) => {
		store.update((state) => {
			const snapshot = cloneSnapshotShell(state.snapshot);
			applyUpdateToSnapshot(snapshot, update);
			return {
				...state,
				error: null,
				heartbeatPending: false,
				lastSnapshotAtMs: Date.now(),
				runtimeAvailable: true,
				snapshot
			};
		});
	};
}

function createHealthApplier(store: ReturnType<typeof writable<WorkbenchState>>) {
	return (health: AppHealth) => {
		store.update((state) => ({
			...state,
			heartbeatPending: false,
			lastSnapshotAtMs: Date.now(),
			runtimeAvailable: true,
			snapshot: {
				...state.snapshot,
				health
			}
		}));
	};
}

function createErrorApplier(store: ReturnType<typeof writable<WorkbenchState>>) {
	return (error: unknown) => {
		store.update((state) => ({
			...state,
			error: error instanceof Error ? error.message : String(error),
			heartbeatPending: false
		}));
	};
}

function hasRunningThread(snapshot: AppSnapshot) {
	return snapshot.projects.some((project) =>
		project.threads.some((thread) => thread.status === 'running')
	);
}

async function initializeRuntime(
	store: ReturnType<typeof writable<WorkbenchState>>,
	applySnapshot: (snapshot: AppSnapshot) => void,
	applyUpdate: (update: AppUpdate) => void
) {
	if (!browser || !isTauri()) {
		applyUnavailableState(store);
		return null;
	}

	const unlisten = await listen<AppUpdate>(UPDATE_EVENT, (event) => {
		applyUpdate(event.payload);
	});

	try {
		const snapshot = await runCommand<AppSnapshot>('load_app_state');
		if (import.meta.env.DEV) {
			window.__PI_DEBUG__ = { invoke };
		}
		applySnapshot(snapshot);
		return unlisten;
	} catch (error) {
		await unlisten();
		throw error;
	}
}

function createWorkbenchActions(
	applySnapshot: (snapshot: AppSnapshot) => void,
	applyUpdate: (update: AppUpdate) => void,
	applyError: (error: unknown) => void
) {
	async function runAndApplySnapshot(command: Promise<AppSnapshot>) {
		try {
			const snapshot = await command;
			applySnapshot(snapshot);
			return snapshot;
		} catch (error) {
			applyError(error);
			throw error;
		}
	}

	async function runAndApplyUpdate(command: Promise<AppUpdate>) {
		try {
			const update = await command;
			applyUpdate(update);
			return update;
		} catch (error) {
			applyError(error);
			throw error;
		}
	}

	return {
		async abortThread(threadId: string) {
			await runAndApplyUpdate(runCommand<AppUpdate>('abort_thread', { threadId }));
		},
		async addProject(path: string) {
			await runAndApplyUpdate(runCommand<AppUpdate>('add_project', { input: { path } }));
		},
		async createThread(projectId: string, title: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('create_thread', { input: { projectId, title } })
			);
		},
		async moveProject(projectId: string, targetIndex: number) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('move_project', { input: { projectId, targetIndex } })
			);
		},
		async importCodexOpenAiKey() {
			await runAndApplyUpdate(runCommand<AppUpdate>('import_codex_openai_key'));
		},
		async startCodexLogin() {
			await runAndApplyUpdate(runCommand<AppUpdate>('start_codex_login'));
		},
		async loadProjectDiff(projectId: string) {
			return runCommand<ProjectDiffSnapshot>('load_project_diff', { projectId });
		},
		async refreshState() {
			await runAndApplySnapshot(runCommand<AppSnapshot>('load_app_state'));
		},
		async removeAttachment(threadId: string, attachmentId: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('remove_attachment', { input: { attachmentId, threadId } })
			);
		},
		async selectModel(threadId: string, modelKey: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('select_model', { input: { modelKey, threadId } })
			);
		},
		async selectReasoning(threadId: string, reasoningLevel: ThinkingLevel) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('select_reasoning', { input: { reasoningLevel, threadId } })
			);
		},
		async sendPrompt(threadId: string, text: string, mode: PromptMode) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('send_prompt', { input: { mode, text, threadId } })
			);
		},
		async setFeatureToggle(feature: string, enabled: boolean) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('set_feature_toggle', { input: { enabled, feature } })
			);
		},
		async setProviderKey(provider: string, key: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('set_provider_key', { input: { key, provider } })
			);
		},
		async stageAttachment(threadId: string, sourcePath: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('stage_attachment', {
					input: {
						sourcePath,
						threadId
					}
				})
			);
		}
	};
}

export function createWorkbenchController() {
	const store = writable<WorkbenchState>({
		error: null,
		heartbeatPending: false,
		lastSnapshotAtMs: null,
		runtimeAvailable: false,
		snapshot: EMPTY_SNAPSHOT
	});
	const applySnapshot = createSnapshotApplier(store);
	const applyUpdate = createUpdateApplier(store);
	const applyHealth = createHealthApplier(store);
	const applyError = createErrorApplier(store);
	const actions = createWorkbenchActions(applySnapshot, applyUpdate, applyError);
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	let heartbeatInFlight = false;
	let unlisten: UnlistenFn | null = null;

	async function pollRunningThread() {
		const state = get(store);
		if (!state.runtimeAvailable || !hasRunningThread(state.snapshot) || heartbeatInFlight) {
			return;
		}

		heartbeatInFlight = true;
		store.update((current) => ({ ...current, heartbeatPending: true }));

		try {
			applyHealth(await runCommand<AppHealth>('load_runtime_health'));
		} catch (error) {
			applyError(error);
		} finally {
			heartbeatInFlight = false;
		}
	}

	return {
		...actions,
		async initialize() {
			try {
				unlisten = await initializeRuntime(store, applySnapshot, applyUpdate);
				if (browser && isTauri()) {
					heartbeatTimer = setInterval(() => {
						void pollRunningThread();
					}, 3_000);
				}
			} catch (error) {
				applyError(error);
			}
		},
		destroy() {
			if (browser && isTauri()) {
				delete window.__PI_DEBUG__;
			}
			unlisten?.();
			unlisten = null;
			if (heartbeatTimer) {
				clearInterval(heartbeatTimer);
				heartbeatTimer = null;
			}
		},
		subscribe: store.subscribe
	};
}
