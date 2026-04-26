# OpenAI Prompting Notes

Verified against official OpenAI docs on 2026-04-26.

## Current Guidance

- Use reusable prompt objects with versions and variables when prompts are a product artifact, not just an inline string.
- Start with the smallest prompt that preserves the product contract.
- State the expected outcome and success criteria explicitly.
- Move output schemas out of prose when possible and use Structured Outputs instead.
- Optimize prompts for caching by putting static content first and dynamic content last.
- Do not inject the current date unless the application needs a business-specific timezone or policy-effective date.

## Prompt Structure Bias

- Keep stable role and policy guidance in the highest-authority instruction layer.
- Keep task-specific details, examples, and variables lower in the prompt.
- Use provider features before prompt hacks: reasoning controls, verbosity controls, tool schemas, structured outputs, traces, and evals.

## Structured Outputs

OpenAI's Structured Outputs guide emphasizes three direct benefits:

- reliable type safety
- explicit refusals
- simpler prompting

Default to Structured Outputs or typed tool definitions for machine-consumed results.

## Evaluation Loop

- Use traces first when debugging workflow behavior.
- Use graders on traces to find routing, tool, and instruction regressions.
- Move to datasets and eval runs when you need repeatable comparisons over prompt versions.

## Repo Implications

- Keep prompt templates versioned.
- Attach changes to eval criteria, not only manual spot checks.
- Prefer concise repo-specific constraints over giant style essays.
- For spec mode prompts, keep separate templates for requirements, design, tasks, and implementation.

## Sources

- Prompting guide: https://developers.openai.com/api/docs/guides/prompting
- Latest model guidance: https://developers.openai.com/api/docs/guides/latest-model
- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Agent evals: https://developers.openai.com/api/docs/guides/agent-evals
