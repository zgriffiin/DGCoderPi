# Diff Viewer Spec

## Summary

The Pi diff viewer should do more than show a raw patch.

It should support two review modes in the same inspector surface:

- `AI Review`: a fast, small-model summary of what changed, what it impacts, and what looks risky
- `Patch View`: a traditional file-and-hunk diff view for direct inspection

The goal is to help the user answer two different questions without leaving the app:

- "What changed, and why does it matter?"
- "Show me the exact lines."

## Problem

The current diff rail is only a file list. It tells the user that files changed, but not:

- what the change actually does
- which parts of the app or workflow are affected
- whether the change looks safe or fragile
- where the risky hunks are

A normal diff viewer alone is not enough for Pi because a large share of the product value is helping the user review agent changes quickly and confidently.

## Goals

- make diffs reviewable without forcing the user to read every patch line first
- preserve a traditional diff mode for users who want exact line-by-line inspection
- provide a fast first-pass review using a cheaper local-or-configured small GPT model
- highlight likely impact areas and review risk, not just summarize filenames
- keep the experience dense, desktop-first, and readable in the right-side inspector

## Non-Goals

- replace full PR review or CodeRabbit
- auto-approve or auto-merge code based on the small-model review
- generate a full architectural analysis for every diff
- require cloud indexing or a remote code mirror

## Primary User Stories

- As a user, I want a short explanation of what changed before I inspect raw hunks.
- As a user, I want to know which files or hunks are risky so I can focus my attention.
- As a user, I want to switch to a normal diff when I need exact line review.
- As a user, I want the AI review to be fast enough to use routinely while iterating.
- As a user, I want the analysis to stay grounded in the actual patch, not generic code-review fluff.

## Product Requirements

### 1. Dual Review Modes

The diff inspector must support a mode toggle with:

- `AI Review`
- `Patch View`

#### Requirements

- The toggle is visible at the top of the diff inspector.
- The selected mode persists per thread during the current app session.
- Switching modes does not require reloading the raw diff from git if the data is already present.
- The default mode should be `AI Review` when a diff exists.

#### UX Notes

- The toggle should feel like a compact segmented control.
- `AI Review` is the opinionated Pi mode.
- `Patch View` should feel closer to a standard code review pane, similar in spirit to the T3 Code diff experience: dense, file-first, hunk-oriented, low chrome.

### 2. AI Review Mode

`AI Review` turns the current diff into a structured explanation.

The analysis should be generated from the actual patch, not only filenames or git status.

#### Required Output Sections

The generated review should include:

1. `Change Summary`
   - plain-English explanation of the main change set
   - grouped by file or change cluster when helpful
2. `Impact`
   - what user-visible behavior, workflows, or subsystems are affected
   - call out whether changes are UI-only, runtime-only, cross-layer, or test-only
3. `Risk Review`
   - likely fragility, regressions, missing edge cases, migration concerns, or incomplete follow-through
4. `Files to Inspect`
   - the small set of files or hunks most worth human review

#### Hunk-Level Expectations

For code diffs, the model should be able to produce entries in this shape:

- "In `src/.../file.ts` lines `120-146`, this change moves session reuse into a helper. That impacts model-switch behavior and preserves thread history when the session is rebuilt."
- "In `src-tauri/...` lines `420-436`, this change clears stale model selection when configured providers disappear. That impacts prompt preflight and prevents invalid bridge sends."

The important contract is:

- identify the changed lines or hunk
- describe what changed
- describe what that change impacts
- optionally attach a risk note if the hunk looks fragile

#### Risk Labels

Each top-level risk item should carry a lightweight label:

- `Low`
- `Medium`
- `High`

Examples of high-risk patterns:

- cross-layer contract changes
- state recovery changes
- auth/model selection changes
- queueing or concurrency behavior
- file mutation or git workflow changes

#### Empty and Failure States

- If the diff is empty, show `Clean working tree`.
- If analysis is still generating, show a compact loading state with file count and changed line count if available.
- If analysis fails, keep the raw diff available and show a retry action.
- If the diff is too large for one pass, chunk it and show partial results progressively.

### 3. Patch View Mode

`Patch View` is the traditional review mode.

#### Requirements

- Show changed files in a navigable file list.
- Show per-file diff hunks with added and removed lines.
- Preserve diff metadata:
  - file path
  - change kind
  - renamed path if applicable
- Support collapsing or expanding files.
- Support jumping from an AI review item to the corresponding raw diff hunk.

#### UX Notes

- This mode should be denser and more code-first than `AI Review`.
- Avoid oversized cards or excessive padding.
- The file list and hunk list should feel closer to a code review tool than a chat transcript.

### 4. Diff Analysis Triggering

#### Requirements

