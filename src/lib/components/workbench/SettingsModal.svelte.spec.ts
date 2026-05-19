import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsModal from './SettingsModal.svelte';

function mountSettingsModal() {
	const target = document.createElement('div');
	document.body.appendChild(target);

	const component = mount(SettingsModal, {
		target,
		props: {
			cavemanLevel: 'medium',
			codex: {
				authMode: null,
				authenticated: false,
				available: false,
				canImportOpenAiKey: false,
				cliPath: null,
				displayStatus: 'Codex CLI not installed'
			},
			diffAnalysisModelKey: 'openai::gpt-5.4',
			diagnosticLoggingEnabled: true,
			docparserEnabled: true,
			models: [
				{
					availableThinkingLevels: ['off', 'low', 'medium', 'high'],
					configured: true,
					id: 'gpt-5.4',
					key: 'openai::gpt-5.4',
					label: 'OpenAI GPT-5.4',
					provider: 'openai',
					supportsImages: true,
					supportsReasoning: true
				}
			],
			onCavemanLevelChange: vi.fn(),
			onClose: vi.fn(),
			onDiffAnalysisModelChange: vi.fn(),
			onImportCodexOpenAiKey: vi.fn(),
			onProviderDraftChange: vi.fn(),
			onRefreshStatus: vi.fn(),
			onSaveProvider: vi.fn(),
			onStartCodexLogin: vi.fn(),
			onToggleDiagnosticLogging: vi.fn(),
			onToggleDocparser: vi.fn(),
			open: true,
			providerDrafts: {},
			providers: []
		}
	});

	return { component, target };
}

function clickButton(target: HTMLElement, text: string) {
	const button = [...target.querySelectorAll('button')].find(
		(element) => element.textContent?.trim() === text
	);
	expect(button, `button ${text}`).toBeTruthy();
	button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('SettingsModal', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('renders saved select values when opened', async () => {
		const { component, target } = mountSettingsModal();

		expect(document.body.textContent).toContain('Behavior');
		await tick();
		clickButton(document.body, 'Behavior');
		await tick();
		expect(document.body.textContent).toContain('Caveman mode');
		expect(document.body.querySelector<HTMLSelectElement>('#caveman-level')?.value).toBe('medium');

		clickButton(document.body, 'Providers');
		await tick();
		expect(document.body.querySelector<HTMLSelectElement>('#diff-analysis-model')?.value).toBe(
			'openai::gpt-5.4'
		);

		unmount(component);
		target.remove();
	});
});
