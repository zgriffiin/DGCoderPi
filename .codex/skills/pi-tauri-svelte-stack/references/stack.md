# Stack Baseline

Verified against upstream docs on 2026-04-26.

## Default Stack

- Desktop shell: Tauri 2
- Frontend: SvelteKit in SPA mode
- UI system: Carbon look and feel with `carbon-components-svelte`
- Core backend: Rust
- Shared language: TypeScript with strict settings
- Package manager: `pnpm`
- Persistence: SQLite owned by the Rust core
- Optional integration escape hatch: packaged Node sidecar for Pi-specific JS or TS reuse

## Why This Stack

- Tauri recommends Vite for SPA frameworks such as Svelte and does not natively support SSR-style runtime architectures. For SvelteKit specifically, Tauri's guide recommends `adapter-static`, `frontendDist: ../build`, and `ssr = false`.
- Tauri keeps binaries small by using the system webview instead of bundling a browser engine.
- Carbon's Svelte implementation exists and supports dynamic theming, but Carbon documents that the Svelte library is community-maintained.
- `carbon-components-svelte` supports dynamic theming with `all.css` and a `theme` attribute on the `html` element, plus import and CSS optimization helpers through `carbon-preprocess-svelte`.

## Runtime Boundaries

- Put durable logic in Rust: process supervision, filesystem access, git operations, SQLite, app lifecycle, and recovery state.
- Keep the Svelte layer focused on rendering, collecting user input, and displaying incremental state.
- Prefer typed Tauri command contracts rather than ad hoc JSON payloads. `tauri-specta` is the default candidate for generated Rust-to-TypeScript bindings.
- Use a Node sidecar only when reusing Pi-specific JS or TS logic is clearly cheaper than porting to Rust. If used, package it as a sidecar binary and keep the interface narrow.
- Do not introduce mocked services, fake endpoints, shim backends, or parallel in-memory runtime paths. If the UI needs stable data before the full backend exists, source it from a committed example project or real local repository state.

## Persistence And Recovery

- Default to an append-only event log plus derived read models for projects, threads, messages, activities, approvals, diffs, and checkpoints.
- Keep the database schema owned by Rust. The frontend should not be the authority on migrations or transaction boundaries.
- The official Tauri SQL plugin exists and supports SQLite, but for this app the preferred architecture is a Rust-owned persistence layer. Use the plugin's JS bindings only if a feature genuinely needs direct guest-side SQL access.

## Frontend Rules

- Use SvelteKit SPA mode, not SSR.
- Keep React out of the runtime. Carbon React docs are reference material only.
- Use Carbon tokens, spacing, and components, but shape the shell around the product's workbench rather than mirroring IBM product chrome.
- Support light and dark themes from the first scaffold.
- Validate user-visible behavior through the actual UI and runtime, not through intercepted requests or invented frontend-only service doubles.

## Packaging And Distribution

- `tauri build` bundles the app by default for the configured formats.
- Windows distribution options are `.msi` via WiX and NSIS-based setup executables.
- Plan for code signing once the app is shared outside local development.
- Treat Windows as the first packaging target, but avoid architecture choices that would block later macOS or Linux distribution.

## Initial Implementation Bias

- Start with one desktop window and one primary workbench layout.
- Use Rust services for stateful or privileged work instead of overloading the UI layer.
- Add a Node sidecar only after the pure Rust path becomes materially slower to deliver.

## Sources

- Tauri frontend configuration: https://v2.tauri.app/start/frontend/
- Tauri + SvelteKit guidance: https://v2.tauri.app/start/frontend/sveltekit/
- Tauri overview: https://v2.tauri.app/start/
- Tauri distribution docs: https://v2.tauri.app/distribute/
- Tauri Windows installer docs: https://v2.tauri.app/distribute/windows-installer/
- Tauri Node sidecar guide: https://v2.tauri.app/learn/sidecar-nodejs/
- Tauri SQL plugin: https://v2.tauri.app/plugin/sql/
- Carbon Svelte support: https://carbondesignsystem.com/developing/community-frameworks/svelte/
- Carbon Svelte package README: https://github.com/carbon-design-system/carbon-components-svelte
