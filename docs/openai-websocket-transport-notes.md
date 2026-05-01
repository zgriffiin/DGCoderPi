# OpenAI WebSocket Transport Notes

Verified against public OpenAI docs on 2026-05-01.

## Summary

OpenAI WebSocket mode is relevant for future direct-provider agent orchestration, but it is not a drop-in optimization for the current Pi sidecar architecture.

The current app delegates provider calls and agent-loop behavior to Pi through the local Node bridge. The app receives streamed thread updates from Pi, but it does not directly control the OpenAI Responses API request loop. Because of that, DGCoder cannot directly benefit from OpenAI's connection-local Responses WebSocket cache unless:

- Pi uses OpenAI Responses WebSocket mode internally, or
- DGCoder adds a separate direct OpenAI Responses backend for some workflows.

## What WebSocket Mode Optimizes

OpenAI's Responses WebSocket mode keeps a persistent socket open and can reuse connection-local in-memory state when a follow-up `response.create` passes `previous_response_id`.

That can reduce overhead in agentic workflows because OpenAI can avoid rebuilding as much prior response state from scratch. The cached state can include prior response objects, prior input and output items, tool definitions, namespaces, and reusable tokenization/rendering artifacts.

This is especially relevant for coding agents because tool-heavy tasks often involve many repeated turns, tool calls, tool outputs, validations, and continuations.

## What It Does Not Eliminate

WebSocket mode is not context compression.

- The model still needs relevant context inside its context window.
- Long sessions still need compaction, retrieval, or summarization.
- Local durable history is still required for crash recovery, auditability, and UI state.
- If the socket or connection-local cache is lost, the caller needs a fallback such as full context replay, durable Conversations state, or a rebuilt compacted prompt.
- OpenAI conversation-state docs indicate that prior input tokens can still be billed when using `previous_response_id`.

Prompt caching remains relevant even with WebSockets. OpenAI prompt caching works automatically for prompts at or above 1024 tokens, and the best practice is still to keep stable repeated content at the beginning and dynamic content at the end.

## Fit For This App

The app already has a local streaming boundary:

- Tauri starts the Node Pi bridge.
- The bridge owns Pi sessions.
- Rust receives incremental thread updates and emits them to the Svelte UI.

That streaming improves UI responsiveness, but it is not the same optimization as OpenAI Responses WebSocket mode. The OpenAI optimization happens inside the provider request path, while the current app's streaming happens between Pi and the desktop UI.

## Kiro Support

Adding Kiro support does not make OpenAI WebSocket mode directly available.

Kiro is a separate agentic IDE/workflow system with its own orchestration model, steering files, specs, hooks, and provider/runtime decisions. If DGCoder integrates with Kiro, the transport benefits depend on what Kiro exposes:

- If Kiro owns the model loop, DGCoder should not assume control over OpenAI WebSockets.
- If Kiro exposes agent events, specs, hooks, or workspace context, DGCoder can integrate those surfaces without changing provider transport.
- If Kiro later exposes a direct provider transport setting or WebSocket-backed agent backend, DGCoder could evaluate it as a Kiro-specific adapter capability.

In other words, OpenAI WebSocket mode is useful when this app owns direct OpenAI Responses calls. Kiro support would more likely be an additional orchestration/provider adapter, not a reason to bypass Kiro's own runtime.

## Future Decision Point

Consider a direct OpenAI Responses WebSocket backend only if one of these becomes true:

- Pi exposes transport configuration and supports Responses WebSocket mode.
- DGCoder adds a direct OpenAI provider path for selected workflows.
- A workflow needs lower-latency, tool-heavy agent loops that Pi or Kiro cannot provide.
- The app can preserve recovery semantics with durable local history plus a robust full-context fallback.

Until then, the better near-term optimizations are:

- keep prompt prefixes stable,
- compact long sessions,
- keep context loading narrow,
- cache reconstructable local analysis,
- bound long-running local work,
- improve bridge job isolation and restart behavior.
