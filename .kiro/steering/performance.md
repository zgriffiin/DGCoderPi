---
inclusion: conditional
fileMatchPattern: 'src-tauri/**,sidecar/**,src/lib/workbench/**,docs/**'
---

# Performance Steering

Use this guidance when changing runtime transport, caching, indexing, diff review, prompt context, or agent workflow automation.

## Runtime Transport

- Keep Pi as the agent runtime boundary unless a task explicitly introduces a direct provider integration.
- Preserve incremental thread updates through the sidecar. Do not replace Pi session streaming with polling.
- Treat OpenAI WebSocket or Realtime APIs as direct-provider features, not as a drop-in replacement for Pi/Codex sessions.

## Caching

- Cache only reconstructable data.
- Key cached AI outputs by every behavior-affecting input, including diff fingerprint and model key.
- Invalidate or miss the cache when repository diff content, selected model, or review contract changes.
- Bound cache growth and prefer pruning old rows over adding manual cleanup requirements.

## Context Loading

- Keep agent context narrow and task-specific.
- Do not load project docs, skills, themes, extensions, or prompt templates into sidecar jobs that do not need them.
- Prefer compact structured payloads over full repository scans for diff review and analysis jobs.

## Hooks And Automation

- Do not add broad file-save hooks or all-repo automation.
- Use focused triggers and limited file patterns when a hook is genuinely needed.
- Prefer existing local gates (`pnpm lint:changed`, `pnpm commit:gate`, `pnpm push:gate`) over new background automation.
