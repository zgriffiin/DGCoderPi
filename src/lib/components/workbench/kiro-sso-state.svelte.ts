import type { KiroSsoDeviceAuth } from '$lib/types/workbench';
import type { WorkbenchController } from '$lib/workbench/controller';

export function createKiroSsoState(controller: WorkbenchController) {
	let busy = $state(false);
	let deviceAuth = $state<KiroSsoDeviceAuth | null>(null);
	let error = $state<string | null>(null);
	let regionDraft = $state('us-east-1');
	let startUrlDraft = $state('');

	async function run(action: () => Promise<void>) {
		if (busy) {
			return;
		}

		busy = true;
		error = null;
		try {
			await action();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : String(caught);
		} finally {
			busy = false;
		}
	}

	return {
		get busy() {
			return busy;
		},
		get deviceAuth() {
			return deviceAuth;
		},
		get error() {
			return error;
		},
		get regionDraft() {
			return regionDraft;
		},
		get startUrlDraft() {
			return startUrlDraft;
		},
		complete: () =>
			run(async () => {
				await controller.completeKiroSsoLogin();
				deviceAuth = null;
			}),
		logout: () =>
			run(async () => {
				await controller.logoutKiro();
				deviceAuth = null;
			}),
		setRegion(value: string) {
			regionDraft = value;
			error = null;
		},
		setStartUrl(value: string) {
			startUrlDraft = value;
			error = null;
		},
		start: () =>
			run(async () => {
				deviceAuth = await controller.startKiroSsoLogin({
					region: regionDraft.trim(),
					startUrl: startUrlDraft.trim()
				});
			})
	};
}
