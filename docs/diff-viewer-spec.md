# Diff Viewer Spec

## Summary

The Pi diff viewer should be a guided change-understanding surface, not only a raw patch browser.

It should support two review modes in the same right-side inspector:

- `AI Review`: a fast, grounded change brief that explains what changed, why it matters, and where a person should look first.
- `Patch View`: a dense file-and-hunk diff view for exact inspection.

The primary audience is a technical user who may not be a daily coder. The interface should help them answer:

- "What changed in plain English?"
- "What could this affect?"
- "Where should I inspect the exact lines?"
- "Can I trust that the explanation came from the actual diff?"

## Validation Notes

The original direction is sound: dual modes, structured AI output, Rust-owned git state, cached analysis by fingerprint and model key, and Playwright validation all fit the Pi stack.

The spec needed these corrections:

- The current app only exposes a git status file list. The feature cannot support hunk jumps, line-specific AI highlights, or patch rendering until `ProjectDiffSnapshot` includes parsed patch hunks.
- `AI Review` should be designed as a comprehension-first review, not a generic code-review bot. The surface must translate changes for a non-coder technical user while keeping every claim tied to files and hunks.
- The model output contract needs evidence and confidence fields so the UI can distinguish grounded findings from lower-confidence guesses.
- The patch view needs standard review affordances from strong diff tools: file progress, viewed state, whitespace toggle, rename metadata, binary/generated-file handling, keyboard navigation, and side-by-side or unified display where space allows.
- Auto-analysis should be lazy and debounced. It should run when the inspector is opened or an agent turn completes with a stable changed-diff fingerprint, not on every filesystem event.

## Research Signals

Current standout diff and review tools point to these patterns:

- GitHub and GitLab make review progress visible with file-by-file review, changed-file navigation, inline comments, whitespace controls, and viewed-file state.
- GitLab Rapid Diffs emphasizes streaming and incremental rendering for large diffs.
- JetBrains and VS Code keep exact inspection close to a familiar editor model with unified and side-by-side views, keyboard navigation between changes, and local-file awareness.
- Reviewable stands out for explicit review state per file and revision, which is useful when re-reviewing incremental changes.
- AI review tools such as CodeRabbit focus on context-aware review, risk findings, missing tests, and inline targets. For Pi, this should be adapted into local, pre-commit, agent-change review rather than PR automation.
- T3 Code and newer AI-native editors show that agent users expect turn-by-turn change review inside the agent workspace, not only after a PR exists.

## Problem

The current diff rail is only a file list. It tells the user that files changed, but not:

- what the change actually does
- which workflows or subsystems are affected
- whether the change looks safe, fragile, or incomplete
- which hunks deserve attention first
- how to connect a plain-English explanation to exact patch lines

A normal diff viewer alone is not enough for Pi because the product value is helping users review agent changes quickly and confidently before they commit, continue, or ask for corrections.

## Goals

- Make diffs understandable without forcing the user to read every patch line first.
- Preserve a traditional diff mode for exact line-by-line inspection.
- Provide a fast first-pass review using a configured small model path.
- Highlight likely impact areas and review risk, not just summarize filenames.
- Keep the experience dense, desktop-first, and readable in the right-side inspector.
- Ground every AI claim in file paths, hunk ranges, and changed lines when possible.
- Help a technical non-coder decide what to inspect, what to ask the agent, and whether the change looks broadly reasonable.

## Non-Goals

- Replace full PR review, CodeRabbit, or team review policy.
- Auto-approve, auto-merge, commit, or discard changes based on AI review.
- Generate a full architectural analysis for every diff.
- Require cloud indexing or a remote code mirror.
- Add a fake backend, mocked service path, or frontend-only diff data source.
- Build a full source-control client in v1.

## Primary User Stories

- As a user, I want a plain-English explanation of what changed before I inspect raw hunks.
- As a user, I want to know which files or hunks are risky so I can focus my attention.
- As a user, I want to switch to a normal diff when I need exact line review.
- As a user, I want the review to stay grounded in actual changed lines.
- As a user, I want to know whether a finding is high-confidence or just worth checking.
- As a user, I want the analysis to be fast enough to use after each agent turn.

## Product Requirements

### 1. Dual Review Modes

The diff inspector must support a compact segmented control with:

- `AI Review`
- `Patch View`

#### Requirements

