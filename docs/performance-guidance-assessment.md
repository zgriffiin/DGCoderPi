# Performance Guidance Assessment

Verified against public provider docs on 2026-05-01.

## Provider Guidance Checked

- OpenAI exposes streaming, WebSocket mode, prompt caching, compaction, and Codex-specific configuration guidance in current developer docs.
- OpenAI Realtime WebSocket/WebRTC is intended for direct low-latency realtime model sessions. The current app uses Pi/Codex through the local sidecar and already receives incremental session updates, so replacing the Pi bridge with Realtime WebSockets would bypass the agent runtime rather than optimize it.
- AWS Well-Architected caching guidance applies here: cache reconstructable data, define consistency and invalidation rules, and do not treat cache as durable source data.
- Kiro guidance emphasizes persistent steering files, relevant context loading, specific hooks, limited file patterns, and performance-conscious hook frequency.

## Current Alignment

- Agent transport is aligned with Pi: the Tauri app keeps a persistent Node sidecar and receives streamed thread-update events from the running session instead of polling full turns.
- Diff review uses a deterministic cache key based on diff fingerprint and model key. That matches the app's consistency boundary: changing the diff or selected analysis model invalidates reuse.
- Diff review analysis runs through a narrow sidecar session with context files, skills, themes, prompt templates, and extensions disabled. This follows the same principle as Kiro context optimization: load only the context needed for the task.
- Project guidance is already captured in `AGENTS.md` and project-local skills. Kiro supports root `AGENTS.md` as always-loaded steering, so this repo is aligned for Kiro consumption.

## Changes Made From This Assessment

- In-flight diff analysis jobs are now keyed by both fingerprint and model key. This prevents a run for one model from incorrectly suppressing a concurrent run for another model.
- The SQLite diff analysis cache now has a bounded retention policy and an index on `updated_at_ms`. The newest 256 analysis rows are retained; older rows are pruned because they are reconstructable from the repository diff and model settings.
- Added Kiro steering under `.kiro/steering/performance.md` so Kiro can load performance-specific repo guidance without relying only on always-loaded `AGENTS.md`.

## Deferred Items

- Prompt caching at the OpenAI API layer is not directly configurable from this app while Pi owns provider requests. The app should continue optimizing stable prompt prefixes and compact context, then expose provider-level controls only if Pi surfaces them.
- WebSocket mode should be considered only for a future direct OpenAI Responses/Realtime integration. It is not an optimization for the current Pi sidecar architecture.
- Kiro hooks were not added. The current repo policy requires real runtime validation and already has local gates; adding hooks without a specific trigger would risk slowing normal development.
