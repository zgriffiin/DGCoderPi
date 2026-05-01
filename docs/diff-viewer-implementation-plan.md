# Diff Viewer Implementation Plan

## Scope

Implement the guided diff viewer described in [Diff Viewer Spec](./diff-viewer-spec.md) in incremental slices. The first usable release should let a user open the diff inspector, see a plain-English AI review grounded in real hunks, switch to a traditional patch view, and jump from review items to exact patch hunks.

## Constraints

- Keep git, filesystem, fingerprinting, caching, and persistence in Rust.
- Keep the Svelte UI focused on rendering state and user actions.
- Do not add mocks, fake endpoints, shim services, or frontend-only sample data.
- Validate user-visible behavior with Playwright against the real app runtime.
- Keep React out of the runtime and use Carbon Svelte or Carbon-compliant Svelte components.

## Phase 1: Diff Payload Foundation

1. Extend Rust models for parsed diff payloads:
   - `ProjectDiffSnapshot`
   - `ProjectDiffFile`
   - `ProjectDiffHunk`
   - `ProjectDiffLine`
   - `ProjectDiffStats`
2. Replace file-list-only diff loading with real patch collection.
3. Parse unified diff metadata, hunk headers, line kinds, old line numbers, and new line numbers.
4. Add stable fingerprint computation over branch, status metadata, and normalized patch content.
5. Add Rust tests using a temporary real git repository.
6. Regenerate or update TypeScript IPC types if generated bindings exist; otherwise update shared TS types manually in the existing style.

## Phase 2: Patch View UI

1. Split the current diff rail into focused Svelte components:
   - `DiffInspector`
   - `DiffModeToggle`
   - `PatchView`
   - `DiffFileList`
   - `DiffHunk`
2. Render unified hunks with stable monospace rows, line numbers, add/remove/context labels, and accessible colors.
3. Add collapsed file sections, viewed state, file stats, rename metadata, and binary/too-large states.
4. Add jump-to-hunk behavior by hunk id.
5. Preserve the current right-rail density and Carbon theme parity.
6. Add Playwright coverage for dirty-project patch rendering and mode toggling.

## Phase 3: Analysis Cache And Command Contract

1. Add Rust-owned analysis cache keyed by diff fingerprint and model key.
2. Add focused commands:
   - `load_diff_analysis`
   - `refresh_diff_analysis`
3. Define a typed `DiffAnalysis` result matching the spec JSON contract.
4. Store `pending`, `in_progress`, `complete`, and `failed` states without blocking patch view rendering.
5. Preserve the previous complete analysis while a refresh is running.
6. Add Rust tests for cache hit, cache miss, fingerprint invalidation, and failed-analysis state.

## Phase 4: AI Review Pipeline

1. Add a dedicated diff-analysis prompt builder that accepts parsed hunks and optional thread context.
2. Route analysis through the configured model provider path without adding it to the main chat transcript.
3. Enforce structured JSON output and validate it before caching.
4. Add chunking for large diffs by file and hunk group.
5. Add merge logic for chunked summaries with `partial` and `progress` updates.
6. Add a small committed diff-review eval set based on real repo changes or committed example repositories.

## Phase 5: AI Review UI

1. Render `Change Brief`, `Impact`, `Risk Review`, `Focus Queue`, and `Suggested Follow-Up`.
2. Show evidence links from AI review items to patch hunks.
3. Label risk level and confidence separately.
4. Add loading, partial, failed, retry, and clean-tree states.
5. Keep wording plain enough for technical non-coders while retaining exact file references.
6. Add Playwright coverage for AI review rendering, retry, and focus-item hunk jumping.

## Phase 6: Refresh And Agent-Turn Integration

1. Trigger diff reload when the inspector opens.
2. Trigger analysis refresh after a completed agent turn if the diff fingerprint changed.
3. Debounce filesystem or state updates so analysis does not run on transient events.
4. Reuse cached analysis when the fingerprint and model key are unchanged.
5. Add Playwright coverage for cached reuse and diff-change refresh with a real local repository.

## Phase 7: Quality Gate

1. Run formatter, lint, type checks, and the commit fallow gate.
2. Run frontend tests and Playwright workflow tests.
3. Run Rust formatting, clippy, and tests when Rust diff or cache code changes.
4. Run `fallow audit`.
5. Run local CodeRabbit CLI review and resolve every finding before push.

## V1 Deferrals

- Side-by-side patch layout in the narrow inspector.
- Persisted viewed-file state across app restarts.
- Inline per-file AI summaries inside patch view.
- Local code-index context beyond the patch and thread summary.
- Editing, staging, reverting, or accepting hunks from the diff viewer.

## Implementation Order

1. Backend parsed diff payload and fingerprint.
2. Patch view UI from real diff payloads.
3. Analysis cache commands with deterministic placeholder-free state handling.
4. Model-backed structured AI review.
5. AI review UI and hunk linking.
6. Agent-turn refresh integration.
7. Full UI validation and quality gates.
