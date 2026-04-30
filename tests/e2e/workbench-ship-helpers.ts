import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';

const sanitizedGitEnv = Object.fromEntries(
	Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
);

export function createCleanRepo() {
	const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'pi-ship-clean-'));
	writeFileSync(path.join(repoRoot, 'README.md'), '# Clean repo\n');
	runGit(repoRoot, ['init', '-b', 'main']);
	runGit(repoRoot, ['config', 'commit.gpgsign', 'false']);
	runGit(repoRoot, ['config', 'user.email', 'pi@example.com']);
	runGit(repoRoot, ['config', 'user.name', 'Pi']);
	runGit(repoRoot, ['add', '.']);
	runGit(repoRoot, ['commit', '-m', 'initial']);
	return repoRoot;
}

export function createSampleRepo() {
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

export async function addProjectByPath(page: Page, repoPath: string) {
	await page.getByRole('button', { name: 'Add project' }).click();
	await page.getByRole('button', { name: 'Paste path' }).click();
	await page.getByLabel('Repository path').fill(repoPath);
	await page.getByRole('button', { name: 'Add from path' }).click();
}

export async function createThreadForProject(page: Page, repoPath: string) {
	await page
		.getByRole('button', {
			name: `Create thread in ${path.basename(repoPath)}`
		})
		.click();
	await expect(page.getByText('Send a message to start the conversation.')).toBeVisible();
}

export async function verifyShipWithoutDiffContinues(page: Page, repoPath: string) {
	await addProjectByPath(page, repoPath);
	await createThreadForProject(page, repoPath);
	await page.getByRole('button', { exact: true, name: 'Ship' }).click();
	const readOutcome = async () => {
		const body =
			(await page
				.locator('.center-column')
				.textContent()
				.catch(() => '')) ?? '';
		if (body.includes('We are done with this slice.')) return 'sent';
		if (body.includes('Select a configured model before sending a prompt.')) return 'validation';
		return 'pending';
	};
	await expect.poll(readOutcome, { timeout: 30_000 }).not.toBe('pending');
	const outcome = await readOutcome();
	if (outcome === 'sent') {
		const stopButton = page.getByRole('button', { name: 'Stop' });
		if (await stopButton.isEnabled().catch(() => false)) {
			await stopButton.click();
		}
	}
}

export async function verifyShipWithDiffShowsReviewGate(page: Page) {
	await page.getByRole('button', { exact: true, name: 'Ship' }).click();
	await expect
		.poll(
			async () => {
				const text =
					(await page
						.locator('.composer-panel')
						.textContent()
						.catch(() => '')) ?? '';
				if (text.includes('Reviewing changes before commit')) return 'reviewing';
				if (text.includes('Commit blocked')) return 'blocked';
				if (text.includes('Review needs a decision')) return 'decision';
				return 'pending';
			},
			{ timeout: 30_000 }
		)
		.not.toBe('pending');
}

function runGit(repoRoot: string, args: string[]) {
	execFileSync('git', args, {
		cwd: repoRoot,
		env: sanitizedGitEnv,
		stdio: 'ignore'
	});
}
