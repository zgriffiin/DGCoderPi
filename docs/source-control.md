# Source Control

This document is a placeholder for the DGCoder Pi source control design.

## Goals

- Present Git status without forcing the user into raw porcelain output.
- Support review-friendly diffs, staged vs unstaged visibility, and branch context.
- Make commit, branch, stash, and sync actions explicit and reversible.

## Initial Scope

- Workspace Git status summary
- File-level diff browser
- Staged and unstaged change grouping
- Commit flow with policy gates

## Related Specs

- [Diff Viewer Spec](./diff-viewer-spec.md)

## Open Questions

- How much source control belongs in the main workbench versus a dedicated panel?
- Which destructive Git actions should require explicit confirmation?
- How should queued agent edits and human edits be reconciled before commit?

## Definition of Done

- The workbench clearly distinguishes the main chat surface from any dedicated source control panel, and each state is intentionally editable or read-only.
- Destructive Git actions require confirmation, respect permission boundaries, and leave a clear recovery or undo path where possible.
- Agent edits and human edits reconcile through an explicit conflict workflow with clear merge precedence and required user review before commit.
- The source control flow ships with UX mocks, end-to-end coverage, and a review checklist that validates the final behavior before merge.