- The toggle is visible at the top of the diff inspector.
- The selected mode persists per thread during the current app session.
- Switching modes does not reload raw diff data if the payload is already present.
- The default mode is `AI Review` when a non-empty diff exists.
- If the analysis fails or is unavailable, the user can still open `Patch View`.

#### UX Notes

- The control should use Carbon-style compact segmented behavior.
- `AI Review` is the opinionated Pi mode.
- `Patch View` should feel dense, file-first, hunk-oriented, and low chrome.

### 2. AI Review Mode

`AI Review` turns the current patch into a structured change brief.

The analysis must be generated from actual patch hunks, not only filenames or git status.

#### Required Output Sections

1. `Change Brief`
   - Two to five plain-English bullets describing the main changes.
   - Avoid implementation jargon unless the file or framework makes it necessary.
   - Call out whether the change is UI-only, backend-only, test-only, docs-only, or cross-layer.
2. `Impact`
   - Workflows, features, data, settings, or runtime behavior likely affected.
   - Use concrete nouns from the app, files, or thread context.
3. `Risk Review`
   - Meaningful concerns such as regressions, missing edge cases, state recovery, migration risk, concurrency, auth/model selection, file mutation, or incomplete tests.
   - Each item includes a `Low`, `Medium`, or `High` label and a confidence value.
4. `Focus Queue`
   - The small set of files or hunks most worth human review.
   - Each item links directly to a hunk in `Patch View`.
5. `Suggested Follow-Up`
   - Optional concise questions or prompts the user could send to the agent.
   - Must be grounded in risks or missing validation, not generic advice.

#### Non-Coder Technical Design

The AI review should read like an expert explaining a change set to a product owner or technical lead:

- Use "What changed" and "What it affects" language.
- Prefer product behavior over code mechanics in top-level summaries.
- Keep code terms visible where they matter, but attach them to consequences.
- Show exact file and line references as evidence, not as the primary explanation.
- Make uncertainty explicit with confidence labels.
- Never imply the AI review is an approval decision.

#### Hunk-Level Expectations

For code diffs, the model should produce entries in this shape:

- In `src/.../file.ts` lines `120-146`, the change moves session reuse into a helper. That affects model-switch behavior and preserves thread history when the session is rebuilt.
- In `src-tauri/...` lines `420-436`, the change clears stale model selection when configured providers disappear. That affects prompt preflight and prevents invalid bridge sends.

The important contract is:

- identify the changed file and hunk range
- describe what changed
- describe what that change affects
- attach a risk note only when there is a concrete reason
- include evidence snippets or changed-line references within safe truncation limits

#### Risk Labels

Each top-level risk item must include:

- `level`: `low`, `medium`, or `high`
- `confidence`: `low`, `medium`, or `high`
- `evidence`: file paths and hunk ids or line ranges
- `whyItMatters`: user-facing consequence

Examples of high-risk patterns:

- cross-layer contract changes
- state recovery changes
- auth/model selection changes
- queueing or concurrency behavior
- file mutation or git workflow changes
- database migrations or persistence changes
- security, permissions, or path handling

#### Empty and Failure States

- If the diff is empty, show `Clean working tree`.
- If analysis is still generating, show a compact loading state with file count and changed line count if available.
- If analysis fails, keep `Patch View` available and show a retry action.
- If the diff is too large for one pass, chunk it and show partial sections progressively.
- If hunks are unavailable for a file, show file-level metadata and explain that exact patch lines are unavailable.

### 3. Patch View Mode

`Patch View` is the traditional review mode.

#### Requirements

- Show changed files in a navigable file list.
- Show per-file diff hunks with added, removed, and context lines.
- Preserve diff metadata:
  - file path
  - status code and readable change kind
  - renamed or copied source path
  - binary, generated, too-large, or deleted-file state
  - staged versus unstaged group when available
- Support unified view in v1.
- Leave side-by-side view as a v1.1 enhancement unless the right rail width supports it cleanly.
- Support collapsing or expanding files.
- Support marking files as viewed during the current session.
- Support hide/show whitespace-only changes when the backend can compute both views.
- Support jumping from an AI review item to the corresponding raw diff hunk.
- Support keyboard navigation between changed files and hunks.

#### UX Notes

- This mode should be denser and more code-first than `AI Review`.
- Avoid oversized cards or excessive padding.
- Use stable row heights and monospace patch text.
- Use accessible color plus symbols or labels for added and removed lines.
- Keep line numbers visible when available.
- Keep binary and huge-file states explicit instead of rendering broken patch blocks.

