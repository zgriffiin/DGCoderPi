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

## Open Questions

- How much source control belongs in the main workbench versus a dedicated panel?
- Which destructive Git actions should require explicit confirmation?
- How should queued agent edits and human edits be reconciled before commit?
