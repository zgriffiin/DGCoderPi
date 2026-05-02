import { expect, type Page } from '@playwright/test';

type ThreadState = {
	messages: Array<{ role: string; text: string }>;
	status: string;
};

export async function verifyPromptFlow(page: Page) {
	const modelEmptyState = page.locator('.model-empty-state');
	const runToken = `ready-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const expectedReply = `ready ${runToken}`;
	const promptText = `Reply with exactly "${expectedReply}".`;
	if (await modelEmptyState.isVisible()) {
		await page.getByLabel('Prompt').fill('Describe the current workbench state.');
		await page.getByRole('button', { name: 'Start' }).click();
		await expect(
			page.getByText('Select a configured model before sending a prompt.')
		).toBeVisible();
		return;
	}

	await expect(page.locator('.composer-panel .bx--list-box').first()).toBeVisible();
	let threadId: string | null = null;
	await expect
		.poll(
			async () => {
				threadId = await readSelectedThreadId(page);
				return threadId;
			},
			{ timeout: 15_000 }
		)
		.not.toBeNull();
	if (!threadId) {
		throw new Error('Expected a selected thread before sending the prompt.');
	}
	await expect.poll(() => readThreadState(page, threadId), { timeout: 15_000 }).not.toBeNull();
	await page.getByLabel('Prompt').fill(promptText);
	await page.getByRole('button', { name: 'Start' }).click();
	await expect
		.poll(() => readSendState(page, threadId, promptText), { timeout: 30_000 })
		.not.toBe('pending');

	if ((await readSendState(page, threadId, promptText)) === 'validation') {
		await expect(
			page.getByText('Select a configured model before sending a prompt.')
		).toBeVisible();
		return;
	}

	await expect
		.poll(() => readOutcome(page, threadId, expectedReply), { timeout: 120_000 })
		.toBe('ready');
	await expect(
		page.locator('.message-row[data-tone="assistant"] .message-row__body').first()
	).toContainText(expectedReply);
}

async function readSelectedThreadId(page: Page) {
	return page.evaluate(async () => {
		const runtime = window.__PI_DEBUG__;
		if (!runtime) {
			return null;
		}
		const snapshot =
			typeof runtime.getSnapshot === 'function'
				? runtime.getSnapshot()
				: ((await runtime.invoke('load_app_state')) as {
						selectedThreadId: string | null;
					});
		return snapshot.selectedThreadId;
	});
}

async function readThreadState(page: Page, threadId: string | null): Promise<ThreadState | null> {
	if (!threadId) {
		return null;
	}
	return page.evaluate(async (expectedThreadId) => {
		const runtime = window.__PI_DEBUG__;
		if (!runtime) {
			return null;
		}
		const snapshot =
			typeof runtime.getSnapshot === 'function'
				? runtime.getSnapshot()
				: ((await runtime.invoke('load_app_state')) as {
						projects: Array<{
							threads: Array<{
								id: string;
								messages: Array<{ role: string; text: string }>;
								status: string;
							}>;
						}>;
					});
		return (
			snapshot.projects
				.flatMap((project) => project.threads)
				.find((thread) => thread.id === expectedThreadId) ?? null
		);
	}, threadId);
}

async function readSendState(page: Page, threadId: string | null, promptText: string) {
	if (
		await page
			.getByText('Select a configured model before sending a prompt.')
			.isVisible()
			.catch(() => false)
	) {
		return 'validation';
	}
	const thread = await readThreadState(page, threadId);
	if (!thread) {
		return 'pending';
	}
	const matchingUserMessageIndex = thread.messages.findIndex(
		(message) => message.role === 'user' && message.text.includes(promptText)
	);
	if (matchingUserMessageIndex === -1) {
		return thread.status === 'running' ? 'queued' : 'pending';
	}

	const hasAssistantReply = thread.messages
		.slice(matchingUserMessageIndex + 1)
		.some((message) => message.role === 'assistant' && message.text.trim().length > 0);
	if (hasAssistantReply) {
		return 'queued';
	}
	return thread.status === 'running' ? 'sent' : 'pending';
}

async function readOutcome(page: Page, threadId: string | null, expectedReply: string) {
	if (
		await page
			.getByText('Run failed')
			.isVisible()
			.catch(() => false)
	) {
		return 'failed';
	}
	const thread = await readThreadState(page, threadId);
	if (!thread) {
		return 'pending';
	}
	return thread.messages.some(
		(message) => message.role === 'assistant' && message.text.includes(expectedReply)
	)
		? 'ready'
		: 'pending';
}
