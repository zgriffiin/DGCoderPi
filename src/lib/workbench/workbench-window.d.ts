import type { AppSnapshot } from '$lib/types/workbench';
import type { invoke } from '@tauri-apps/api/core';

declare global {
	interface Window {
		__PI_DEBUG__?: {
			getSnapshot: () => AppSnapshot;
			invoke: typeof invoke;
		};
	}
}

export {};
