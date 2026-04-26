# Anthropic Prompting Notes

Verified against official Anthropic docs on 2026-04-26.

## Current Guidance

- Define success criteria, tests, and a first draft prompt before heavy prompt tuning.
- Start with Anthropic's prompting best practices as the living reference for latest Claude behavior.
- Use the Messages API for custom agent loops and fine-grained control. Use managed agents only when the hosted async harness is the right fit.
- Give Claude a role in the system prompt.
- Be clear, direct, and detailed. If ordered execution matters, use numbered steps.

## Long Context And Reasoning

- Put long documents and other large context near the top of the prompt.
- Keep the query near the end.
- Use effort and adaptive thinking settings instead of trying to coerce reasoning entirely through prompt wording.
- Use explicit prompt chaining only when you need intermediate artifacts or a fixed pipeline.

## Agentic Coding Notes

- Claude's current coding guidance notes a tendency to create temporary files or overengineer when left unconstrained.
- If the task wants minimal diffs, say so explicitly and instruct cleanup of temporary files.
- Ask for simple, focused changes unless broader abstraction is truly required.

## Evaluation Bias

- Make evals task-specific.
- Automate grading when possible.
- Prefer more test cases with useful automated signal over fewer hand-graded cases.

## Repo Implications

- Use provider-specific prompts when Claude benefits from extra role framing, context placement, or overengineering controls.
- For coding prompts in this repo, explicitly call out the no-React rule, the desktop workbench layout, and the code-shape constraints.

## Sources

- Intro to Claude: https://platform.claude.com/docs/en/intro
- Prompt engineering overview: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview
- Prompting best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Define success and build evaluations: https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