### 4. Diff Data Contract

The backend must return a parsed diff payload, not just status entries.

Suggested TypeScript-facing shape:

```json
{
	"branch": "main",
	"fingerprint": "sha256:...",
	"gitAvailable": true,
	"generatedAtMs": 1770000000000,
	"stats": {
		"filesChanged": 4,
		"additions": 120,
		"deletions": 36
	},
	"files": [
		{
			"id": "src/lib/example.ts",
			"path": "src/lib/example.ts",
			"originalPath": null,
			"status": "modified",
			"statusCode": "M",
			"isBinary": false,
			"isGenerated": false,
			"isTooLarge": false,
			"additions": 14,
			"deletions": 3,
			"hunks": [
				{
					"id": "src/lib/example.ts:12:24",
					"oldStart": 12,
					"oldLines": 7,
					"newStart": 12,
					"newLines": 12,
					"header": "@@ -12,7 +12,12 @@",
					"lines": [
						{
							"kind": "context",
							"oldLine": 12,
							"newLine": 12,
							"text": "function example() {"
						}
					]
				}
			]
		}
	]
}
```

#### Backend Notes

- Use Rust-owned git commands or a Rust git library behind a narrow service.
- Prefer `git diff --no-ext-diff --find-renames --find-copies` for patch payloads.
- Include untracked files as file entries, with patch hunks only when safe and text-readable.
- Keep file-size and patch-size limits explicit.
- Compute changed-line counts and file stats in Rust so loading states and headers do not depend on model output.

### 5. Diff Analysis Triggering

#### Requirements

- Analysis should start automatically when:
  - the user opens the diff inspector on a dirty project
  - a completed agent turn changes the diff fingerprint
- Analysis should not re-run on every keystroke or transient filesystem event.
- Re-run conditions should be based on a stable diff fingerprint.
- The user can manually refresh analysis.
- Refresh should preserve the previous complete analysis until newer analysis is ready or fails.

#### Fingerprinting

Use a diff fingerprint based on:

- project id
- branch
- staged or unstaged group
- file paths
- file status codes
- rename or copy metadata
- normalized patch content hash

If the fingerprint and model key are unchanged, reuse the cached analysis.

### 6. Model Strategy

The first-pass review should use a dedicated diff-analysis model path.

#### Model Principles

- fast enough to feel interactive
- cheap enough to run often
- reliable at patch summarization and lightweight review
- separate from the main thread model when needed
- configurable without exposing excessive tuning in v1

#### Initial Recommendation

- Add a dedicated diff-analysis model setting.
- Default to the smallest configured model that passes the repo's diff-review eval set.
- Fall back to the active thread model only when no dedicated model is configured and the user allows it.
- Do not block raw patch viewing on model availability.

The user should not need to manually prompt the main coding agent just to understand a patch.

### 7. Prompt Contract For AI Review

The diff-analysis prompt should be structured and deterministic.

#### Input

- project name
- branch
- diff fingerprint
- changed files with parsed patch hunks
- diff stats
- optional thread context:
  - thread intent
  - latest user request
  - latest assistant summary
  - latest completed agent turn id

#### Output Shape

Use a typed JSON contract internally, then render it into the inspector.

Suggested shape:

```json
{
	"status": "pending | in_progress | complete | failed",
	"partial": false,
	"progress": 100,
	"continuationToken": null,
	"modelKey": "string",
	"fingerprint": "sha256:...",
	"changeBrief": [
		{
			"title": "string",
			"detail": "string",
			"evidence": [
				{
					"file": "string",
					"hunkId": "string",
					"startLine": 120,
					"endLine": 146
				}
			]
		}
	],
	"impact": [
		{
			"area": "string",
			"detail": "string",
			"evidence": ["string"]
		}
	],
	"risks": [
		{
			"level": "low | medium | high",
			"confidence": "low | medium | high",
			"title": "string",
			"detail": "string",
			"whyItMatters": "string",
			"evidence": [
				{
					"file": "string",
					"hunkId": "string",
					"startLine": 120,
					"endLine": 146
				}
			]
		}
	],
	"focusQueue": [
		{
			"file": "string",
			"hunkId": "string",
			"reason": "string",
			"priority": "low | medium | high"
		}
	],
	"suggestedFollowUps": [
		{
			"prompt": "string",
			"reason": "string"
		}
	]
}
```

This keeps model output renderable, testable, cacheable, and connected to raw hunks.

