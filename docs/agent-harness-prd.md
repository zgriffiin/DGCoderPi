# Agent Harness PRD

## Summary

This document defines the next product layer for DGCoder Pi beyond the first working version of the desktop chat shell.

The goal is to make Pi meaningfully better at:

- understanding an unfamiliar codebase
- reviewing code and finding real issues
- planning and implementing changes
- landing completed work safely

The main product additions are:

- thread intents
- thread operations
- sandbox workspaces
- local code indexing
- ship preview

## Problem

The current app can drive an agent through a thread, but it still relies too much on generic prompting and too little on explicit workflow support.

That creates several problems:

- users must repeatedly restate whether they want understanding, review, planning, or implementation
- threads are hard to reuse cleanly when the user wants to retry, fork, or compact context
- risky changes happen in the main worktree instead of an isolated execution lane
- larger repositories become hard for the agent to navigate efficiently
- the current `Ship` action is powerful, but it needs a clearer preview and safer state transitions

## Goals

- make common agent workflows explicit instead of prompt-only
- improve agent performance on larger repositories without sending source code to a remote indexing service
- reduce user effort for common high-value actions
- improve safety for refactors and feature work
- keep the architecture aligned with Tauri + Rust core ownership

## Non-Goals

- build a cloud indexing platform
- support remote multi-user collaboration in the first version
- replace Git or source control review with a fully autonomous merge bot
- optimize for benchmark behavior at the expense of reliability in real repositories

## Primary Users

- solo developers using Pi on local repositories
- engineers working in medium and large codebases who need better code navigation for agents
- users doing refactors, reviews, implementation, and safe merge flows

## User Stories

- As a user, I want to tell Pi whether I want understanding, review, planning, or implementation without re-explaining that intent in every prompt.
- As a user, I want to fork a thread from a useful point so I can compare two approaches.
- As a user, I want risky work to happen in a sandbox branch or worktree rather than in my main working copy.
- As a user, I want the agent to find the right files and code regions in a large repository without uploading the repo to a remote index.
- As a user, I want a preview of what the `Ship` flow will do before it starts committing, pushing, and opening a PR.

## Product Requirements

### 1. Thread Intents

#### Purpose

Make the agent mode explicit at the thread level so the UI, prompts, and validation behavior match the task.

#### Initial Intents

- `Understand`
- `Review`
- `Plan`
- `Implement`
- `Ship`

#### Functional Requirements

- A thread stores an `intent` field as part of thread state.
- The thread header and left rail should show the current intent.
- New threads default to `Understand` unless created from a workflow action.
- The composer and runtime should use the thread intent to select prompt scaffolding and expected output style.
- Each intent should influence the expected response structure:
  - `Understand`: explain subsystem, flow, files, assumptions, gaps
  - `Review`: findings first, risks, regressions, missing tests
  - `Plan`: steps, dependencies, validation, rollback notes
  - `Implement`: code changes plus validation
  - `Ship`: validation, fixups, commit, PR, merge workflow

#### UX Notes

- Intent selection should be lightweight, likely a small dropdown or segmented control in the thread header.
- Switching intent on an existing thread should be explicit and visible in activity history.

#### Acceptance Criteria

- The active thread intent is always visible.
- Intent switches append a timestamped `intent_switch` activity record containing `thread_id`, `previous_intent`, `new_intent`, `actor`, and optional `reason`.
- The activity history UI renders each intent switch as a discrete entry, and the thread header always shows the current active intent.
- The agent prompt framing changes based on intent.
- `Review` threads produce findings-first output by default.
- `Plan` threads do not immediately execute code changes unless the user switches intent or explicitly requests execution.

### 2. Thread Operations

#### Purpose

Give users direct lifecycle tools for conversation management instead of forcing everything into one linear thread.

#### Required Operations

- `Clone thread`
- `Retry turn`
- `Compact thread`
- `Export thread`

#### Functional Requirements

- `Clone thread` creates a new thread with copied context, messages, selected model, reasoning level, and intent, but a new thread id.
- `Clone thread` deep-copies staged attachments and generated artifacts into a new thread-scoped storage path with fresh attachment ids and rewritten local paths. The cloned thread must never share mutable attachment ids or storage paths with the source thread.
- `Retry turn` reruns the most recent user turn from the current thread state with the same intent and model settings.
- `Compact thread` replaces older transcript sections with a durable summary plus preserved key artifacts. Attachments referenced only by compacted sections must either remain in durable thread storage or move into a compacted-artifact archive; they must not be garbage-collected while the compacted thread still references them.
- `Export thread` writes a markdown or JSON transcript to disk. Exports that include attachments or generated artifacts must create an export bundle that copies those files alongside the transcript and rewrites references to relative bundle paths instead of leaving broken thread-local absolute paths behind.

