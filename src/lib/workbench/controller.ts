import { browser } from '$app/environment';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { get, writable } from 'svelte/store';
import type {
	AppHealth,
	AppSnapshot,
	AppUpdate,
	DiffAnalysis,
	KiroSsoDeviceAuth,
	KiroSsoLoginInput,
	ProjectDiffSnapshot,
	PromptMode,
	SpecArtifactDocument,
	ThreadIntent,
	ThinkingLevel
} from '$lib/types/workbench';
import {
	applyUnavailableState,
	createSnapshotApplier,
	runCommand,
	type WorkbenchState
} from '$lib/workbench/controller-state';
import { createUpdateApplier } from '$lib/workbench/controller-events';
import { EMPTY_SNAPSHOT } from '$lib/workbench/workbench-defaults';
const UPDATE_EVENT = 'app://update';

function createHealthApplier(store: ReturnType<typeof writable<WorkbenchState>>) {
	return (health: AppHealth) => {
		store.update((state) => ({
			...state,
			error: null,
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

	const pendingUpdates: AppUpdate[] = [];
	let readyForLiveUpdates = false;
	const unlisten = await listen<AppUpdate>(UPDATE_EVENT, (event) => {
		if (!readyForLiveUpdates) {
			pendingUpdates.push(event.payload);
			return;
		}
		applyUpdate(event.payload);
	});

	try {
		const snapshot = await runCommand<AppSnapshot>('load_app_state');
		if (import.meta.env.DEV) {
			window.__PI_DEBUG__ = {
				getSnapshot: () => get(store).snapshot,
				invoke
			};
		}
		applySnapshot(snapshot);
		readyForLiveUpdates = true;
		for (const update of pendingUpdates) {
			applyUpdate(update);
		}
		pendingUpdates.length = 0;
		return unlisten;
	} catch (error) {
		await unlisten();
		throw error;
	}
}

function createCommandRunners(
	applySnapshot: (snapshot: AppSnapshot) => void,
	applyUpdate: (update: AppUpdate) => void,
	applyError: (error: unknown) => void
) {
	return {
		async runAndApplySnapshot(command: Promise<AppSnapshot>) {
			try {
				const snapshot = await command;
				applySnapshot(snapshot);
				return snapshot;
			} catch (error) {
				applyError(error);
				throw error;
			}
		},
		async runAndApplyUpdate(command: Promise<AppUpdate>) {
			try {
				const update = await command;
				applyUpdate(update);
				return update;
			} catch (error) {
				applyError(error);
				throw error;
			}
		}
	};
}

function createProjectActions(
	runAndApplyUpdate: (command: Promise<AppUpdate>) => Promise<AppUpdate>
) {
	return {
		async addProject(path: string) {
			await runAndApplyUpdate(runCommand<AppUpdate>('add_project', { input: { path } }));
		},
		async createThread(projectId: string, title: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('create_thread', { input: { projectId, title } })
			);
		},
		async loadProjectDiff(projectId: string, hideWhitespace: boolean) {
			return runCommand<ProjectDiffSnapshot>('load_project_diff', {
				input: { hideWhitespace, projectId }
			});
		},
		async loadSpecArtifact(projectId: string, artifact: string) {
			return runCommand<SpecArtifactDocument>('load_spec_artifact', {
				input: { artifact, projectId }
			});
		},
		async moveProject(projectId: string, targetIndex: number) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('move_project', { input: { projectId, targetIndex } })
			);
		},
		async removeProject(projectId: string) {
			await runAndApplyUpdate(runCommand<AppUpdate>('remove_project', { input: { projectId } }));
		},
		async renameProject(projectId: string, name: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('rename_project', { input: { name, projectId } })
			);
		}
	};
}

