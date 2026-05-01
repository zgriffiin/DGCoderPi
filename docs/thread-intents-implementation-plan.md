# Thread Intents Implementation Plan

## Scope

Implement the Phase 1 Thread Intents slice from [Agent Harness PRD](./agent-harness-prd.md).
This slice should make each thread's workflow purpose explicit, use that intent to shape
agent prompting, and improve the chat reading experience enough that intent-specific
answers are fast to scan.

## Constraints

- Keep durable thread state, migrations, and activity records Rust-owned.
- Keep Svelte focused on rendering state and collecting user choices.
- Do not add mocks, fake endpoints, shim services, or placeholder backend behavior.
- Validate visible behavior with Playwright against the real app runtime.
- Keep React out of the runtime and keep the UI Carbon-aligned.

## Phase 1: Thread State And Migration

1. Add a typed thread intent model:
   - `Understand`
   - `Review`
   - `Plan`
   - `Implement`
   - `Ship`
2. Persist `intent` on every thread record.
3. Migrate existing threads to `Understand`.
4. Preserve intent when selecting, renaming, and updating threads.
5. Include intent in frontend TypeScript workbench types.

## Phase 2: Intent UI

1. Show the active thread intent in the thread header.
2. Show a compact intent label in the left rail when it fits without crowding thread titles.
3. Add an intent switcher using a compact Carbon-style selector or segmented control.
4. Keep keyboard and screen-reader access for intent changes.
5. Avoid visible instructional copy in the workbench chrome.

## Phase 3: Activity History

1. Add a structured `intent_switch` activity record with:
   - `thread_id`
   - `previous_intent`
   - `new_intent`
   - `actor`
   - `timestamp`
   - optional `reason`
2. Render intent switches as concise activity entries.
3. Ensure repeated selection of the same intent does not create duplicate activity.

## Phase 4: Prompt And Runtime Framing

1. Use the thread intent when preparing prompt context.
2. Keep intent guidance small and direct so it does not bloat every request.
3. Define behavior for each intent:
   - `Understand`: explain subsystem, flow, files, assumptions, and gaps.
   - `Review`: findings first, then risks, regressions, and missing tests.
   - `Plan`: produce steps, dependencies, validation, and risks without changing code by default.
   - `Implement`: make scoped code changes and report validation.
   - `Ship`: validate, fix, commit, push, open or update PR, and resolve review feedback.
4. Add tests that verify prompt framing changes by intent.

## Phase 5: Response Latency

1. Measure time from `Start` click to first visible assistant content for the same prompt,
   model, and reasoning level.
2. Identify avoidable overhead in the app path before the model call starts.
3. Avoid repeated thread hydration, unnecessary diff analysis, or redundant state writes for
   simple non-ship prompts.
4. Add lightweight runtime logging or debug timing that can be inspected during Playwright runs.
5. Treat a 15 second gap versus the direct API path as a regression target to explain or reduce.

## Phase 6: Assistant Message Formatting

1. Improve assistant markdown rendering so ordinary prose is comfortable to read in the
   desktop workbench.
2. Fix spacing and hierarchy for:
   - paragraphs
   - numbered lists
   - bullet lists
   - headings
   - inline code
   - code blocks
3. Stop rendering all markdown elements at the same tiny size.
4. Ensure long responses use readable measure, line height, and vertical rhythm without
   becoming a loose marketing-style layout.
5. Keep user messages compact, but let assistant responses breathe more than operational
   rail text.
6. Add Playwright coverage using a real assistant message that contains paragraphs,
   numbered lists, inline code, and headings.
7. Validate the result visually in both dark and light themes.

## Phase 7: Playwright Coverage

1. Create a thread and verify it defaults to `Understand`.
2. Change intent and verify the header, left rail, and activity entry update.
3. Send or prepare prompts under at least `Plan` and `Review` intents and verify the
   prompt path receives the correct framing.
4. Verify `Plan` intent does not immediately execute code changes unless the user explicitly
   asks for execution.
5. Verify assistant markdown formatting does not collapse lists into cramped, hard-to-read text.

## Phase 8: Quality Gate

1. Run formatter, lint, type checks, and the commit fallow gate.
2. Run frontend tests and Playwright workflow tests.
3. Run Rust formatting, clippy, and tests when Rust state or command code changes.
4. Run `fallow audit`.
5. Run local CodeRabbit CLI review and resolve every finding before push.

## V1 Deferrals

- Full clone-thread support.
- Compact-thread support.
- Export and retry operations.
- Sandbox-aware intent behavior.
- Rich prompt templates beyond the minimal intent framing needed for this slice.
