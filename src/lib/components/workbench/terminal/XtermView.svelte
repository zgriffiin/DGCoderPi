<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import type { ShellType } from './terminal-store';
	import { createSession, getSession, resizeSession } from './terminal-store';

	type Props = {
		projectPath: string;
		shellType: ShellType;
		visible: boolean;
	};

	let { projectPath, shellType, visible }: Props = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let terminal: Terminal | null = null;
	let fitAddon: FitAddon | null = null;
	let dataDisposable: { dispose: () => void } | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let initialized = false;

	function initTerminal() {
		if (!containerEl || initialized) return;
		initialized = true;

		terminal = new Terminal({
			cursorBlink: true,
			fontSize: 13,
			fontFamily: "'IBM Plex Mono', 'Cascadia Code', Consolas, monospace",
			theme: {
				background: '#161616',
				foreground: '#f4f4f4',
				cursor: '#f4f4f4',
				selectionBackground: '#525252',
				black: '#161616',
				red: '#fa4d56',
				green: '#42be65',
				yellow: '#f1c21b',
				blue: '#4589ff',
				magenta: '#be95ff',
				cyan: '#3ddbd9',
				white: '#f4f4f4'
			}
		});

		fitAddon = new FitAddon();
		terminal.loadAddon(fitAddon);
		terminal.open(containerEl);
		fitAddon.fit();

		const cols = terminal.cols;
		const rows = terminal.rows;

		const session =
			getSession(shellType, projectPath) ?? createSession(shellType, projectPath, cols, rows);

		dataDisposable = session.pty.onData((data: Uint8Array) => {
			terminal?.write(data);
		});

		terminal.onData((data: string) => {
			session.pty.write(data);
		});

		terminal.onResize(({ cols: c, rows: r }) => {
			resizeSession(shellType, projectPath, c, r);
		});

		resizeObserver = new ResizeObserver(() => {
			if (visible && fitAddon) {
				fitAddon.fit();
			}
		});
		resizeObserver.observe(containerEl);
	}

	onMount(() => {
		if (visible) {
			initTerminal();
		}
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		dataDisposable?.dispose();
		terminal?.dispose();
		terminal = null;
		fitAddon = null;
		initialized = false;
	});

	$effect(() => {
		if (visible && containerEl && !initialized) {
			initTerminal();
		}
		if (visible && fitAddon) {
			requestAnimationFrame(() => fitAddon?.fit());
		}
	});
</script>

<div
	bind:this={containerEl}
	class="xterm-container"
	class:xterm-container--hidden={!visible}
	role="group"
	aria-label="{shellType === 'powershell' ? 'PowerShell' : 'WSL'} terminal"
></div>

<style>
	.xterm-container {
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.xterm-container--hidden {
		display: none;
	}
</style>