### 8. Architecture

#### Rust Responsibilities

- Own raw git diff collection.
- Parse patch hunks and line metadata.
- Compute diff fingerprints.
- Cache diff payloads and analysis results.
- Store analysis cache in Rust-owned persistence.
- Expose focused commands for:
  - `load_project_diff`
  - `load_diff_analysis`
  - `refresh_diff_analysis`
  - `set_diff_file_viewed`

#### Frontend Responsibilities

- Present the dual-mode inspector UI.
- Render cached and in-flight analysis states.
- Coordinate toggle state and hunk navigation.
- Keep per-thread view mode in session state.
- Keep file viewed state in session state unless Rust persistence is added for it.

#### LLM Boundary

- Send raw diff hunks to the analysis model through a focused review command path.
- Return structured data, not markdown prose.
- Keep internal diff-analysis prompts out of the main chat transcript.
- Redact or omit oversized/binary content before model calls.

### 9. Caching And Performance

#### Requirements

- Cache analysis by diff fingerprint.
- Do not recompute if only inspector visibility changes.
- Support progressive analysis for large diffs.
- Avoid blocking the main chat surface while analysis runs.
- Render the patch view before AI analysis completes.
- Keep large files collapsed by default.

#### Large Diff Strategy

If the patch exceeds the model's useful context window:

- chunk by file or hunk group
- prioritize high-risk file types and cross-layer changes first
- summarize each chunk
- merge chunk summaries into one top-level review
- mark partial analysis as partial until all chunks are merged

### 10. Validation

#### Functional Validation

- Opening a dirty project shows `AI Review` by default.
- Switching to `Patch View` is instant once diff data is loaded.
- Changing the diff invalidates cached analysis and refreshes it.
- Clicking an AI focus item jumps to the corresponding raw patch section.
- Hiding whitespace changes updates the patch payload and fingerprint.
- Marking a file viewed changes local review progress without changing git state.

#### Quality Validation

- The AI summary references real files and changed lines.
- The impact section is specific to the patch, not generic filler.
- The risk section calls out meaningful concerns when present.
- Low-confidence concerns are labeled as such.
- Analysis failures degrade cleanly back to `Patch View`.

#### Playwright Coverage

Add real-app Playwright coverage for:

- dirty project with diff visible
- AI review rendering from a real local repository diff
- toggle to `Patch View` and back
- AI focus item jumping to a patch hunk
- cached analysis reuse
- diff change causing refresh
- analysis failure preserving patch view access

Use a throwaway git repository or committed example project state. Do not intercept app requests or add mocked services.

## Open Questions

- Should diff analysis run automatically after every agent turn, or only when the diff inspector is opened?
- Should AI review cache be thread-scoped, project-scoped, or both?
- Should users be able to copy the AI review into the thread as context for a follow-up request?
- Do we want per-file inline AI summaries in patch view, or only the top-level AI review in v1?
- Should the diff analyzer optionally use local code index context for better impact detection in large repositories?
- Should file viewed state persist across app restarts, or stay session-only in v1?
- Should staged and unstaged changes be separate tabs, groups, or badges?

## Definition of Done

- The diff inspector supports both `AI Review` and `Patch View`.
- `load_project_diff` returns parsed patch hunks, line metadata, stats, and a stable fingerprint.
- `AI Review` produces a grounded structured summary from the actual patch.
- The review identifies impact and risk, not just filenames.
- `Patch View` is strong enough for traditional file-and-hunk inspection.
- The app caches analysis per diff fingerprint and model key, then refreshes when the diff or selected analysis model changes.
- The feature ships with Playwright coverage and a review rubric for summary accuracy, impact accuracy, risk usefulness, and evidence grounding.

## Sources

- GitHub pull request review docs: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request
- GitLab merge request changes docs: https://docs.gitlab.com/user/project/merge_requests/changes/
- GitLab Rapid Diffs docs: https://docs.gitlab.com/development/fe_guide/rapid_diffs/
- VS Code source control docs: https://code.visualstudio.com/docs/sourcecontrol/overview
- JetBrains diff viewer docs: https://www.jetbrains.com/help/idea/differences-viewer.html
- Reviewable file review docs: https://docs.reviewable.io/files
- CodeRabbit feature docs: https://docs.coderabbit.ai/about/features
- T3 Code overview: https://betterstack.com/community/guides/ai/t3-code/
- Diffs AI-native editor overview: https://diffs.io/