#### UX Notes

- These actions belong in the thread header overflow menu.
- `Compact thread` must explain what is preserved and what is summarized.
- `Retry turn` should be disabled if the thread has no prior user turn.

#### Acceptance Criteria

- A cloned thread is independently editable.
- Compacting reduces prompt context size while retaining user-visible continuity.
- Attachments and generated artifacts referenced by compacted sections remain valid after compaction and export, either through preserved thread storage or an archived compacted-artifact bundle.
- Exported threads include timestamps, intent, model, and message content.

### 3. Sandbox Workspaces

#### Purpose

Run risky work in an isolated lane so the user can inspect agent changes before they affect the main worktree.

#### Functional Requirements

- A user can start a sandbox from a project or a specific thread.
- A sandbox creates:
  - a dedicated git worktree or equivalent isolated checkout
  - a dedicated branch name
  - a visible mapping back to the parent project and thread
- The thread state should show whether it is operating in:
  - main workspace
  - sandbox workspace
- `Ship` should understand whether it is landing from a sandbox branch.
- The user can discard or promote sandbox work explicitly.

#### Architecture Requirements

- Sandbox creation and lifecycle should be Rust-owned.
- The frontend should request sandbox actions through focused commands rather than managing git directly.
- File, git, and process boundaries stay in Rust services.

#### UX Notes

- Sandbox status should be highly visible in the thread header and project metadata.
- There should be no ambiguity about which branch or worktree the agent is editing.

#### Acceptance Criteria

- Starting a sandbox never mutates the parent worktree unexpectedly.
- The agent can run end-to-end in the sandbox path.
- Sandbox cleanup is explicit and reversible where possible.

#### Sandbox Promotion Workflow

- Promotion is a distinct workflow from sandbox creation and cleanup.
- Before promotion, the app must verify:
  - required local validations pass
  - the sandbox branch is in sync with the intended target branch or can be merged cleanly
  - there are no unresolved blocking review findings
- Promotion should attempt an automated three-way merge first.
- If the automated merge fails, the app must stop and hand the user an explicit conflict-resolution path, including a conflict editor or repo handoff instructions.
- Promotion should be atomic from the user's perspective: either the branch lands cleanly or the sandbox stays intact for retry.
- The app should record promotion attempts, validation results, merge outcomes, and any rollback action in structured activity history.
- Phase 2 delivers sandbox creation and cleanup. Phase 3 extends that work with the full promotion and compare UX, including conflict handling and rollback affordances.

### 4. Local Code Indexing

#### Purpose

Help the agent find relevant files, symbols, and code regions quickly in large repositories without sending source code to a remote indexing service.

#### Position

Yes, local indexing is feasible and should be the default design if this feature is built.

Remote indexing should not be the default product path because:

- repository code may be sensitive
- users may not want code shipped to a third-party workspace service
- local-first behavior fits this app's desktop architecture better

#### Product Principles

- indexing is local by default
- source code stays on the device unless the user explicitly exports something
- indexing is incremental and repository-scoped
- users can clear and rebuild indexes
- indexing should work without requiring a cloud account

#### Functional Requirements

- Users can enable indexing per project.
- The app stores index metadata locally under app data for that project.
- The index supports at least:
  - file search
  - symbol search
  - semantic or similarity search
  - "find related code"
  - "find likely implementation points"
- The agent can call search tools such as:
  - `search_files`
  - `search_symbols`
  - `search_code_chunks`
  - `search_related_to_selection`
- These indexed search tools supplement existing file open, read, and list operations rather than replacing them.
- Priority rules:
  - prefer indexed search results when an index is available and fresh
  - fall back to direct file or repo scanning when the index is absent, stale, or incomplete
  - use direct open or read operations after retrieval to inspect the authoritative file contents before editing or citing line-level details
- Workspace navigation should integrate both modes so agents can jump from indexed results into normal file-open and read flows without maintaining a separate navigation model.
- The user can see indexing state:
  - not indexed
  - indexing
  - ready
  - stale
  - failed

#### Recommended Architecture

Phase 1 should be hybrid local search, not embeddings-first.

