# Layout And Theming

Verified against upstream docs on 2026-04-26.

## Workbench Skeleton

Default to a three-zone desktop layout:

- Left: projects, threads, filters, and navigation
- Center: conversation timeline, streamed activity, diffs, and composer
- Right: tasks, files, plans, approvals, diagnostics, or contextual inspectors

The center pane is the product. The side panes support orientation and control.

## Theme Baseline

- Import `carbon-components-svelte/css/all.css`.
- Drive theming via the `theme` attribute on the root `html` element.
- Default light theme: `g10`
- Default dark theme: `g100`
- Persist an explicit user override, but allow a system-theme default path.

## Carbon Feel Without React

- Use Carbon spacing, type rhythm, iconography, surfaces, and states.
- Do not force IBM masthead chrome onto the product if it hurts usability.
- Favor subtle borders, restrained elevation, and strong information hierarchy over decorative cards.

## Default State Matrix

Every major surface should have explicit states for:

- Empty
- Loading
- Streaming or running
- Waiting for user input or approval
- Error
- Recovered or resynced
- Completed

Design those states up front so the UI does not collapse into spinners and fallback text later.
Back each state with a real runtime condition or a committed example project path through the app. Do not model states with mocked services or fake endpoints.

## Density Rules

- Optimize for desktop usage first; the app is a workbench, not a marketing site.
- Keep labels short and status visible.
- Truncate safely, but never hide critical branch, project, or thread identity.
- Use progressive disclosure for noisy tool output and logs.

## Interaction Rules

- Keyboard flow matters: navigation, composer focus, expand or collapse, retry, approve, and diff inspection should all be reachable without mouse-only affordances.
- Motion should clarify transitions, not decorate them.
- Streaming output should feel alive without causing layout thrash.

## Source Touchpoints

- Carbon overview: https://carbondesignsystem.com/all-about-carbon/what-is-carbon/
- Carbon Svelte support: https://carbondesignsystem.com/developing/community-frameworks/svelte/
- Carbon Svelte package README: https://github.com/carbon-design-system/carbon-components-svelte
