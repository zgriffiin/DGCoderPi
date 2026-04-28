# DGCoder Pi

Windows-first desktop coding workbench. Based on the simpllicity of the Pi interactions, but with a T3 Code like experience. I was 
struggling with performance issues with T3 code, even though the team did fantastic work there and appreciate Theo's group for 
everything they have helped me with my learning. I liked the simplicity of Pi, but wanted a regular UI experience for the same reasons
T3 code was made. This is very early and I don't plan on this being anything but windows, T3 code is a better solution for cross 
platform if you want a UI and Pi is better if you like the TUI interface. Built on the back of the amazing work of Mario and Theo and thier
teams/ contributers, this is just my take on that work.

## Stack

- Tauri 2 desktop shell
- SvelteKit SPA with Svelte 5 and strict TypeScript
- Carbon look and feel via `carbon-components-svelte`
- pnpm, ESLint, Prettier, Vitest, Playwright, and Storybook

## Local Setup

1. Install dependencies with `pnpm install`.
2. Install the Playwright browser with `pnpm setup:playwright`.
3. Install the Rust toolchain from `https://rustup.rs/`.
4. Install and authenticate CodeRabbit CLI. On Windows, the current CodeRabbit guidance recommends using WSL for the CLI.
5. Verify the desktop prerequisites with `pnpm tauri:info`.
6. Start the frontend shell with `pnpm dev`.
7. Start the desktop app with `pnpm tauri:dev` after Rust is installed.

## Quality Gates

- `pnpm check`
- `pnpm lint`
- `pnpm fallow:commit`
- `pnpm fallow:audit`
- `pnpm test:unit`
- `pnpm test:component`
- `pnpm test:e2e`
- `pnpm rust:check`
- `pnpm coderabbit:review`
- `pnpm build`
- `pnpm build-storybook`
- `pnpm commit:gate`
- `pnpm push:gate`

## Runtime And Test Policy

- No mocks, mocked modules, shims, fakes, stubs, dummy services, temporary adapters, or fake endpoints.
- Every user-visible feature must be exercised through the UI with Playwright against the real app runtime.
- Unit and browser-level tests are allowed as supporting checks, but they do not replace Playwright workflow coverage.
- If stable data is needed before the full backend is wired, use a committed example project or real local repo state instead of inventing service doubles.

## Review Workflow

- Commits are guarded by formatting, linting, type checks, and the local `fallow` gate through the Git `pre-commit` hook.
- Pushes are guarded by frontend tests, Rust checks, `fallow audit`, and local CodeRabbit CLI review through the Git `pre-push` hook.
- CodeRabbit CLI findings should be fixed locally before push. Pull request CodeRabbit findings should be fixed before merge.
- The repo CodeRabbit configuration reviews draft PRs and PRs targeting any base branch, not only the default branch.
- The repo CodeRabbit configuration uses request-changes workflow, so unresolved hosted findings are intended to remain blocking until fixed.
- On Windows, the current official CodeRabbit guidance recommends running the CLI from WSL.

## Current State

- The app shell, theme system, and first three-pane workbench are scaffolded.
- Storybook builds locally for component isolation.
- Desktop packaging is wired through Tauri, but local Tauri builds still require Rust, Cargo, and rustup to be installed on this machine.
