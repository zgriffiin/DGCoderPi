# Project Prompt Patterns

Use these as the default prompt shapes for this repo.

## Core Blocks

Every serious prompt should declare:

- `<task>`: what to produce
- `<context>`: product area, relevant docs, or code paths
- `<constraints>`: stack, runtime, UI, and code-shape limits
- `<deliverables>`: the exact artifact to return
- `<validation>`: what must be checked before claiming completion
- `<stop_conditions>`: when to ask, stop, or defer

XML-style blocks work well across providers and make large prompts easier to edit.

## Required Repo Constraints

Include these unless the task is intentionally narrower:

- Tauri 2 desktop shell
- SvelteKit SPA frontend
- Rust core backend
- Carbon look and feel
- No React runtime
- Light and dark theme support
- No mocks, shims, fakes, stubs, placeholder backends, or fake endpoints
- No file over 500 LOC
- No function over 100 LOC
- Complexity target below 15

## Requirements Prompt

Ask for:

- user stories
- functional requirements
- edge cases and failure modes
- EARS-style acceptance criteria where useful
- explicit out-of-scope notes

## Design Prompt

Ask for:

- architecture and runtime boundaries
- data flow
- persistence changes
- error handling and recovery
- testing plan
- packaging or permission impact

## Tasks Prompt

Ask for:

- discrete tasks and subtasks
- dependencies
- validation per task
- expected touched layers
- rollback or migration notes if relevant

## Implementation Prompt

Default shape:

```text
<task>
Implement the feature described below.
</task>

<context>
Relevant docs:
- ...
Relevant files:
- ...
</context>

<constraints>
- Stack: Tauri 2 + SvelteKit SPA + Rust core
- UI: Carbon look and feel, no React runtime
- Themes: support light and dark
- Runtime policy: no mocks, shims, fakes, stubs, placeholder backends, or fake endpoints
- Code shape: file <= 500 LOC, function <= 100 LOC, complexity < 15
</constraints>

<deliverables>
- Working code
- Tests or validation updates
- Brief summary of changed behavior
</deliverables>

<validation>
- Prove user-visible behavior through the UI with Playwright against the real app runtime
- Run the nearest relevant supporting checks
- Note any unrun validations explicitly
</validation>
```

## Provider Variants

- OpenAI variant: lean on structured outputs, prompt versioning, eval hooks, and minimal prompt text.
- Anthropic variant: keep role framing and context blocks explicit; add anti-overengineering guidance for coding tasks where useful.

## Review Prompt

For review tasks, ask for:

- bugs and regressions first
- missing tests
- risky assumptions
- file and line references
- residual risks if no findings are present
