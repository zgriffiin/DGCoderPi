import type { Page } from '@playwright/test';

type DebugSnapshot = {
	projects: Array<{
		threads: Array<{
			attachments: Array<{ name: string; path: string }>;
			id: string;
			messages: Array<{ role: string; text: string }>;
		}>;
	}>;
	selectedThreadId: string | null;
};

async function readSelectedThreadField(page: Page, field: 'attachments' | 'messages') {
	return page.evaluate(async (selector) => {
		const runtime = window.__PI_DEBUG__;
		if (!runtime) {
			return null;
		}
		const snapshot =
			typeof runtime.getSnapshot === 'function'
				? runtime.getSnapshot()
				: // load_app_state returns AppSnapshot, which is a superset of DebugSnapshot.
					((await runtime.invoke('load_app_state')) as DebugSnapshot);
		const threadId = snapshot.selectedThreadId;
		const thread = snapshot.projects
			.flatMap((project) => project.threads)
			.find((entry) => entry.id === threadId);

		return selector === 'attachments' ? (thread?.attachments ?? []) : (thread?.messages ?? []);
	}, field);
}

export async function readSelectedThreadAttachments(page: Page) {
	return ((await readSelectedThreadField(page, 'attachments')) ?? []) as Array<{
		name: string;
		path: string;
	}>;
}

export async function readSelectedThreadMessages(page: Page) {
	return ((await readSelectedThreadField(page, 'messages')) ?? []) as Array<{
		role: string;
		text: string;
	}>;
}
