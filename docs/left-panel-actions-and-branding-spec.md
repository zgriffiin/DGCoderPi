# Left Panel Actions And Branding Spec

## Summary

The left panel should stay focused on navigation: projects, branches, thread identity, thread status, and fast switching. Actions that are useful but not constantly needed should move into row-level overflow menus and right-click context menus.

This spec also defines a branding cleanup: stop using `Pi` in user-facing titles, body text, menu labels, status text, and proposed actions. Until a final product name is chosen, use neutral labels such as `the app`, `project`, `thread`, `agent`, or `workspace`. If a product title is required, use `DGCoder` as the interim visible name.

## Problem

The current left panel is useful for selecting projects and threads, but it does not expose the most practical thread operations. The visible actions are also too sparse and generic: users need to rename, organize, retry, archive, or remove things without hunting through unrelated browser or system menus.

At the same time, the left panel has limited width. Adding many visible buttons would make the rail noisy and reduce the space available for the content users scan most often: project name, branch, thread title, status, and recency.

## Goals

- Let users rename a thread directly from the left panel.
- Put common project and thread management actions where users expect them: an overflow icon and right-click menu.
- Keep the left panel compact and scan-friendly.
- Avoid permanent buttons for low-frequency actions.
- Remove `Pi` from visible product copy and menu labels.
- Use action labels that describe the object being changed, such as `Remove from project`, not branded labels.
- Preserve keyboard and screen-reader access for every menu action.

## Non-Goals

- Build a full source-control client in the left panel.
- Add staging, hunk editing, or commit controls to thread rows.
- Add large project cards or dashboard-style summaries.
- Add fake workflow states or placeholder menu items that do not map to real commands.
- Decide the final product brand name.

## Branding Requirements

### User-Facing Copy

Remove `Pi` from:

- app title and window title
- page metadata visible to users
- empty states
- composer labels and hints
- error messages
- activity messages
- settings labels
- project and thread menus
- docs that describe user-facing product behavior

Preferred replacements:

- `DGCoder` for the interim app title
- `the app` for general product references
- `the agent` for coding-agent behavior
- `workspace` for the current working area
- `project` for a repository entry
- `thread` for a conversation or task run

Examples:

- `DGCoder Pi` becomes `DGCoder`.
- `Ask Pi to inspect or change` becomes `Ask the agent to inspect or change`.
- `Prompt Pi` becomes `Prompt`.
- `Pi run failed` becomes `Run failed`.
- `Remove from Pi` becomes `Remove from project`.
- `Pi was asked to stop the current run` becomes `The current run was stopped`.

### Internal Names

Internal package names, Rust module names, dependency names, and third-party integration names do not need to change in this UI pass unless they are rendered to the user. Avoid broad internal renames until there is a final product name and migration plan.

## Left Panel Information Architecture

The left panel has two jobs:

1. Select and orient.
2. Expose contextual management actions without consuming constant screen space.

### Always Visible

Keep these visible:

- project name
- branch label
- thread count or compact activity count
- create-thread icon button
- thread status
- thread title
- selected thread state
- running or failed state

Do not permanently show action text buttons on every row.

### Visible On Hover Or Focus

Show a compact overflow icon button on project and thread rows when the row is hovered, focused, selected, or opened by keyboard navigation.

Use a standard icon-only button with an accessible label:

- project row: `Project actions`
- thread row: `Thread actions`

### Context Menu

Right-click on a project or thread row should open the same action set as the overflow menu.

Keyboard access:

- `Shift+F10` opens the context menu for the focused row.
- `F2` starts rename for the focused project or thread when rename is available.
- `Escape` cancels inline rename.
- `Enter` saves inline rename.

## Thread Actions

Thread actions should appear in this order:

1. `Rename`
2. `Continue`
3. `Retry last turn`
4. `Fork thread`
5. `Copy summary`
6. `Open diff`
7. `Change model`
8. `Archive`
9. `Delete`

### Action Rules

- `Rename` is always available for a selected or idle thread.
- `Continue` is available when the thread is idle, completed, or failed.
- `Retry last turn` is available only when the thread has at least one prior user turn and is not running.
- `Fork thread` creates an independent thread from the current thread state.
- `Copy summary` is available when a summary or assistant response exists.
- `Open diff` opens the diff inspector for the thread's project.
- `Change model` opens the existing model selector in the right place without adding a permanent control to the row.
- `Archive` hides the thread from the default list but keeps it recoverable.
- `Delete` requires confirmation and should be visually separated from non-destructive actions.
- If the thread is running, show `Stop run` near the top and disable actions that would mutate thread structure.

### Rename Behavior