Phase 1:

- filesystem crawl
- symbol extraction
- fast keyword and path search
- chunked code snippets
- ranking using path, symbol, recent edits, and lexical similarity

Phase 2:

- optional local embedding generation for semantic retrieval
- local vector store or equivalent local ANN index
- query-time fusion of lexical and semantic ranking

This is likely the right split because:

- hybrid local search gives immediate value on large repos
- it is simpler and cheaper than jumping straight to full semantic infrastructure
- it avoids adding fragile ML dependencies before the retrieval workflow is proven

#### Runtime Boundaries

- Index ownership should live in Rust services.
- The frontend should only request indexing status and search results.
- Durable index storage, merge logic, filesystem writes, git integration, lifecycle management, and query serving stay in Rust.
- A sidecar is allowed only for ephemeral, on-device embedding inference if a local model or existing JS inference library materially reduces implementation cost.
- Any sidecar use for indexing must be optional, non-durable, and disposable. It must not own index state, project metadata, or background indexing orchestration.
- Any local model used for embeddings should be optional and run on-device.

#### Data Model

At minimum, store:

- project id
- repository root
- commit or filesystem version markers
- indexed files
- chunk metadata
- symbol metadata
- language metadata
- timestamp of last successful index

#### Privacy and Safety Requirements

- No repo content is uploaded by default.
- Ignore rules must support:
  - `.gitignore`
  - explicit app exclusions
  - binary and generated paths
  - secrets and environment files
- Users can delete all local index data for a project.

#### Acceptance Criteria

- On a large repository, the agent can find likely files faster than a naive whole-repo scan.
- Indexing never requires remote upload.
- Search results include enough context for the agent to act on them.
- The index can be rebuilt without corrupting project state.

### 5. Ship Preview

#### Purpose

Make the merge workflow fast, but not opaque.

#### Functional Requirements

- `Ship` becomes a two-step flow:
  - `Ship Preview`
  - `Ship Now`
- Preview must show:
  - current branch
  - target branch
  - working tree cleanliness
  - validations to run
  - pending commit message
  - pending PR title and summary
  - sandbox status, with `N/A in Phase 1` until sandbox workspaces land in Phase 2
  - blocking review status if available
- The user can edit the proposed commit message and PR summary before execution.
- The app records the ship run as structured activity in the thread.

#### UX Notes

- Keep the current one-click feel for experienced users, but add the preview as the default visible intermediate state.
- If the branch is obviously blocked, the preview should explain why before execution begins.

#### Acceptance Criteria

- The user can see exactly what `Ship` intends to do, including an explicit `Sandbox status: N/A` state in Phase 1 before sandbox workspaces exist.
- The user can stop before commit or push.
- The agent does not merge while validations or blocking review findings remain unresolved.

## Phased Delivery

### Phase 1

- thread intents
- clone thread
- compact thread
- ship preview
  - sandbox status is explicitly `N/A` in this phase

### Phase 2

- sandbox workspaces
- export thread
- retry turn
- local hybrid indexing baseline

### Phase 3

- optional local semantic embeddings
- advanced retrieval and related-code recommendations
- sandbox promotion and comparison UX

## Design Constraints

- Keep the desktop shell in Tauri.
- Keep the frontend as a SvelteKit SPA.
- Keep durable state, git, filesystem, and process ownership in Rust.
- Do not introduce remote indexing as the default implementation.
- Do not add fake repositories or mock backend flows to prove the UX.

## Risks

- local indexing can become overbuilt if semantic retrieval is introduced too early
- sandbox workflows can confuse users if branch and worktree state are not obvious
- thread intent switching can produce surprising output if prompt contracts are vague
- ship preview can become too heavy if it feels like a second settings screen instead of a concise checkpoint

## Open Questions

- should intent be mutable after a thread starts, or should switching intent create a clone by default?
- should compacted threads preserve raw tool logs or only summaries plus exported artifacts?
- should local indexing be enabled automatically for small repositories or always opt-in?
- for local semantic retrieval, should the first implementation use a local embedding model or stop at hybrid lexical retrieval until demand proves the need?
- should `Ship` require sandbox mode for some classes of work, such as large refactors?

## Definition of Done

- the product team agrees on the workflow model for intents, thread operations, sandboxing, local indexing, and ship preview
- each area has enough detail to be split into requirements, design, and tasks
- the local indexing direction is explicitly local-first, privacy-preserving, and aligned with Rust-owned runtime boundaries
