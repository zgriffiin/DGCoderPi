<script lang="ts">
	import { tick } from 'svelte';
	import CaretDown from 'carbon-icons-svelte/lib/CaretDown.svelte';
	import CaretRight from 'carbon-icons-svelte/lib/CaretRight.svelte';
	import DocumentView from 'carbon-icons-svelte/lib/DocumentView.svelte';
	import Draggable from 'carbon-icons-svelte/lib/Draggable.svelte';
	import OverflowMenuHorizontal from 'carbon-icons-svelte/lib/OverflowMenuHorizontal.svelte';
	import type { ProjectRecord } from '$lib/types/workbench';
	import ProjectRailMenu from './ProjectRailMenu.svelte';
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
		onOpenFileExplorer: (projectId: string) => void;
		onRefreshStatus: () => void;
		onRemoveProject: (projectId: string) => void;
		onRemoveThread: (threadId: string) => void;
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
	let collapsedProjectIds = $state<string[]>([]);
	let draggedProjectId = $state<string | null>(null);
	let dragTargetIndex = $state<number | null>(null);
	let renameState = $state<RenameState | null>(null);
	let renameInput = $state<HTMLInputElement | null>(null);

	let {
		onCreateThread,
		onMoveProject,
		onOpenDiff,
		onOpenFileExplorer,
		onRefreshStatus,
		onRemoveProject,
		onRemoveThread,
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

	function handlePointerDrag(event: PointerEvent, projectId: string) {
		event.preventDefault();
		const target = event.currentTarget;
		if (!(target instanceof HTMLElement)) return;
		target.setPointerCapture(event.pointerId);
		draggedProjectId = projectId;
		dragTargetIndex = projects.findIndex((p) => p.id === projectId);
		const listElement = target.closest('.project-list');

		const handlePointerMove = (moveEvent: PointerEvent) => {
			if (!listElement) return;
			const sections = Array.from(listElement.querySelectorAll('.project-section'));
			for (let i = 0; i < sections.length; i++) {
				const rect = sections[i].getBoundingClientRect();
				if (moveEvent.clientY < rect.top + rect.height / 2) {
					dragTargetIndex = i;
					return;
				}
			}
			dragTargetIndex = sections.length;
		};

		const cleanup = () => {
			if (target.hasPointerCapture(event.pointerId)) {
				target.releasePointerCapture(event.pointerId);
			}
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
			target.removeEventListener('pointercancel', handleCancel);
			target.removeEventListener('lostpointercapture', handleCancel);
			draggedProjectId = null;
			dragTargetIndex = null;
		};

		const handlePointerUp = () => {
			const sourceIndex = projects.findIndex((p) => p.id === draggedProjectId);
			if (
				draggedProjectId &&
				dragTargetIndex !== null &&
				dragTargetIndex !== sourceIndex &&
				dragTargetIndex !== sourceIndex + 1
			) {
				const finalIndex = dragTargetIndex > sourceIndex ? dragTargetIndex - 1 : dragTargetIndex;
				onMoveProject(draggedProjectId, finalIndex);
			}
			cleanup();
		};

		const handleCancel = () => cleanup();

		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', handlePointerUp);
		target.addEventListener('pointercancel', handleCancel);
		target.addEventListener('lostpointercapture', handleCancel);
	}

	function isProjectCollapsed(projectId: string) {
		return collapsedProjectIds.includes(projectId);
	}

	function toggleProjectCollapsed(projectId: string) {
		collapsedProjectIds = isProjectCollapsed(projectId)
			? collapsedProjectIds.filter((id) => id !== projectId)
			: [...collapsedProjectIds, projectId];
	}

	function moveProjectBy(projectId: string, delta: number) {
		const currentIndex = projects.findIndex((p) => p.id === projectId);
		if (currentIndex === -1) return;
		const targetIndex = Math.max(0, Math.min(projects.length - 1, currentIndex + delta));
		if (targetIndex !== currentIndex) onMoveProject(projectId, targetIndex);
	}

	function openMenu(
		event: MouseEvent | KeyboardEvent,
		partial: { id: string; kind: 'project' } | { id: string; kind: 'thread'; projectId: string }
	) {
		event.preventDefault();
		event.stopPropagation();
		const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
		const box = target?.getBoundingClientRect();
		activeMenu = {
			...partial,
			x: event instanceof MouseEvent && event.clientX > 0 ? event.clientX : (box?.right ?? 0),
			y: event instanceof MouseEvent && event.clientY > 0 ? event.clientY : (box?.bottom ?? 0)
		} as MenuState;
	}

	async function startRename(next: RenameState) {
		activeMenu = null;
		renameState = next;
		await tick();
		renameInput?.focus();
		renameInput?.select();
	}

	function saveRename() {
		if (!renameState) return;
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
			openMenu(
				event,
				target.kind === 'project'
					? { id: target.project.id, kind: 'project' }
					: { id: target.threadId, kind: 'thread', projectId: target.projectId }
			);
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
				{#if draggedProjectId && dragTargetIndex === index && draggedProjectId !== project.id}
					<div class="project-drop-indicator" aria-hidden="true"></div>
				{/if}
				<section
					class="project-section"
					class:project-section--collapsed={isProjectCollapsed(project.id)}
					class:project-section--dragging={draggedProjectId === project.id}
					data-selected={project.id === selectedProjectId ? 'true' : undefined}
					role="listitem"
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
										oninput={(e) =>
											(renameState = {
												id: project.id,
												kind: 'project',
												value: e.currentTarget.value
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
								oncontextmenu={(e) => openMenu(e, { id: project.id, kind: 'project' })}
								onkeydown={(e) => handleRowKeydown(e, { kind: 'project', project })}
							>
								<span
									class="project-section__caret"
									role="button"
									tabindex="-1"
									aria-label={`${isProjectCollapsed(project.id) ? 'Show' : 'Hide'} ${project.name} threads`}
									aria-expanded={!isProjectCollapsed(project.id)}
									onclick={(e) => {
										e.stopPropagation();
										toggleProjectCollapsed(project.id);
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.stopPropagation();
											e.preventDefault();
											toggleProjectCollapsed(project.id);
										}
									}}
								>
									{#if isProjectCollapsed(project.id)}
										<CaretRight size={16} />
									{:else}
										<CaretDown size={16} />
									{/if}
								</span>
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
							onclick={() => onCreateThread(project.id)}>+</button
						>
						<button
							aria-label={`Browse files in ${project.name}`}
							class="rail-action-button"
							title="Browse files"
							type="button"
							onclick={() => onOpenFileExplorer(project.id)}
						>
							<DocumentView size={16} />
						</button>
						<button
							aria-label={`Drag to reorder ${project.name}`}
							class="rail-action-button rail-drag-handle"
							title="Drag to reorder"
							type="button"
							onpointerdown={(e) => handlePointerDrag(e, project.id)}
						>
							<Draggable size={16} />
						</button>
						<button
							aria-label="Project actions"
							class="rail-action-button"
							type="button"
							onclick={(e) => openMenu(e, { id: project.id, kind: 'project' })}
						>
							<OverflowMenuHorizontal size={16} />
						</button>
					</div>

					{#if !isProjectCollapsed(project.id)}
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
													oninput={(e) =>
														(renameState = {
															id: thread.id,
															kind: 'thread',
															value: e.currentTarget.value
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
												oncontextmenu={(e) =>
													openMenu(e, { id: thread.id, kind: 'thread', projectId: project.id })}
												onkeydown={(e) =>
													handleRowKeydown(e, {
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
											onclick={(e) =>
												openMenu(e, { id: thread.id, kind: 'thread', projectId: project.id })}
										>
											<OverflowMenuHorizontal size={16} />
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
			{#if draggedProjectId && dragTargetIndex === projects.length}
				<div class="project-drop-indicator" aria-hidden="true"></div>
			{/if}
		{/if}
	</div>

	{#if activeMenu}
		<ProjectRailMenu
			menu={activeMenu}
			onClose={() => (activeMenu = null)}
			{onCreateThread}
			onMoveProject={moveProjectBy}
			{onOpenDiff}
			{onRefreshStatus}
			{onRemoveProject}
			{onRemoveThread}
			onRenameProject={(id, name) => startRename({ id, kind: 'project', value: name })}
			onRenameThread={(id, title) => startRename({ id, kind: 'thread', value: title })}
			{onStopThread}
			{projects}
		/>
	{/if}
</aside>