function createThreadActions(
	runAndApplyUpdate: (command: Promise<AppUpdate>) => Promise<AppUpdate>
) {
	return {
		async abortThread(threadId: string) {
			await runAndApplyUpdate(runCommand<AppUpdate>('abort_thread', { threadId }));
		},
		async compactThread(threadId: string, customInstructions: string | null = null) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('compact_thread', {
					input: { customInstructions, threadId }
				})
			);
		},
		async removeAttachment(threadId: string, attachmentId: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('remove_attachment', { input: { attachmentId, threadId } })
			);
		},
		async removeThread(threadId: string) {
			await runAndApplyUpdate(runCommand<AppUpdate>('remove_thread', { input: { threadId } }));
		},
		async renameThread(threadId: string, title: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('rename_thread', { input: { threadId, title } })
			);
		},
		async selectModel(threadId: string, modelKey: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('select_model', { input: { modelKey, threadId } })
			);
		},
		async selectIntent(threadId: string, intent: ThreadIntent) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('select_intent', { input: { intent, reason: null, threadId } })
			);
		},
		async selectReasoning(threadId: string, reasoningLevel: ThinkingLevel) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('select_reasoning', { input: { reasoningLevel, threadId } })
			);
		},
		async sendPrompt(
			threadId: string,
			text: string,
			mode: PromptMode,
			options?: {
				includeIntentGuidance?: boolean;
				promptGuidance?: string | null;
			}
		) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('send_prompt', {
					input: {
						includeIntentGuidance: options?.includeIntentGuidance ?? false,
						mode,
						promptGuidance: options?.promptGuidance ?? null,
						text,
						threadId
					}
				})
			);
		},
		async promoteQueuedMessage(threadId: string, queueId: string, text: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('promote_queued_message', {
					input: { queueId, text, threadId }
				})
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
		},
		async stageAttachmentData(
			threadId: string,
			input: { bytes: number[]; mimeType: string | null; name: string }
		) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('stage_attachment_data', {
					input: {
						bytes: input.bytes,
						mimeType: input.mimeType,
						name: input.name,
						threadId
					}
				})
			);
		}
	};
}

function createSettingsActions(
	runAndApplySnapshot: (command: Promise<AppSnapshot>) => Promise<AppSnapshot>,
	runAndApplyUpdate: (command: Promise<AppUpdate>) => Promise<AppUpdate>
) {
	return {
		async importCodexOpenAiKey() {
			await runAndApplyUpdate(runCommand<AppUpdate>('import_codex_openai_key'));
		},
		async loadDiffAnalysis(projectId: string, threadId: string | null, hideWhitespace: boolean) {
			return runCommand<DiffAnalysis>('load_diff_analysis', {
				input: { hideWhitespace, projectId, threadId }
			});
		},
		async refreshDiffAnalysis(projectId: string, threadId: string | null, hideWhitespace: boolean) {
			return runCommand<DiffAnalysis>('refresh_diff_analysis', {
				input: { hideWhitespace, projectId, threadId }
			});
		},
		async refreshState() {
			await runAndApplySnapshot(runCommand<AppSnapshot>('load_app_state'));
		},
		async setDiffAnalysisModel(modelKey: string | null) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('set_diff_analysis_model', { input: { modelKey } })
			);
		},
		async setFeatureToggle(feature: string, enabled: boolean) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('set_feature_toggle', { input: { enabled, feature } })
			);
		},
		async setCavemanLevel(level: string) {
			await runAndApplyUpdate(runCommand<AppUpdate>('set_caveman_level', { input: { level } }));
		},
		async setMaxContextPercent(percent: number) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('set_max_context_percent', { input: { percent } })
			);
		},
		async setProviderKey(provider: string, key: string) {
			await runAndApplyUpdate(
				runCommand<AppUpdate>('set_provider_key', { input: { key, provider } })
			);
		},
		async startCodexLogin() {
			await runAndApplyUpdate(runCommand<AppUpdate>('start_codex_login'));
		},
		async startKiroSsoLogin(input: KiroSsoLoginInput): Promise<KiroSsoDeviceAuth> {
			return runCommand<KiroSsoDeviceAuth>('start_kiro_sso_login', { input });
		},
		async completeKiroSsoLogin() {
			await runAndApplyUpdate(runCommand<AppUpdate>('complete_kiro_sso_login'));
		},
		async logoutKiro() {
			await runAndApplyUpdate(runCommand<AppUpdate>('logout_kiro'));
		}
	};
}

function createWorkbenchActions(
	applySnapshot: (snapshot: AppSnapshot) => void,
	applyUpdate: (update: AppUpdate) => void,
	applyError: (error: unknown) => void
) {
	const { runAndApplySnapshot, runAndApplyUpdate } = createCommandRunners(
		applySnapshot,
		applyUpdate,
		applyError
	);
	return {
		...createProjectActions(runAndApplyUpdate),
		...createThreadActions(runAndApplyUpdate),
		...createSettingsActions(runAndApplySnapshot, runAndApplyUpdate)
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

export type WorkbenchController = ReturnType<typeof createWorkbenchController>;
