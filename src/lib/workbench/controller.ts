import { browser } from '$app/environment';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { writable } from 'svelte/store';
import type { AppSnapshot, PromptMode } from '$lib/types/workbench';

const SNAPSHOT_EVENT = 'app://snapshot';

type WorkbenchState = {
	error: string | null;
	runtimeAvailable: boolean;
	snapshot: AppSnapshot;
};

const EMPTY_SNAPSHOT: AppSnapshot = {
	health: {
		bridgeStatus: 'offline',
		configuredProviderCount: 0,
		modelCount: 0
	},
	models: [],
	projects: [],
	selectedProjectId: null,
	selectedThreadId: null,
	settings: {
		features: {
			docparserEnabled: true
		},
		providers: [
			{ configured: false, label: 'Anthropic', provider: 'anthropic', source: null },
			{ configured: false, label: 'OpenAI', provider: 'openai', source: null },
			{ configured: false, label: 'Google Gemini', provider: 'google', source: null },
			{ configured: false, label: 'DeepSeek', provider: 'deepseek', source: null },
			{ configured: false, label: 'OpenRouter', provider: 'openrouter', source: null }
		]
	}
};

async function runCommand<T>(command: string, args?: Record<string, unknown>) {
	return invoke<T>(command, args);
}

async function fileToBytes(file: File) {
	return Array.from(new Uint8Array(await file.arrayBuffer()));
}

function applyUnavailableState(store: ReturnType<typeof writable<WorkbenchState>>) {
	store.update((state) => ({
		...state,
		error: 'Desktop runtime is only available inside the Tauri shell.',
		runtimeAvailable: false
	}));
}

function createSnapshotApplier(store: ReturnType<typeof writable<WorkbenchState>>) {
	return (snapshot: AppSnapshot) => {
		store.update((state) => ({
			...state,
			error: null,
			runtimeAvailable: true,
			snapshot
		}));
	};
}

function createErrorApplier(store: ReturnType<typeof writable<WorkbenchState>>) {
	return (error: unknown) => {
		store.update((state) => ({
			...state,
			error: error instanceof Error ? error.message : String(error)
		}));
	};
}

async function initializeRuntime(
	store: ReturnType<typeof writable<WorkbenchState>>,
	applySnapshot: (snapshot: AppSnapshot) => void
) {
	if (!browser || !isTauri()) {
		applyUnavailableState(store);
		return null;
	}

	const unlisten = await listen<AppSnapshot>(SNAPSHOT_EVENT, (event) => {
		applySnapshot(event.payload);
	});

	const snapshot = await runCommand<AppSnapshot>('load_app_state');
	applySnapshot(snapshot);
	return unlisten;
}

function createWorkbenchActions(
	applySnapshot: (snapshot: AppSnapshot) => void,
	applyError: (error: unknown) => void
) {
	async function runAndApply(command: Promise<AppSnapshot>) {
		try {
			applySnapshot(await command);
		} catch (error) {
			applyError(error);
			throw error;
		}
	}

	return {
		async abortThread(threadId: string) {
			await runAndApply(runCommand<AppSnapshot>('abort_thread', { threadId }));
		},
		async addProject(path: string) {
			await runAndApply(runCommand<AppSnapshot>('add_project', { input: { path } }));
		},
		async createThread(projectId: string, title: string) {
			await runAndApply(runCommand<AppSnapshot>('create_thread', { input: { projectId, title } }));
		},
		async removeAttachment(threadId: string, attachmentId: string) {
			await runAndApply(
				runCommand<AppSnapshot>('remove_attachment', { input: { attachmentId, threadId } })
			);
		},
		async selectModel(threadId: string, modelKey: string) {
			await runAndApply(runCommand<AppSnapshot>('select_model', { input: { modelKey, threadId } }));
		},
		async sendPrompt(threadId: string, text: string, mode: PromptMode) {
			await runAndApply(
				runCommand<AppSnapshot>('send_prompt', { input: { mode, text, threadId } })
			);
		},
		async setFeatureToggle(feature: string, enabled: boolean) {
			await runAndApply(
				runCommand<AppSnapshot>('set_feature_toggle', { input: { enabled, feature } })
			);
		},
		async setProviderKey(provider: string, key: string) {
			await runAndApply(runCommand<AppSnapshot>('set_provider_key', { input: { key, provider } }));
		},
		async stageAttachment(threadId: string, file: File) {
			await runAndApply(
				runCommand<AppSnapshot>('stage_attachment', {
					input: {
						bytes: await fileToBytes(file),
						mimeType: file.type || 'application/octet-stream',
						name: file.name,
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
		runtimeAvailable: false,
		snapshot: EMPTY_SNAPSHOT
	});
	const applySnapshot = createSnapshotApplier(store);
	const applyError = createErrorApplier(store);
	const actions = createWorkbenchActions(applySnapshot, applyError);
	let unlisten: UnlistenFn | null = null;

	return {
		...actions,
		async initialize() {
			try {
				unlisten = await initializeRuntime(store, applySnapshot);
			} catch (error) {
				applyError(error);
			}
		},
		destroy() {
			unlisten?.();
			unlisten = null;
		},
		subscribe: store.subscribe
	};
}