Rename should support both inline editing and menu-triggered editing:

- Selecting `Rename` turns the thread title into an inline text field.
- The field uses the existing title as its value.
- Empty names are rejected.
- Leading and trailing whitespace is trimmed.
- Saving updates durable thread state.
- Canceling restores the prior title.
- A successful manual rename prevents automatic title derivation from later prompts unless the user clears the custom title.

## Project Actions

Project actions should appear in this order:

1. `Rename`
2. `New thread`
3. `Refresh status`
4. `Open in file explorer`
5. `Open in terminal`
6. `Open in editor`
7. `Project settings`
8. `Remove from project`

### Action Rules

- `Rename` changes only the display name unless a future command explicitly renames the folder.
- `New thread` duplicates the visible create-thread icon action.
- `Refresh status` reloads branch and diff status.
- `Open in file explorer`, `Open in terminal`, and `Open in editor` use real local commands and should fail gracefully if unavailable.
- `Project settings` opens project-specific settings when they exist; omit this item until there is a real settings surface.
- `Remove from project` removes the project from the app's project list without deleting files from disk.
- Any destructive or confusing action needs confirmation with clear object naming.

## Density And Layout Requirements

- Keep row height compact and stable.
- Avoid nested cards in the left panel.
- Avoid visible explanatory text inside the rail.
- Use truncation for long names, with full value available via native tooltip or accessible label.
- Do not add a permanent search box unless thread count makes it necessary; prefer a compact search icon that expands only when used.
- Do not add a permanent filter bar in v1; use a filter icon or command palette later if needed.
- Preserve enough title width that thread names remain the dominant visual element.
- Put secondary metadata in short tags or subdued text, not separate rows.

## Empty And Edge States

- No projects: show one compact empty state with an add-project action in the app header or existing project-add surface.
- Project has no threads: show a compact `No threads` row and keep the create-thread icon visible.
- Rename conflict: allow duplicate names, because thread identity is the id; duplicates can be disambiguated by recency and status.
- Command unavailable: hide the action if there is no real backend support, or show it disabled with a concise reason when discoverability matters.

## Architecture Requirements

### Rust

Rust should own durable mutations:

- rename project display name
- rename thread
- archive thread
- delete thread
- fork thread
- remove project from the project list
- open local paths through safe commands

Add focused commands rather than broad generic mutation commands.

### Svelte

The frontend should own presentation state:

- open or closed overflow menu
- context-menu position
- inline rename editing state
- keyboard focus management
- temporary menu disabled state

The frontend should not invent fake actions. A menu item should appear only when it has a real command path or is explicitly disabled because the current state blocks it.

## Validation

### Functional

- A user can rename a thread from the overflow menu.
- A user can rename a thread with `F2`.
- Right-click opens the same thread actions as the overflow menu.
- `Remove from project` removes only the project list entry and does not delete files.
- Destructive actions require confirmation.
- Running threads expose `Stop run` and disable incompatible actions.
- Archived threads leave the default visible list.

### Branding

- No visible app title, menu label, empty state, composer label, or activity message uses `Pi`.
- The interim visible app title is `DGCoder`.
- Proposed menu labels use object-focused language, such as `Remove from project`.

### UI

- The left panel remains compact at the current rail width.
- Overflow icons do not steal title space except on hover, focus, or selected rows.
- All actions are keyboard-accessible.
- Menus work in light and dark themes.

### Playwright

Add real-app Playwright coverage for:

- thread rename through overflow menu
- thread rename through keyboard shortcut
- project context menu opening
- remove-project confirmation
- branding text smoke check for visible `Pi` removal

Use the real app runtime and app-created project state. Do not intercept requests or use mocked services.

## Implementation Order

1. Add Rust commands and model fields for rename, archive, delete, fork, and remove-project actions that are in v1 scope.
2. Add controller methods for the new commands.
3. Add thread and project overflow menus with right-click parity.
4. Add inline rename state and keyboard handling.
5. Replace user-facing `Pi` strings with neutral or `DGCoder` copy.
6. Add confirmation flows for destructive actions.
7. Add Playwright coverage and run the local quality gates.

## V1 Recommendation

Implement this first:

- thread `Rename`
- thread `Retry last turn` if backend support already exists, otherwise omit
- thread `Open diff`
- thread `Stop run`
- project `Rename`
- project `New thread`
- project `Refresh status`
- project `Remove from project`
- visible branding cleanup from `Pi` to `DGCoder` or neutral copy

Defer this until the underlying workflow exists:

- `Archive`
- `Fork thread`
- `Copy summary`
- `Open in editor`
- persistent filters
- expanded search UI
