import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import {
	addProjectByPath,
	createCleanRepo,
	createSampleRepo,
	createThreadForProject,
	verifyShipReviewPersistsAcrossThreadSwitch,
	verifyShipWithDiffShowsReviewGate,
	verifyShipWithoutDiffContinues
} from './workbench-ship-helpers';
import { readSelectedThreadMessages } from './workbench-debug-helpers';
import { verifyPromptFlow } from './workbench-prompt-helpers';

const DESKTOP_DEBUG_URL = 'http://127.0.0.1:9333';
const DESKTOP_PAGE_MARKER = 'DGCoder';
test.setTimeout(240_000);

async function isWorkbenchPage(page: import('@playwright/test').Page) {
	try {
		await page.waitForLoadState('domcontentloaded', { timeout: 1_000 });
		return await page.evaluate((marker) => {
			const title = document.title ?? '';
			const heading = document.querySelector('h1')?.textContent ?? '';
			return title.includes(marker) || heading.includes(marker);
		}, DESKTOP_PAGE_MARKER);
	} catch {
		return false;
	}
}

test.skip(process.platform !== 'win32', 'Desktop runtime verification is Windows-only.');

async function getDesktopPage() {
	const browser = await chromium.connectOverCDP(DESKTOP_DEBUG_URL);
	try {
		for (let attempt = 0; attempt < 120; attempt += 1) {
			for (const context of browser.contexts()) {
				for (const page of context.pages()) {
					if (await isWorkbenchPage(page)) {
						return { browser, page };
					}
				}
			}

			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		throw new Error('The Tauri desktop page did not finish loading.');
	} catch (error) {
		await browser.close();
		throw error;
	}
}

async function addProjectAndThread(page: import('@playwright/test').Page) {
	await page.waitForFunction(() => {
		return document.querySelector('h1')?.textContent?.includes('DGCoder');
	});
	await expect(page.getByRole('heading', { level: 1, name: 'DGCoder' })).toBeVisible({
		timeout: 15_000
	});

	await page.getByRole('button', { name: 'Add project' }).click();
	await page.getByRole('button', { name: 'Paste path' }).click();
	await page.getByLabel('Repository path').fill(process.cwd());
	await page.getByRole('button', { name: 'Add from path' }).click();
	await expect(page.getByRole('button', { name: 'New thread' })).toHaveCount(0);
	const createThreadButton = page.getByRole('button', { name: 'Create thread in DGCoder-pi' });
	await expect(createThreadButton).toBeVisible();
	await createThreadButton.click();
	await expect(page.getByText('Send a message to start the conversation.')).toBeVisible();
	await expect(page.getByText('1 queued message')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
	await expect(page.getByRole('button', { exact: true, name: 'Attach' })).toBeVisible();
	await expect(page.getByRole('button', { exact: true, name: 'Ship' })).toBeVisible();
	await expect(page.getByRole('radio', { name: 'Understand' })).toHaveCount(0);
	await expect(page.locator('.thread-row[data-selected="true"] .thread-row__intent')).toHaveCount(
		0
	);
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function removeDirectoryWithRetries(targetPath: string) {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		try {
			rmSync(targetPath, { force: true, recursive: true });
			return;
		} catch (error) {
			if (attempt === 4) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
}

function hasAttachmentFile(rootPath: string, expectedName: string) {
	try {
		for (const threadDir of readdirSync(rootPath, { withFileTypes: true })) {
			if (!threadDir.isDirectory()) {
				continue;
			}
			const threadPath = path.join(rootPath, threadDir.name);
			if (readdirSync(threadPath).some((fileName) => fileName.endsWith(expectedName))) {
				return true;
			}
		}
	} catch {
		return false;
	}

	return false;
}

async function waitForReviewState(panel: import('@playwright/test').Locator) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const text = (await panel.textContent().catch(() => '')) ?? '';
		if (text.includes('Grounded review ready')) {
			return 'ready';
		}
		if (text.includes('Review in progress') || text.includes('Preparing AI review')) {
			return 'progress';
		}
		if (text.includes('Review stopped early')) {
			return 'stopped';
		}
		if (
			text.includes('Retry analysis') ||
			text.includes('Configure a model in Settings before running AI Review.') ||
			text.includes('Start analysis') ||
			text.includes('Clean working tree')
		) {
			return 'failed';
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	return 'unknown';
}

async function verifyKeyboardResize(
	inspector: import('@playwright/test').Locator,
	resizeHandle: import('@playwright/test').Locator
) {
	await resizeHandle.focus();
	await normalizeResizeHandleValue(resizeHandle);
	const keyboardWidthBefore = await readResizeHandleValue(resizeHandle);
	await resizeHandle.press('ArrowLeft');
	const keyboardWidthAfterLeft = await readResizeHandleValue(resizeHandle);
	expect(keyboardWidthAfterLeft).toBeLessThan(keyboardWidthBefore - 8);
	await resizeHandle.press('ArrowRight');
	const keyboardWidthAfterRight = await readResizeHandleValue(resizeHandle);
	expect(keyboardWidthAfterRight).toBeGreaterThan(keyboardWidthAfterLeft + 8);
}

async function normalizeResizeHandleValue(resizeHandle: import('@playwright/test').Locator) {
	const value = Number(await resizeHandle.getAttribute('aria-valuenow'));
	const min = Number(await resizeHandle.getAttribute('aria-valuemin'));
	const max = Number(await resizeHandle.getAttribute('aria-valuemax'));
	if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
		return;
	}
	let current = value;
	for (let attempt = 0; current - min < 64 && attempt < 8; attempt += 1) {
		await resizeHandle.press('ArrowRight');
		current = await readResizeHandleValue(resizeHandle);
	}
	for (let attempt = 0; max - current < 64 && attempt < 8; attempt += 1) {
		await resizeHandle.press('ArrowLeft');
		current = await readResizeHandleValue(resizeHandle);
	}
}

async function readResizeHandleValue(resizeHandle: import('@playwright/test').Locator) {
	return Number(await resizeHandle.getAttribute('aria-valuenow'));
}

async function verifySettingsAndDiff(
	page: import('@playwright/test').Page,
	repoPath: string,
	projectLabel = path.basename(repoPath)
) {
	const toolbar = page.locator('.topbar__actions');
	const inspector = page.locator('.inspector-rail');
	await page.setViewportSize({ height: 960, width: 1440 });
	await page.waitForFunction(() => window.innerWidth > 1100);
	await page.getByRole('button', { name: 'Settings' }).click();
	const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(settingsDialog).toBeVisible();
	await expect(settingsDialog.getByRole('heading', { level: 3, name: 'Codex' })).toBeVisible();
	await settingsDialog.getByRole('button', { name: 'Providers' }).click();
	await expect(settingsDialog.getByRole('heading', { level: 3, name: 'Providers' })).toBeVisible();
	await expect(settingsDialog.getByLabel('Diff review model')).toBeVisible();
	await settingsDialog.getByLabel('Close the modal').click();

	if (
		!(await inspector
			.getByRole('tab', { name: 'AI Review' })
			.isVisible()
			.catch(() => false))
	) {
		await toolbar.getByRole('button', { exact: true, name: 'Diff' }).click();
	}
	await expect(inspector.getByRole('tab', { name: 'AI Review' })).toBeVisible();
	await expect(page.getByLabel('Resize project rail')).toBeVisible();
	await expect(page.getByLabel('Resize inspector rail')).toBeVisible();
	await expect(inspector.getByRole('tab', { name: 'AI Review' })).toBeVisible();
	await expect(inspector.getByRole('tab', { name: 'Patch View' })).toBeVisible();

	const resizeHandle = page.getByLabel('Resize inspector rail');
	let inspectorBefore = await inspector.boundingBox();
	let handleBox = await resizeHandle.boundingBox();
	if (!inspectorBefore || !handleBox) {
		throw new Error('Expected inspector resize controls to have a layout box.');
	}

	await verifyKeyboardResize(inspector, resizeHandle);
	inspectorBefore = await inspector.boundingBox();
	handleBox = await resizeHandle.boundingBox();
	if (!inspectorBefore || !handleBox) {
		throw new Error('Expected inspector resize controls after keyboard resizing.');
	}

	const aiReviewStatus = inspector.locator('.ai-review-panel');
	await expect(aiReviewStatus).toBeVisible();
	await expect(inspector.getByRole('tab', { name: 'AI Review' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	const patchViewButton = inspector.getByRole('tab', { name: 'Patch View' });
	await patchViewButton.click();
	await expect(
		inspector.getByRole('button', { name: /Hide whitespace|Show whitespace/ })
	).toBeVisible();
	await expect(inspector.getByRole('heading', { level: 3, name: 'src/counter.ts' })).toBeVisible();
	await expect(inspector.getByRole('heading', { level: 3, name: 'docs/notes.md' })).toBeVisible();
	await expect(inspector.getByText('pending label handling')).toBeVisible();

	await inspector.getByRole('tab', { name: 'AI Review' }).click();
	await expect(aiReviewStatus).toBeVisible();
	const reviewState = await waitForReviewState(aiReviewStatus);

	if (reviewState === 'ready') {
		await expect(inspector.getByText('Change Brief')).toBeVisible();
		const jumpButton = inspector
			.getByRole('button', { name: /Jump to hunk|src\/counter\.ts/ })
			.first();
		if (await jumpButton.isVisible().catch(() => false)) {
			await jumpButton.click();
			await expect(inspector.getByRole('tab', { name: 'Patch View' })).toHaveAttribute(
				'aria-selected',
				'true'
			);
		}
	} else if (reviewState === 'progress') {
		await expect(aiReviewStatus).toContainText(/Review in progress|Preparing AI review/);
		await expect(aiReviewStatus.getByText(/^complete$/)).toHaveCount(0);
	} else if (reviewState === 'stopped') {
		await expect(aiReviewStatus).toContainText(
			/Review stopped early|No review sections returned\.|Retry analysis/
		);
	} else {
		await expect(aiReviewStatus).toContainText(
			/Configure a model in Settings before running AI Review\.|Review stopped early|Retry analysis|Start analysis|Preparing AI review|Clean working tree/
		);
	}

	await page.evaluate((sampleName) => {
		const marker = document.querySelector('.inspector-rail')?.textContent ?? '';
		if (!marker.includes(sampleName)) {
			throw new Error('Sample project name did not appear in the inspector.');
		}
	}, projectLabel);
}

async function verifyLeftPanelActions(page: import('@playwright/test').Page, repoPath: string) {
	const selectedProject = page.locator('.project-section[data-selected="true"]');
	const selectedThread = page.locator('.thread-row[data-selected="true"]');
	await selectedThread.locator('.thread-row__select').focus();
	await selectedThread.locator('.thread-row__select').press('F2');
	await page.getByLabel(/Rename /).fill('Review diff changes');
	await page.getByLabel(/Rename /).press('Enter');
	await expect(page.getByRole('heading', { level: 3, name: 'Review diff changes' })).toBeVisible();

	await selectedProject.getByLabel('Project actions').click();
	await page.getByRole('menuitem', { name: 'Rename' }).click();
	await page
		.getByLabel(new RegExp(`Rename ${escapeRegExp(path.basename(repoPath))}`))
		.fill('Sample workspace');
	await page.keyboard.press('Enter');
	await expect(selectedProject.getByRole('heading', { name: 'Sample workspace' })).toBeVisible();

	await selectedThread.getByLabel('Thread actions').click();
	await page.getByRole('menuitem', { name: 'Open diff' }).click();
	await expect(
		page.locator('.inspector-rail').getByRole('tab', { name: 'AI Review' })
	).toBeVisible();
}

async function removeSelectedProjectFromRail(page: import('@playwright/test').Page) {
	const selectedProject = page.locator('.project-section[data-selected="true"]');
	await selectedProject.getByLabel('Project actions').click();
	await page.getByRole('menuitem', { name: 'Remove project' }).click();
	await expect(page.getByText('Files on disk are not deleted.')).toBeVisible();
	await page.getByRole('menuitem', { name: 'Confirm remove' }).click();
	await expect(page.getByRole('heading', { name: 'Sample workspace' })).toHaveCount(0);
}

async function attachReadmeToSelectedThread(
	page: import('@playwright/test').Page,
	repoPath: string
) {
	const inspector = page.locator('.inspector-rail');
	const settingsButton = page.getByRole('button', { name: 'Settings' });
	const expectedAttachmentRoot = path.join(repoPath, '.doc', 'attachments');
	await page.evaluate(
		async ({ sourcePath }) => {
			const runtime = window.__PI_DEBUG__;
			if (!runtime) {
				throw new Error('Desktop debug bridge is not available.');
			}
			const threadCard = document.querySelector('[data-thread-id][data-selected="true"]');
			const threadId = threadCard?.getAttribute('data-thread-id');
			if (!threadId) {
				throw new Error('Unable to find the selected thread id.');
			}
			await runtime.invoke('stage_attachment', {
				input: {
					sourcePath,
					threadId
				}
			});
		},
		{
			sourcePath: path.resolve(process.cwd(), 'README.md')
		}
	);
	await expect.poll(() => hasAttachmentFile(expectedAttachmentRoot, 'README.md')).toBe(true);
	await settingsButton.click();
	const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
	await settingsDialog.getByRole('button', { name: 'Refresh status' }).click();
	await settingsDialog.getByLabel('Close the modal').click();
	await page.getByRole('button', { exact: true, name: 'Spec' }).click();
	await expect(inspector.getByRole('heading', { level: 3, name: 'Understand' })).toBeVisible();
	await expect(inspector.getByRole('heading', { level: 3, name: 'Requirements' })).toBeVisible();
	await expect(inspector.getByRole('heading', { level: 3, name: 'Design' })).toBeVisible();
	await expect(inspector.getByRole('heading', { level: 3, name: 'Tasks' })).toBeVisible();
	await expect(inspector.getByRole('heading', { level: 3, name: 'Implement' })).toBeVisible();
	await expect(inspector.getByRole('heading', { level: 3, name: 'Review' })).toBeVisible();
	await expect(inspector.getByRole('heading', { level: 3, name: 'Ship' })).toBeVisible();
	await inspector
		.locator('.spec-step')
		.filter({ hasText: 'Intent' })
		.getByRole('button', { name: 'View' })
		.click();
	await expect(inspector.getByText('Artifact Viewer')).toBeVisible();
	await expect(
		inspector.getByText('Spec artifact viewer should render markdown from disk.')
	).toBeVisible();
	const composerResizeHandle = page.getByLabel('Resize conversation and composer');
	await expect(composerResizeHandle).toBeVisible();
	const composerHeightBefore = await readResizeHandleValue(composerResizeHandle);
	await composerResizeHandle.focus();
	await composerResizeHandle.press('ArrowDown');
	const composerHeightAfter = await readResizeHandleValue(composerResizeHandle);
	expect(composerHeightAfter).toBeGreaterThan(composerHeightBefore + 2);
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('pi.workbench.composer-height.v2')), {
			timeout: 5_000
		})
		.toBeTruthy();
	const requirementsRunButton = inspector
		.locator('.spec-step')
		.filter({ hasText: 'Requirements' })
		.getByRole('button', { name: 'Run' });
	await requirementsRunButton.click();
	await expect(page.getByLabel('Prompt')).toHaveValue('');
	const modelEmptyState = page.locator('.model-empty-state');
	if (await modelEmptyState.isVisible()) {
		await expect(
			page.getByText('Select a configured model before sending a prompt.')
		).toBeVisible();
	} else {
		await expect
			.poll(async () => {
				const messages = await readSelectedThreadMessages(page);
				return messages.some(
					(message: { role: string; text: string }) =>
						message.role === 'user' && message.text.includes('Run the Requirements stage')
				);
			})
			.toBe(true);
	}
	await expect
		.poll(
			async () => {
				return (await inspector.textContent().catch(() => '')) ?? '';
			},
			{ timeout: 20_000 }
		)
		.toContain('README.md');
}

async function disableDocparser(page: import('@playwright/test').Page) {
	await page.getByRole('button', { name: 'Settings' }).click();
	const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
	await settingsDialog.getByRole('button', { name: 'Extensions' }).click();
	await expect(settingsDialog.getByRole('heading', { level: 3, name: 'Extensions' })).toBeVisible();
	await settingsDialog.locator('#docparser-toggle').click({ force: true });
	await settingsDialog.getByLabel('Close the modal').click();
}

async function pasteImageAttachment(page: import('@playwright/test').Page) {
	const pngBytes = [
		137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0,
		0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 255, 255, 63, 0, 5, 254,
		2, 254, 167, 53, 129, 132, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
	];
	await page.evaluate((bytes) => {
		const textarea = document.querySelector('textarea');
		if (!(textarea instanceof HTMLTextAreaElement)) {
			throw new Error('Composer textarea was not found.');
		}

		const transfer = new DataTransfer();
		const file = new File([new Uint8Array(bytes)], 'clipboard-image.png', { type: 'image/png' });
		transfer.items.add(file);
		const event = new Event('paste', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'clipboardData', {
			configurable: true,
			value: transfer
		});
		textarea.dispatchEvent(event);
	}, pngBytes);
}

async function verifyLargePromptInput(page: import('@playwright/test').Page) {
	const promptField = page.getByLabel('Prompt');
	const largePrompt = `${'Spec context line.\n'.repeat(450)}Tail marker for long input.`;
	await expect(promptField).not.toHaveAttribute('maxlength', /\d+/);
	await promptField.fill(largePrompt);
	await expect(promptField).toHaveValue(largePrompt);
}

async function verifyPastedImageWarning(page: import('@playwright/test').Page) {
	const warningText =
		'Image preview unavailable. Enable the document parser for inline image parsing.';
	await disableDocparser(page);
	await pasteImageAttachment(page);

	const attachmentChip = page.locator('.attachment-chip', { hasText: 'clipboard-image.png' });
	await expect
		.poll(
			async () => {
				return (await attachmentChip.textContent().catch(() => '')) ?? '';
			},
			{ timeout: 20_000 }
		)
		.toContain('limited');
	await expect(attachmentChip).toContainText(warningText);
	await expect(attachmentChip).not.toContainText('failed');

	const specButton = page.getByRole('button', { exact: true, name: 'Spec' });
	if ((await specButton.getAttribute('aria-pressed')) !== 'true') {
		await specButton.click();
	}
	const inspector = page.locator('.inspector-rail');
	await expect(inspector).toBeVisible();
	await expect(inspector).toContainText('clipboard-image.png');
	await expect(inspector).toContainText('limited');
	await expect(inspector).toContainText(warningText);
}

test('runs the real desktop workflow through Tauri', async () => {
	const sampleRepo = createSampleRepo();
	const cleanRepo = createCleanRepo();
	const primaryProjectName = path.basename(process.cwd());
	const reviewProjectName = 'Sample workspace';
	const reviewThreadTitle = 'Review diff changes';
	let browser: import('@playwright/test').Browser | undefined;
	let page: import('@playwright/test').Page | undefined;
	try {
		const desktop = await getDesktopPage();
		browser = desktop.browser;
		page = desktop.page;
		await addProjectAndThread(page);
		await addProjectByPath(page, sampleRepo);
		await createThreadForProject(page, sampleRepo);
		await verifyLeftPanelActions(page, sampleRepo);
		await verifySettingsAndDiff(page, sampleRepo, reviewProjectName);
		await verifyShipWithDiffShowsReviewGate(page);
		await verifyShipReviewPersistsAcrossThreadSwitch(
			page,
			primaryProjectName,
			reviewProjectName,
			reviewThreadTitle
		);
		await attachReadmeToSelectedThread(page, sampleRepo);
		await verifyLargePromptInput(page);
		await verifyPastedImageWarning(page);
		await page.getByRole('button', { name: `Create thread in ${reviewProjectName}` }).click();
		await expect(page.getByText('Send a message to start the conversation.')).toBeVisible();
		await verifyPromptFlow(page);
		await removeSelectedProjectFromRail(page);
		await verifyShipWithoutDiffContinues(page, cleanRepo);
	} finally {
		await browser?.close();
		await removeDirectoryWithRetries(sampleRepo);
		await removeDirectoryWithRetries(cleanRepo);
	}
});
