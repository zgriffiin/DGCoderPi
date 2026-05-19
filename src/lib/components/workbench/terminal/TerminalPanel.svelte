<script lang="ts">
	import { Button } from 'carbon-components-svelte';
	import Close from 'carbon-icons-svelte/lib/Close.svelte';
	import type { ShellType } from './terminal-store';
	import XtermView from './XtermView.svelte';

	type Props = {
		onClose: () => void;
		projectPath: string;
	};

	let { onClose, projectPath }: Props = $props();
	let activeTab = $state<ShellType>('powershell');
</script>

<section class="terminal-panel" aria-label="Terminal">
	<header class="terminal-panel__header">
		<nav class="terminal-panel__tabs" aria-label="Terminal shell tabs">
			<button
				class="terminal-panel__tab"
				class:terminal-panel__tab--active={activeTab === 'powershell'}
				onclick={() => (activeTab = 'powershell')}
				aria-selected={activeTab === 'powershell'}
				role="tab"
			>
				PowerShell
			</button>
			<button
				class="terminal-panel__tab"
				class:terminal-panel__tab--active={activeTab === 'wsl'}
				onclick={() => (activeTab = 'wsl')}
				aria-selected={activeTab === 'wsl'}
				role="tab"
			>
				WSL
			</button>
		</nav>
		<Button
			icon={Close}
			kind="ghost"
			size="small"
			onclick={onClose}
			iconDescription="Close terminal"
		/>
	</header>

	<div class="terminal-panel__body">
		<XtermView {projectPath} shellType="powershell" visible={activeTab === 'powershell'} />
		<XtermView {projectPath} shellType="wsl" visible={activeTab === 'wsl'} />
	</div>
</section>

<style>
	.terminal-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background: var(--cds-layer, #262626);
		border-left: 1px solid var(--cds-border-subtle, #393939);
	}

	.terminal-panel__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.25rem 0 0.75rem;
		height: 2.5rem;
		min-height: 2.5rem;
		border-bottom: 1px solid var(--cds-border-subtle, #393939);
	}

	.terminal-panel__tabs {
		display: flex;
		gap: 0;
	}

	.terminal-panel__tab {
		appearance: none;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--cds-text-secondary, #c6c6c6);
		cursor: pointer;
		font-size: 0.8125rem;
		padding: 0.5rem 0.75rem;
		transition:
			color 70ms,
			border-color 70ms;
	}

	.terminal-panel__tab:hover {
		color: var(--cds-text-primary, #f4f4f4);
	}

	.terminal-panel__tab--active {
		border-bottom-color: var(--cds-interactive, #4589ff);
		color: var(--cds-text-primary, #f4f4f4);
	}

	.terminal-panel__body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		padding: 0.25rem;
	}
</style>