- Analysis should start automatically when:
  - the user opens the diff inspector on a dirty project
  - the diff changes after a completed agent turn
- Analysis should not re-run on every keystroke or transient filesystem event.
- Re-run conditions should be based on a stable diff fingerprint.
- The user can manually refresh analysis.

#### Fingerprinting

Use a diff fingerprint based on:

- branch
- file paths
- file status codes
- patch content hash

If the fingerprint is unchanged, reuse the cached analysis.

### 5. Model Strategy

The first-pass review should use a smaller GPT-class model by default.

#### Model Principles

- fast enough to feel interactive
- cheap enough to run often
- good enough at patch summarization and lightweight review
- separate from the main thread model if needed

#### Initial Recommendation

- use a dedicated diff-analysis model setting
- default it to the smallest model that is still reliable at code diff summarization
- allow future override in settings, but do not expose too much tuning in v1

The user should not need to manually prompt the main coding agent just to understand a patch.

### 6. Prompt Contract For AI Review

The diff-analysis prompt should be structured and deterministic.

#### Input

- project name
- branch
- diff fingerprint
- changed files with patch hunks
- optional thread context:
  - thread intent
  - latest user request
  - latest assistant summary

#### Output Shape

Use a typed JSON contract internally, then render it into the inspector.

Suggested shape:

```json
{
	"status": "pending | in_progress | complete",
	"partial": false,
	"progress": 100,
	"continuationToken": "string | null",
	"summary": "string",
	"impact": [
		{
			"area": "string",
			"detail": "string"
		}
	],
	"risks": [
		{
			"level": "low | medium | high",
			"title": "string",
			"detail": "string",
			"files": ["string"]
		}
	],
	"highlights": [
		{
			"file": "string",
			"range": {
				"startLine": 120,
				"endLine": 146
			},
			"change": "string",
			"impact": "string",
			"risk": "string | null"
		}
	],
	"reviewTargets": [
		{
			"file": "string",
			"reason": "string"
		}
	]
}
```

This keeps the model output renderable, testable, and cacheable.

The `status`, `partial`, `progress`, and `continuationToken` fields allow the UI to render progressive results for large diffs while the review is still being assembled.

The `highlights[].range` field is intentionally structured instead of prose-only so the inspector can jump directly to a hunk without parsing freeform line descriptions.

### 7. Architecture

#### Rust Responsibilities

- own raw git diff collection
- compute diff fingerprints
- cache diff payloads and analysis results
- expose focused commands for:
  - `load_project_diff`
  - `load_diff_analysis`
  - `refresh_diff_analysis`

#### Frontend Responsibilities

- present the dual-mode inspector UI
- render cached and in-flight analysis states
- coordinate toggle state and jump-to-hunk behavior

#### LLM Boundary

- the raw diff should be sent to the analysis model through a focused review command path
- the result should come back as structured data, not markdown prose
- the main chat thread should not be polluted with internal diff-analysis prompts

### 8. Caching And Performance

#### Requirements

- cache analysis by diff fingerprint
- do not recompute if only inspector visibility changes
- support progressive analysis for large diffs
- avoid blocking the main chat surface while analysis runs

#### Large Diff Strategy

If the patch exceeds the model’s useful context window:

- chunk by file or hunk group
- summarize each chunk
- merge chunk summaries into one top-level review

### 9. Validation

#### Functional Validation

- opening a dirty project shows AI review by default
- switching to patch view is instant once diff data is loaded
- changing the diff invalidates the cached analysis and refreshes it
- clicking an AI highlight jumps to the corresponding raw patch section

#### Quality Validation

- the AI summary references real files and changed lines
- the impact section is specific to the patch, not generic filler
- the risk section calls out meaningful concerns when present
- analysis failures degrade cleanly back to patch view

#### Playwright Coverage

Add real-app Playwright coverage for:

- dirty project with diff visible
- AI review rendering
- toggle to patch view and back
- cached analysis reuse
- diff change causing refresh

## Open Questions

- Should diff analysis run automatically after every agent turn, or only when the diff inspector is opened?
- Should the AI review be thread-scoped, project-scoped, or both?
- Should users be able to copy the AI review into the thread as context for a follow-up request?
- Do we want per-file inline AI summaries in patch view, or only a top-level AI review in v1?
- Should the diff analyzer optionally use local code index context for better impact detection in large repositories?

## Definition of Done

- The diff inspector supports both `AI Review` and `Patch View`.
- `AI Review` produces a grounded structured summary from the actual patch.
- The review identifies impact and risk, not just filenames.
- `Patch View` is strong enough for traditional file-and-hunk inspection.
- The app caches analysis per diff fingerprint and refreshes when the diff changes.
- The feature ships with Playwright coverage and a review rubric for summary accuracy, impact accuracy, and risk usefulness.
