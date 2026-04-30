import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, expect, test } from '@playwright/test';

const DESKTOP_DEBUG_URL = 'http://127.0.0.1:9333';
const DESKTOP_PAGE_MARKER = 'DGCoder';
const sanitizedGitEnv = Object.fromEntries(
	Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
);

test.setTimeout(120_000);

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
	await expect(page.getByRole('button', { name: 'Attach' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Ship' })).toBeVisible();
}

function createSampleRepo() {
	const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'pi-diff-viewer-'));
	mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
	mkdirSync(path.join(repoRoot, 'docs'), { recursive: true });
	writeFileSync(
		path.join(repoRoot, 'src', 'counter.ts'),
		'export function counterLabel(count: number) {\n\treturn `Count: ${count}`;\n}\n'
	);
	writeFileSync(path.join(repoRoot, 'README.md'), '# Sample repo\n');
	runGit(repoRoot, ['init', '-b', 'main']);
	runGit(repoRoot, ['config', 'commit.gpgsign', 'false']);
	runGit(repoRoot, ['config', 'user.email', 'pi@example.com']);
	runGit(repoRoot, ['config', 'user.name', 'Pi']);
	runGit(repoRoot, ['add', '.']);
	runGit(repoRoot, ['commit', '-m', 'initial']);

	writeFileSync(
		path.join(repoRoot, 'src', 'counter.ts'),
		[
			'export function counterLabel(count: number, pending = false) {',
			"\tconst suffix = pending ? ' (pending)' : '';",
			'\treturn `Count: ${count}${suffix}`;',
			'}',
			''
		].join('\n')
	);
	writeFileSync(
		path.join(repoRoot, 'docs', 'notes.md'),
		['# Notes', '', '- Added pending label handling.', ''].join('\n')
	);

	return repoRoot;
}

function runGit(repoRoot: string, args: string[]) {
	execFileSync('git', args, {
		cwd: repoRoot,
		env: sanitizedGitEnv,
		stdio: 'ignore'
	});
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

async function waitForReviewState(panel: import('@playwright/test').Locator) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const text = (await panel.textContent().catch(() => '')) ?? '';
		if (text.includes('Grounded review ready')) {
			return 'ready';
		}
		if (text.includes('Review in progress')) {
			return 'progress';
		}
		if (
			text.includes('Retry analysis') ||
			text.includes('Configure a model in Settings before running AI Review.') ||
			text.includes('Start analysis') ||
			text.includes('Preparing AI review') ||
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
	const patchViewButton = inspector.getByRole('tab', { name: 'Patch View' });
	await patchViewButton.click();
	await expect(
		inspector.getByRole('button', { name: /Hide whitespace|Show whitespace/ })
	).toBeVisible();
	await expect(inspector.getByRole('heading', { level: 3, name: 'src/counter.ts' })).toBeVisible();
	await expect(inspector.getByRole('heading', { level: 3, name: 'docs/notes.md' })).toBeVisible();
	await expect(inspector.getByText('pending label handling')).toBeVisible();

	await inspector.getByRole('tab', { name: 'AI Review' }).click();
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
		await expect(aiReviewStatus.getByText('Review in progress')).toBeVisible();
		await expect(aiReviewStatus.getByText(/^complete$/)).toHaveCount(0);
	} else {
		await expect(aiReviewStatus).toContainText(
			/Configure a model in Settings before running AI Review\.|Retry analysis|Start analysis|Preparing AI review|Clean working tree/
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

async function attachReadmeToSelectedThread(page: import('@playwright/test').Page) {
	const inspector = page.locator('.inspector-rail');
	const settingsButton = page.getByRole('button', { name: 'Settings' });
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
	await settingsButton.click();
	const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
	await settingsDialog.getByRole('button', { name: 'Refresh status' }).click();
	await settingsDialog.getByLabel('Close the modal').click();
	await page.getByRole('button', { exact: true, name: 'Spec' }).click();
	await expect
		.poll(
			async () => {
				return (await inspector.textContent().catch(() => '')) ?? '';
			},
			{ timeout: 20_000 }
		)
		.toContain('README.md');
}

async function verifyPromptFlow(page: import('@playwright/test').Page) {
	const modelEmptyState = page.locator('.model-empty-state');
	const promptText = 'Reply with the word ready.';
	if (await modelEmptyState.isVisible()) {
		await page.getByLabel('Prompt').fill('Describe the current workbench state.');
		await page.getByRole('button', { name: 'Start' }).click();
		await expect(
			page.getByText('Select a configured model before sending a prompt.')
		).toBeVisible();
		return;
	}

	await expect(page.locator('.composer-panel .bx--list-box').first()).toBeVisible();
	await page.getByLabel('Prompt').fill(promptText);
	await page.getByRole('button', { name: 'Start' }).click();
	const readSendState = async () => {
		if (
			await page
				.getByText('Select a configured model before sending a prompt.')
				.isVisible()
				.catch(() => false)
		) {
			return 'validation';
		}

		const userMessages = await page
			.locator('.message-row[data-tone="user"] .message-row__body')
			.allTextContents()
			.catch(() => []);
		return userMessages.some((message) => message.includes(promptText)) ? 'queued' : 'pending';
	};
	await expect.poll(readSendState, { timeout: 30_000 }).not.toBe('pending');
	const sendState = await readSendState();
	if (sendState === 'validation') {
		await expect(
			page.getByText('Select a configured model before sending a prompt.')
		).toBeVisible();
		return;
	}

	const assistantBody = page
		.locator('.message-row[data-tone="assistant"] .message-row__body')
		.first();
	const failureAlert = page.getByText('Run failed');
	const readOutcome = async () => {
		if (await failureAlert.isVisible().catch(() => false)) {
			return 'failed';
		}
		return (await assistantBody.textContent().catch(() => null))?.includes('ready')
			? 'ready'
			: 'pending';
	};
	await expect.poll(readOutcome, { timeout: 120_000 }).not.toBe('pending');
	const outcome = await readOutcome();
	if (outcome === 'ready') {
		await expect(assistantBody).toContainText('ready');
		return;
	}

	await expect(failureAlert).toBeVisible();
	await expect(page.getByText('fetch failed')).toBeVisible();
}

test('runs the real desktop workflow through Tauri', async () => {
	const sampleRepo = createSampleRepo();
	let browser: import('@playwright/test').Browser | undefined;
	let page: import('@playwright/test').Page | undefined;
	try {
		const desktop = await getDesktopPage();
		browser = desktop.browser;
		page = desktop.page;
		await addProjectAndThread(page);
		await page.getByRole('button', { name: 'Add project' }).click();
		await page.getByRole('button', { name: 'Paste path' }).click();
		await page.getByLabel('Repository path').fill(sampleRepo);
		await page.getByRole('button', { name: 'Add from path' }).click();
		await page
			.getByRole('button', {
				name: new RegExp(`Create thread in ${escapeRegExp(path.basename(sampleRepo))}`)
			})
			.click();
		await verifyLeftPanelActions(page, sampleRepo);
		await verifySettingsAndDiff(page, sampleRepo, 'Sample workspace');
		await attachReadmeToSelectedThread(page);
		await verifyPromptFlow(page);
		await removeSelectedProjectFromRail(page);
	} finally {
		await browser?.close();
		await removeDirectoryWithRetries(sampleRepo);
	}
});
