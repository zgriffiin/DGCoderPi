<script lang="ts">
	import { tick } from 'svelte';
	import Code from 'carbon-icons-svelte/lib/Code.svelte';
	import Edit from 'carbon-icons-svelte/lib/Edit.svelte';
	import OverflowMenuHorizontal from 'carbon-icons-svelte/lib/OverflowMenuHorizontal.svelte';
	import Renew from 'carbon-icons-svelte/lib/Renew.svelte';
	import Stop from 'carbon-icons-svelte/lib/StopFilledAlt.svelte';
	import TrashCan from 'carbon-icons-svelte/lib/TrashCan.svelte';
	import type { ProjectRecord } from '$lib/types/workbench';
	import StatusTag from './StatusTag.svelte';

	type MenuState =
		| { id: string; kind: 'project'; x: number; y: number }
		| { id: string; kind: 'thread'; projectId: string; x: number; y: number };

	type RenameState =
		| { id: string; kind: 'project'; value: string }
		| { id: string; kind: 'thread'; value: string };

	type Props = {
		onCreateThread: (projectId: string) => void;
		onMoveProject: (projectId: string, targetIndex: number) => void;
		onOpenDiff: (projectId: string, threadId?: string) => void;
		onRefreshStatus: () => void;
		onRemoveProject: (projectId: string) => void;
		onRenameProject: (projectId: string, name: string) => void;
		onRenameThread: (threadId: string, title: string) => void;
		onSelectProject: (projectId: string) => void;
		onSelectThread: (projectId: string, threadId: string) => void;
		onStopThread: (threadId: string) => void;
		projects: ProjectRecord[];
		selectedProjectId: string;
		selectedThreadId: string;
	};

	let activeMenu = $state<MenuState | null>(null);
	let confirmingRemoveProjectId = $state<string | null>(null);
	let draggedProjectId = $state<string | null>(null);
	let renameState = $state<RenameState | null>(null);
	let renameInput = $state<HTMLInputElement | null>(null);

	let {
		onCreateThread,
		onMoveProject,
		onOpenDiff,
		onRefreshStatus,
		onRemoveProject,
		onRenameProject,
		onRenameThread,
		onSelectProject,
		onSelectThread,
		onStopThread,
		projects,
		selectedProjectId,
		selectedThreadId
	}: Props = $props();

	function sortedThreads(project: ProjectRecord) {
		return [...project.threads].sort((left, right) => {
			return (
				(right.lastUserMessageAtMs || right.updatedAtMs) -
				(left.lastUserMessageAtMs || left.updatedAtMs)
			);
		});
	}

	function handleDragStart(projectId: string) {
		draggedProjectId = projectId;
	}

	function handleDrop(projectId: string | null, targetIndex: number) {
		if (!draggedProjectId || draggedProjectId === projectId) {
			draggedProjectId = null;
			return;
		}

		onMoveProject(draggedProjectId, targetIndex);
		draggedProjectId = null;
	}

	function openProjectMenu(event: MouseEvent | KeyboardEvent, projectId: string) {
		event.preventDefault();
		event.stopPropagation();
		confirmingRemoveProjectId = null;
		activeMenu = menuFromEvent(event, { id: projectId, kind: 'project' });
	}

	function openThreadMenu(event: MouseEvent | KeyboardEvent, projectId: string, threadId: string) {
		event.preventDefault();
		event.stopPropagation();
		confirmingRemoveProjectId = null;
		activeMenu = menuFromEvent(event, { id: threadId, kind: 'thread', projectId });
	}

	function menuFromEvent<T extends Omit<MenuState, 'x' | 'y'>>(
		event: MouseEvent | KeyboardEvent,
		menu: T
	) {
		const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
		const box = target?.getBoundingClientRect();
		return {
			...menu,
			x: event instanceof MouseEvent && event.clientX > 0 ? event.clientX : (box?.right ?? 0),
			y: event instanceof MouseEvent && event.clientY > 0 ? event.clientY : (box?.bottom ?? 0)
		};
	}

	async function startRename(next: RenameState) {
		activeMenu = null;
		renameState = next;
		await tick();
		renameInput?.focus();
		renameInput?.select();
	}

	function saveRename() {
		if (!renameState) {
			return;
		}

		const nextValue = renameState.value.trim();
		if (!nextValue) {
			renameState = null;
			return;
		}

		if (renameState.kind === 'project') {
			onRenameProject(renameState.id, nextValue);
		} else {
			onRenameThread(renameState.id, nextValue);
		}
		renameState = null;
	}

	function handleRenameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveRename();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			renameState = null;
		}
	}

	function handleRowKeydown(
		event: KeyboardEvent,
		target:
			| { kind: 'project'; project: ProjectRecord }
			| { kind: 'thread'; projectId: string; threadId: string; title: string }
	) {
		if (event.key === 'F2') {
			event.preventDefault();
			if (target.kind === 'project') {
				void startRename({ id: target.project.id, kind: 'project', value: target.project.name });
			} else {
				void startRename({ id: target.threadId, kind: 'thread', value: target.title });
			}
		}

		if (event.shiftKey && event.key === 'F10') {
			if (target.kind === 'project') {
				openProjectMenu(event, target.project.id);
			} else {
				openThreadMenu(event, target.projectId, target.threadId);
			}
		}
	}

	function removeProject(project: ProjectRecord) {
		activeMenu = null;
		confirmingRemoveProjectId = null;
		onRemoveProject(project.id);
	}

	function findMenuProject() {
		const menu = activeMenu;
		return menu?.kind === 'project' ? projects.find((project) => project.id === menu.id) : null;
	}

	function findMenuThread() {
		const menu = activeMenu;
		if (menu?.kind !== 'thread') {
			return null;
		}
		const project = projects.find((entry) => entry.id === menu.projectId);
		const thread = project?.threads.find((entry) => entry.id === menu.id) ?? null;
		return project && thread ? { project, thread } : null;
	}

	function createThreadFromMenu() {
		const project = findMenuProject();
		activeMenu = null;
		if (project) {
			onCreateThread(project.id);
		}
	}

	function openDiffFromMenu() {
		const record = findMenuThread();
		activeMenu = null;
		if (record) {
			onOpenDiff(record.project.id, record.thread.id);
		}
	}

	function refreshStatusFromMenu() {
		activeMenu = null;
		onRefreshStatus();
	}

	function stopThreadFromMenu() {
		const record = findMenuThread();
		activeMenu = null;
		if (record) {
			onStopThread(record.thread.id);
		}
	}
