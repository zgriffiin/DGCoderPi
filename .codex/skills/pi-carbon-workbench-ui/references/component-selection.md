# Component Selection

Verified against upstream docs on 2026-04-26.

## Default Packages

- `carbon-components-svelte`
- `carbon-icons-svelte`
- `carbon-preprocess-svelte`

## Setup Rules

- Use `vitePreprocess()` before `optimizeImports()`.
- Use `optimizeImports()` to rewrite barrel imports to source paths for faster compiles.
- Use `optimizeCss()` in Vite production builds to strip unused Carbon styles.

## Theme Implementation

- Use `all.css` for client-side theme switching.
- Set `document.documentElement.setAttribute("theme", theme)` from a single theme store or controller.

## Fallback Ladder

Use the first option that is viable:

1. Native `carbon-components-svelte` component
2. Carbon-compliant custom Svelte composition using Carbon tokens and markup patterns
3. Wrapped Carbon Web Component
4. Adapted Carbon React behavior used only as a design reference, never as a runtime dependency

## Screen-To-Component Bias

- App shell and navigation: side nav patterns, structured lists, overflow menus, tags
- Conversation and activity: custom timeline with Carbon tags, skeletons, code snippets, accordions, and inline loading
- Composer: text area, buttons, selects or combo boxes, tooltips, inline notifications
- Right-rail inspectors: tabs, accordions, structured lists, progress bars, notifications

## Important Caveat

Carbon documents that Svelte support is community-maintained. Treat that as a normal engineering constraint:

- do not assume React-first examples map 1:1
- do not block the product waiting for perfect parity
- keep fallbacks visually and behaviorally Carbon-aligned

## Sources

- Carbon Svelte support page: https://carbondesignsystem.com/developing/community-frameworks/svelte/
- Carbon framework support notes: https://carbondesignsystem.com/developing/community-frameworks/other-frameworks/
- Carbon Svelte package README: https://github.com/carbon-design-system/carbon-components-svelte
