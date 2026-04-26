---
name: pi-carbon-workbench-ui
description: Design and implement the Pi desktop UI in Svelte with a Carbon look and feel, light and dark themes, dense desktop layouts, and accessible interactions. Use when building screens, navigation, theming, side panels, chat surfaces, component selections, or when adapting Carbon guidance without introducing React into the runtime.
---

# Pi Carbon Workbench Ui

## Overview

Use this skill when the task is mostly about how the app should look, feel, or behave in the desktop shell. It keeps the UI aligned with Carbon patterns while staying Svelte-native and suited to a multi-pane coding workspace.

## Quick Start

- Read `references/layout-and-theming.md` before designing a new screen or major interaction surface.
- Read `references/component-selection.md` when choosing Carbon controls or deciding how to handle a missing Svelte component.

## UI Rules

- Keep React out of the shipped app. Use `carbon-components-svelte` first, then Carbon-compliant wrappers or custom components if a gap appears.
- Treat Carbon as the visual system, not as a mandate to copy IBM product chrome verbatim. Use its tokens, spacing, motion, typography, states, and control behavior to build a product-specific workbench.
- Support light and dark mode from the start. The default pair for this app is `g10` for light and `g100` for dark unless a screen has a specific reason to differ.
- Build for dense desktop use: high information density, clear hierarchy, strong empty and loading states, and fast keyboard navigation.
- Preserve a three-zone mental model wherever it fits the feature: project or thread navigation on the left, main activity in the center, and contextual details on the right.
- Do not invent frontend-only service data, placeholder backends, or fake workflow states. UI behavior should map to real runtime states or a committed example project exercised through the app.

## Screen Workflow

1. Place the feature into the left, center, or right workbench zones before choosing controls.
2. Choose the Carbon component set or pattern that matches the surface. Prefer standard controls over custom ones.
3. Model the full state matrix: empty, loading, streaming, waiting for approval, failed, recovered, and completed.
4. Check theme parity, keyboard flow, focus management, and truncation behavior before considering the UI done.
5. If the Svelte Carbon port lacks the needed component, follow the fallback ladder in `references/component-selection.md`.

## Interaction Notes

- Avoid generic dashboard filler. The app should feel like a deliberate coding workspace, not a web admin panel.
- Prefer concise motion that clarifies transitions, not decorative micro-animation.
- Keep chat, plans, tasks, diffs, and approvals visually related but clearly separated.
- When a screen needs pixel-perfect Carbon parity and the Svelte library is insufficient, adapt the Carbon pattern instead of importing React.

## References

- `references/layout-and-theming.md`: screen skeletons, state patterns, and theme rules
- `references/component-selection.md`: Carbon package choices, preprocessors, and fallback ladder
