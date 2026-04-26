---
name: pi-agent-prompting
description: Create and refine prompt templates, spec workflows, and agent instructions for this repo using current OpenAI and Anthropic guidance. Use when drafting requirements, design, task, implementation, review, or eval prompts for coding agents, or when creating structured output contracts and provider-specific prompt variants.
---

# Pi Agent Prompting

## Overview

Use this skill to keep prompt work disciplined and versioned instead of ad hoc. It combines provider-specific guidance with repo-specific prompt patterns so agents can produce spec artifacts and implementation briefs that match the chosen stack and constraints.

## Quick Start

- Read `references/project-prompt-patterns.md` for the default templates used in this repo.
- Read `references/openai.md` when targeting OpenAI models or tooling.
- Read `references/anthropic.md` when targeting Claude models or tooling.

## Prompt Workflow

1. Define success criteria and evaluation conditions before rewriting the prompt.
2. Start with the smallest prompt that preserves the product contract.
3. Keep stable policy, role, and stack constraints high in the prompt. Keep request-specific context and examples lower.
4. Prefer structured outputs or typed tool schemas over prose-only format instructions when the provider supports them.
5. Version prompts and attach them to evals, not only manual spot checks.
6. Split provider variants when OpenAI and Anthropic benefit from different controls instead of forcing a lowest-common-denominator prompt.

## Repo Expectations

- For spec mode, keep the prompts separate for requirements, design, and tasks.
- Implementation prompts must include the stack choice, the no-React rule, theme support, packaging expectations, the no-mocks policy, the Playwright UI validation requirement, and the code-shape constraints unless the task is intentionally narrower.
- Implementation prompts should also remind agents to clear `fallow` and CodeRabbit gates before push when the task changes real code.
- When the work is headed for a PR, implementation prompts should remind agents that hosted CodeRabbit findings are blocking and must be fixed through re-review, including on draft PRs.
- Ask the model for explicit assumptions, validation steps, and unresolved risks when the task is architectural or cross-cutting.
- For agentic coding prompts, include explicit guidance on file hygiene and avoiding speculative abstractions.

## Output Expectations

- A good prompt template in this repo includes: task, context, constraints, deliverables, validation, and stopping conditions.
- A good eval prompt or rubric names the expected artifact and the actual failure modes to check, not just a generic quality score.
- A good provider-specific variant changes only what the provider actually benefits from: reasoning controls, structured outputs, context placement, or tool guidance.

## References

- `references/project-prompt-patterns.md`: repo-specific prompt templates and required constraints
- `references/openai.md`: current OpenAI prompting and eval notes
- `references/anthropic.md`: current Anthropic prompting and eval notes