</script>

<aside class="project-rail">
	<div class="project-list" role="list">
		{#if projects.length === 0}
			<div class="empty-panel">
				<p>No projects</p>
				<span>Add one from the header.</span>
			</div>
		{:else}
			{#each projects as project, index (project.id)}
				<section
					class="project-section"
					data-selected={project.id === selectedProjectId ? 'true' : undefined}
					draggable="true"
					role="listitem"
					ondragstart={() => handleDragStart(project.id)}
					ondragend={() => (draggedProjectId = null)}
					ondragover={(event) => event.preventDefault()}
					ondrop={() => handleDrop(project.id, index)}
				>
					<div class="project-section__header">
						{#if renameState?.kind === 'project' && renameState.id === project.id}
							<div class="project-section__title project-section__title--editing">
								<div class="project-section__identity">
									<input
										bind:this={renameInput}
										aria-label={`Rename ${project.name}`}
										class="rail-rename-input"
										value={renameState.value}
										onblur={saveRename}
										oninput={(event) =>
											(renameState = {
												id: project.id,
												kind: 'project',
												value: event.currentTarget.value
											})}
										onkeydown={handleRenameKeydown}
									/>
									<p>{project.branch}</p>
								</div>
								<span>{project.threads.length}</span>
							</div>
						{:else}
							<button
								class="project-section__title"
								type="button"
								onclick={() => onSelectProject(project.id)}
								oncontextmenu={(event) => openProjectMenu(event, project.id)}
								onkeydown={(event) => handleRowKeydown(event, { kind: 'project', project })}
							>
								<div class="project-section__identity">
									<h2>{project.name}</h2>
									<p>{project.branch}</p>
								</div>
								<span>{project.threads.length}</span>
							</button>
						{/if}

						<button
							aria-label={`Create thread in ${project.name}`}
							class="project-section__new-thread"
							type="button"
							onclick={() => onCreateThread(project.id)}
						>
							+
						</button>
						<button
							aria-label="Project actions"
							class="rail-action-button"
							type="button"
							onclick={(event) => openProjectMenu(event, project.id)}
						>
							<OverflowMenuHorizontal size={16} />
						</button>
					</div>

					<ul class="thread-list">
						{#each sortedThreads(project) as thread (thread.id)}
							<li>
								<div
									class="thread-row"
									data-thread-id={thread.id}
									data-selected={thread.id === selectedThreadId ? 'true' : undefined}
								>
									{#if renameState?.kind === 'thread' && renameState.id === thread.id}
										<div class="thread-row__select thread-row__select--editing">
											<StatusTag status={thread.status} />
											<input
												bind:this={renameInput}
												aria-label={`Rename ${thread.title}`}
												class="rail-rename-input"
												value={renameState.value}
												onblur={saveRename}
												oninput={(event) =>
													(renameState = {
														id: thread.id,
														kind: 'thread',
														value: event.currentTarget.value
													})}
												onkeydown={handleRenameKeydown}
											/>
										</div>
									{:else}
										<button
											class="thread-row__select"
											title={new Date(thread.updatedAtMs).toLocaleString()}
											type="button"
											onclick={() => onSelectThread(project.id, thread.id)}
											oncontextmenu={(event) => openThreadMenu(event, project.id, thread.id)}
											onkeydown={(event) =>
												handleRowKeydown(event, {
													kind: 'thread',
													projectId: project.id,
													threadId: thread.id,
													title: thread.title
												})}
										>
											<StatusTag status={thread.status} />
											<h3>{thread.title}</h3>
										</button>
									{/if}
									<button
										aria-label="Thread actions"
										class="rail-action-button"
										type="button"
										onclick={(event) => openThreadMenu(event, project.id, thread.id)}
									>
										<OverflowMenuHorizontal size={16} />
									</button>
								</div>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
			<div
				class="project-section project-section--drop-target"
				aria-hidden="true"
				role="presentation"
				ondragover={(event) => event.preventDefault()}
				ondrop={() => handleDrop(null, projects.length)}
			></div>
		{/if}
	</div>

	{#if activeMenu}
		<button
			aria-label="Close actions menu"
			class="rail-menu-backdrop"
			type="button"
			onclick={() => {
				activeMenu = null;
				confirmingRemoveProjectId = null;
			}}
			oncontextmenu={(event) => {
				event.preventDefault();
				activeMenu = null;
				confirmingRemoveProjectId = null;
			}}
		></button>
		<div
			class="rail-menu"
			role="menu"
			style={`left: ${activeMenu.x}px; top: ${activeMenu.y}px;`}
			tabindex="-1"
			onkeydown={(event) => event.key === 'Escape' && (activeMenu = null)}
		>
			{#if activeMenu.kind === 'project' && findMenuProject()}
				{@const project = findMenuProject()}
				{#if project && confirmingRemoveProjectId === project.id}
					<div class="rail-menu__confirm" role="group" aria-label={`Remove ${project.name}`}>
						<p>Remove from project list?</p>
						<span>Files on disk are not deleted.</span>
					</div>
					<button role="menuitem" type="button" onclick={() => removeProject(project)}>
						<TrashCan size={16} /> Confirm remove
					</button>
					<button role="menuitem" type="button" onclick={() => (confirmingRemoveProjectId = null)}>
						Cancel
					</button>
				{:else}
					<button
						role="menuitem"
						type="button"
						onclick={() =>
							project && startRename({ id: project.id, kind: 'project', value: project.name })}
					>
						<Edit size={16} /> Rename
					</button>
					<button role="menuitem" type="button" onclick={createThreadFromMenu}>
						+ New thread
					</button>
					<button role="menuitem" type="button" onclick={refreshStatusFromMenu}>
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
			{:else if activeMenu.kind === 'thread' && findMenuThread()}
				{@const record = findMenuThread()}
				<button
					role="menuitem"
					type="button"
					onclick={() =>
						record &&
						startRename({ id: record.thread.id, kind: 'thread', value: record.thread.title })}
				>
					<Edit size={16} /> Rename
				</button>
				<button role="menuitem" type="button" onclick={openDiffFromMenu}>
					<Code size={16} /> Open diff
				</button>
				{#if record?.thread.status === 'running'}
					<button role="menuitem" type="button" onclick={stopThreadFromMenu}>
						<Stop size={16} /> Stop run
					</button>
				{/if}
			{/if}
		</div>
	{/if}
</aside>
