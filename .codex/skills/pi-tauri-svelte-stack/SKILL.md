---
name: pi-tauri-svelte-stack
description: Build and evolve the Pi desktop app using Tauri 2, SvelteKit SPA, a Rust core, Carbon styling, pnpm, and strict TypeScript. Use when scaffolding the app, planning or implementing features, choosing frontend/backend boundaries, setting up persistence or process orchestration, packaging releases, configuring CI, or making Rust/Tauri architecture decisions for this repo.
---

# Pi Tauri Svelte Stack

## Overview

Use this skill as the default implementation lane for the application. It captures the chosen stack, the runtime boundaries, and the repo-wide engineering rules so agents do not reinvent the architecture on each task.

## Quick Start

- Read `references/stack.md` for the current stack baseline and runtime boundaries.
- Read `references/testing-ci.md` when changing tooling, scripts, tests, or CI.

## Default Rules

- Keep the desktop shell in Tauri and the application core in Rust. Do not turn the frontend into the primary authority for persistence, process supervision, or git state.
- Use SvelteKit in SPA mode for the UI. Do not introduce SSR or a browser-server architecture into the desktop runtime.
- Keep React out of the runtime. Carbon React docs are reference material only.
- Prefer typed IPC contracts between Rust and TypeScript. Do not hand-maintain large JSON payload contracts if generated bindings are available.
- Treat a Node sidecar as an integration escape hatch for Pi reuse, not as the default backend. Use it only when reusing existing JS or TS logic is materially cheaper than porting to Rust.
- Do not add mocks, shims, fakes, stubs, placeholder backends, or fake endpoints. If stable data is needed before the full backend exists, use a committed example project or real local repository state instead.
- Treat local `fallow` and CodeRabbit review as required quality gates, not optional cleanup tools.
- Treat hosted CodeRabbit PR review as blocking on drafts and non-default base branches too. Do not assume review only happens on `main`.
- Honor the repo constraints in all languages: no file over 500 LOC, no function over 100 LOC, and keep control flow simple enough to stay below the requested complexity ceiling.

## Feature Workflow

1. Place the change in the right layer first: Svelte UI, shared TS contract, Rust core, or optional sidecar.
2. Check whether the feature changes packaging, persistence, process permissions, or window lifecycle before writing code.
3. Keep the UI thin: collect input, display state, and delegate durable logic to Rust commands or services.
4. Add or update Playwright UI coverage for every user-visible behavior, then add lower-level tests only where they provide extra signal.
5. Clear the local quality gates before considering the work ready: formatter, lint, type checks, `fallow`, Rust checks when touched, and CodeRabbit before push.
6. Verify that the change still fits the chosen release path for Windows packaging and later cross-platform distribution.

## Implementation Notes

- Prefer append-only event capture plus derived views for long-running thread state, approvals, activities, and recovery surfaces.
- Keep filesystem, git, process, and SQLite access behind Rust-owned services. Surface focused commands to the UI rather than exposing broad shell-like power everywhere.
- Default to Windows-first behavior, but avoid choices that block later macOS or Linux packaging unless the product explicitly stays Windows-only.
- When you need deeper stack guidance, load the relevant reference instead of expanding this file.

## References

- `references/stack.md`: stack baseline, boundaries, persistence, packaging, and release notes
- `references/testing-ci.md`: quality gates, scripts, test layers, and CI lanes
