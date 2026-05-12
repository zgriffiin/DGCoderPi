<script lang="ts">
	import ArrowDown from 'carbon-icons-svelte/lib/ArrowDown.svelte';
	import ArrowUp from 'carbon-icons-svelte/lib/ArrowUp.svelte';
	import Code from 'carbon-icons-svelte/lib/Code.svelte';
	import Edit from 'carbon-icons-svelte/lib/Edit.svelte';
	import Renew from 'carbon-icons-svelte/lib/Renew.svelte';
	import Stop from 'carbon-icons-svelte/lib/StopFilledAlt.svelte';
	import TrashCan from 'carbon-icons-svelte/lib/TrashCan.svelte';
	import type { ProjectRecord } from '$lib/types/workbench';

	type MenuState =
		| { id: string; kind: 'project'; x: number; y: number }
		| { id: string; kind: 'thread'; projectId: string; x: number; y: number };

	type Props = {
		menu: MenuState;
		onClose: () => void;
		onCreateThread: (projectId: string) => void;
		onMoveProject: (projectId: string, delta: number) => void;
		onOpenDiff: (projectId: string, threadId: string) => void;
		onRefreshStatus: () => void;
		onRemoveProject: (projectId: string) => void;
		onRemoveThread: (threadId: string) => void;
		onRenameProject: (projectId: string, name: string) => void;
		onRenameThread: (threadId: string, title: string) => void;
		onStopThread: (threadId: string) => void;
		projects: ProjectRecord[];
	};

	let {
		menu,
		onClose,
		onCreateThread,
		onMoveProject,
		onOpenDiff,
		onRefreshStatus,
		onRemoveProject,
		onRemoveThread,
		onRenameProject,
		onRenameThread,
		onStopThread,
		projects
	}: Props = $props();

	let confirmingRemoveProjectId = $state<string | null>(null);
	let confirmingRemoveThreadId = $state<string | null>(null);

	function findMenuProject() {
		return menu.kind === 'project' ? projects.find((p) => p.id === menu.id) : null;
	}

	function findMenuThread() {
		if (menu.kind !== 'thread') {
			return null;
		}
		const project = projects.find((p) => p.id === menu.projectId);
		const thread = project?.threads.find((t) => t.id === menu.id) ?? null;
		return project && thread ? { project, thread } : null;
	}

	function close() {
		confirmingRemoveProjectId = null;
		confirmingRemoveThreadId = null;
		onClose();
	}
</script>

<button
	aria-label="Close actions menu"
	class="rail-menu-backdrop"
	type="button"
	onclick={close}
	oncontextmenu={(event) => {
		event.preventDefault();
		close();
	}}
></button>
<div
	class="rail-menu"
	role="menu"
	style={`left: ${menu.x}px; top: ${menu.y}px;`}
	tabindex="-1"
	onkeydown={(event) => event.key === 'Escape' && close()}
>
	{#if menu.kind === 'project' && findMenuProject()}
		{@const project = findMenuProject()}
		{#if project && confirmingRemoveProjectId === project.id}
			<div class="rail-menu__confirm" role="group" aria-label={`Remove ${project.name}`}>
				<p>Remove from project list?</p>
				<span>Files on disk are not deleted.</span>
			</div>
			<button
				role="menuitem"
				type="button"
				onclick={() => {
					onRemoveProject(project.id);
					close();
				}}
			>
				<TrashCan size={16} /> Confirm remove
			</button>
			<button role="menuitem" type="button" onclick={() => (confirmingRemoveProjectId = null)}>
				Cancel
			</button>
		{:else}
			<button
				role="menuitem"
				type="button"
				onclick={() => {
					if (project) {
						onRenameProject(project.id, project.name);
					}
					close();
				}}
			>
				<Edit size={16} /> Rename
			</button>
			<button
				role="menuitem"
				type="button"
				onclick={() => {
					if (project) onCreateThread(project.id);
					close();
				}}
			>
				+ New thread
			</button>
			<button
				role="menuitem"
				type="button"
				onclick={() => {
					if (project) onMoveProject(project.id, -1);
					close();
				}}
			>
				<ArrowUp size={16} /> Move up
			</button>
			<button
				role="menuitem"
				type="button"
				onclick={() => {
					if (project) onMoveProject(project.id, 1);
					close();
				}}
			>
				<ArrowDown size={16} /> Move down
			</button>
			<button
				role="menuitem"
				type="button"
				onclick={() => {
					onRefreshStatus();
					close();
				}}
			>
				<Renew size={16} /> Refresh status
			</button>
			<button
				role="menuitem"
				type="button"
				onclick={() => project && (confirmingRemoveProjectId = project.id)}
			>
				<TrashCan size={16} /> Remove project
			</button>
		{/if}
	{:else if menu.kind === 'thread' && findMenuThread()}
		{@const record = findMenuThread()}
		{#if record && confirmingRemoveThreadId === record.thread.id}
			<div class="rail-menu__confirm" role="group" aria-label={`Delete ${record.thread.title}`}>
				<p>Delete thread?</p>
				<span>This removes the thread from the project list.</span>
			</div>
			<button
				role="menuitem"
				type="button"
				onclick={() => {
					onRemoveThread(record.thread.id);
					close();
				}}
			>
				<TrashCan size={16} /> Confirm delete
			</button>
			<button role="menuitem" type="button" onclick={() => (confirmingRemoveThreadId = null)}>
				Cancel
			</button>
		{:else}
			<button
				role="menuitem"
				type="button"
				onclick={() => {
					if (record) onRenameThread(record.thread.id, record.thread.title);
					close();
				}}
			>
				<Edit size={16} /> Rename
			</button>
			<button
				role="menuitem"
				type="button"
				onclick={() => {
					if (record) onOpenDiff(record.project.id, record.thread.id);
					close();
				}}
			>
				<Code size={16} /> Open diff
			</button>
			{#if record?.thread.status === 'running'}
				<button
					role="menuitem"
					type="button"
					onclick={() => {
						if (record) onStopThread(record.thread.id);
						close();
					}}
				>
					<Stop size={16} /> Stop run
				</button>
			{:else if record}
				<button
					role="menuitem"
					type="button"
					onclick={() => (confirmingRemoveThreadId = record.thread.id)}
				>
					<TrashCan size={16} /> Delete thread
				</button>
			{/if}
		{/if}
	{/if}
</div>
