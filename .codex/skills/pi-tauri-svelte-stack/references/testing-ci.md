# Testing And CI

Verified against upstream docs on 2026-04-26.

## Quality Gate Shape

Use a layered quality gate so failures are localized:

- Type and compile checks for Svelte and TypeScript
- Local `fallow` checks for dead code, duplication, and complexity
- Local CodeRabbit CLI review before push
- Rust formatting, linting, and tests
- Browser-facing component tests
- End-to-end desktop workflow tests
- Packaging smoke tests on Windows

## Recommended JS Tooling

- Use the Svelte CLI add-ons for `eslint`, `prettier`, `vitest`, `playwright`, and optionally `storybook`.
- Use `svelte-check` and `tsc --noEmit` as non-negotiable CI gates.
- Use ESLint rules to enforce the repo constraints in TS and Svelte: `max-lines`, `max-lines-per-function`, and `complexity`.

## Recommended Test Layers

- Unit and logic tests: Vitest in Node mode
- Browser component tests: Vitest Browser Mode with the Playwright provider
- End-to-end workflow tests: Playwright against the running Tauri app or a stable dev harness
- Rust tests: `cargo test --all-features`

Vitest recommends Playwright over the preview provider for CI and local realism because Playwright supports parallel execution and real browser behavior.

## Runtime Fidelity Rules

- Every user-visible feature needs Playwright coverage through the UI against the real app runtime.
- Unit and browser-level tests can add signal, but they do not replace Playwright workflow coverage.
- Do not use mocked modules, fake endpoints, shim backends, intercepted requests, or alternate in-memory services to make tests pass.
- If a feature needs repeatable data, use a committed example project, a throwaway git repo created during the test, or app-created state in the real database.

## Suggested Script Set

Keep script names boring and stable:

- `pnpm lint` for the full-repo baseline gate
- `pnpm lint:changed` as an optional local patch-scope fallback when full-repo Prettier drift is already known
- `pnpm format`
- `pnpm check`
- `pnpm fallow:commit`
- `pnpm fallow:audit`
- `pnpm coderabbit:review`
- `pnpm commit:gate`
- `pnpm push:gate`
- `pnpm test`
- `pnpm test:browser`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm tauri build`

On the Rust side:

- `cargo fmt --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test --all-features`

## CI Lanes

Start with these lanes:

1. `lint-and-check`
   - `pnpm install --frozen-lockfile`
   - `pnpm check`
   - `pnpm lint`
   - `cargo fmt --check`
   - `cargo clippy --all-targets --all-features -- -D warnings`

`pnpm lint:changed` is a local patch-scope fallback, not a required CI lane. Only promote it into CI if the workflow explicitly computes and validates the intended diff scope.

2. `test`
   - `pnpm test`
   - `cargo test --all-features`

3. `package-smoke`
   - Windows runner
   - `pnpm build`
   - `pnpm tauri build`

Add release-signing and notarization lanes later, not in the first scaffold.

## Review Expectations

- Every feature should prove its owning layer works.
- Cross-layer changes should touch at least one integration or workflow test.
- Any packaging-sensitive change should pass the Windows packaging smoke lane before merge.
- Local pushes should be blocked until CodeRabbit CLI findings are resolved.
- Pull requests should keep CodeRabbit auto review enabled for drafts and all base branches, and resolve incremental findings before merge.
- Hosted CodeRabbit request-changes feedback should be treated as blocking until resolved.

## Sources

- Svelte packages and official add-ons: https://svelte.dev/packages
- Vitest Browser Mode: https://vitest.dev/guide/browser/
- Playwright testing docs: https://playwright.dev/docs/running-tests
- Tauri distribution docs: https://v2.tauri.app/distribute/
