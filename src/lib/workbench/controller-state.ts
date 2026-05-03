import { invoke } from '@tauri-apps/api/core';
import type { writable } from 'svelte/store';
import type { AppSnapshot } from '$lib/types/workbench';

export type WorkbenchState = {
	error: string | null;
	heartbeatPending: boolean;
	lastSnapshotAtMs: number | null;
	runtimeAvailable: boolean;
	snapshot: AppSnapshot;
};

export async function runCommand<T>(command: string, args?: Record<string, unknown>) {
	return invoke<T>(command, args);
}

export function applyUnavailableState(store: ReturnType<typeof writable<WorkbenchState>>) {
	store.update((state) => ({
		...state,
		error: 'Open the desktop shell with pnpm tauri:dev.',
		heartbeatPending: false,
		runtimeAvailable: false
	}));
}

export function createSnapshotApplier(store: ReturnType<typeof writable<WorkbenchState>>) {
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
