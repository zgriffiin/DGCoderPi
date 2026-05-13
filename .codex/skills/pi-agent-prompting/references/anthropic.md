# Anthropic Prompting Notes

Verified against official Anthropic docs and Claude 4.x guidance on 2026-05-12.

## Current Guidance (Claude 4.x — Opus 4.6 / Sonnet 4.6)

- Define success criteria, tests, and a first draft prompt before heavy prompt tuning.
- Start with Anthropic's prompting best practices as the living reference for latest Claude behavior.
- Use the Messages API for custom agent loops and fine-grained control. Use managed agents only when the hosted async harness is the right fit.
- Give Claude a role in the system prompt.
- Be clear, direct, and detailed. If ordered execution matters, use numbered steps.
- Claude 4.x takes instructions literally and does exactly what you ask — nothing more. Invest in detailed prompts; the precision pays off more than with models that approximate intent.

## XML Tag Structuring

- Claude is specifically trained to recognize and respect XML-style tags. Use them to separate instructions from context, examples from tasks, and source material from queries.
- Use tags like `<task>`, `<context>`, `<constraints>`, `<deliverables>`, `<validation>`, and `<stop_conditions>` to structure complex prompts.
- Nest tags for multi-part prompts: `<examples><example type="good">...</example></examples>`.
- Wrap pasted documents in `<document>` tags so Claude distinguishes source material from instructions.
- For code review, wrap files in `<file path="...">` tags with clear path labels.
- XML tags are more effective than markdown or plain text delimiters for Claude's parsing.

## Long Context And Reasoning

- Put long documents and other large context near the top of the prompt.
- Keep the query near the end.
- Use effort and adaptive thinking settings instead of trying to coerce reasoning entirely through prompt wording.
- Use explicit prompt chaining only when you need intermediate artifacts or a fixed pipeline.
- Claude's large context window actively uses information throughout — paste full documents rather than pre-summarizing.

## Extended Thinking

- Claude 4.x supports extended thinking for complex reasoning, code debugging, multi-step analysis, and edge case identification.
- Phrases like "think through carefully" or "consider each X before answering" signal deeper reasoning.
- Skip extended thinking for simple Q&A, creative writing, formatting, and translations.
- Use thinking levels (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`) to control reasoning depth.

## System Prompt Best Practices

- Define identity/expertise, behavioral rules, and output expectations in the system prompt.
- Be specific about what to avoid — Claude respects "don't" instructions well.
- Set output format once in the system prompt rather than repeating per message.
- Include examples of ideal output when a specific format or tone is needed.
- Keep system prompts under 500 words. Put critical rules first — Claude gives more weight to early instructions.
- Stable policy, role, and stack constraints go high in the prompt. Request-specific context goes lower.

## Structured Output

- Provide exact JSON schemas including types and null handling for reliable parseable output.
- Show the expected shape with field types: `"field": string | null`.
- Use "Do not include any text outside the JSON object" when machine-consumed output is needed.
- For consistent list formats, show the exact template and say "Do not deviate from this format."

## Agentic Coding Notes

- Claude's current coding guidance notes a tendency to create temporary files or overengineer when left unconstrained.
- If the task wants minimal diffs, say so explicitly and instruct cleanup of temporary files.
- Ask for simple, focused changes unless broader abstraction is truly required.
- Claude produces better code when asked to write tests alongside implementation.
- Provide codebase conventions (naming, error handling style, type strictness) for code that fits existing projects.
- For debugging, provide full error context: error messages, stack traces, relevant code, and what changed recently.

## Provider-Specific Strengths

- Instruction fidelity: Claude honors all constraints in multi-part prompts where other models may drop later requirements.
- Long-context handling: Strong retrieval from throughout the context window — reference specific sections of large documents.
- Honesty about uncertainty: Claude will say "I'm not sure" rather than confabulate. Prompt explicitly if you want a best-effort assessment despite uncertainty.
- Code generation: Particularly strong for TypeScript, Python, and Rust. Produces well-structured, idiomatic code with error handling.

## Evaluation Bias

- Make evals task-specific.
- Automate grading when possible.
- Prefer more test cases with useful automated signal over fewer hand-graded cases.

## Repo Implications

- Use provider-specific prompts when Claude benefits from extra role framing, context placement, or overengineering controls.
- For coding prompts in this repo, explicitly call out the no-React rule, the desktop workbench layout, and the code-shape constraints.
- Use XML tags for structured prompt sections — they activate Claude's pattern recognition for organized outputs.
- For Kiro Enterprise models (Claude Opus 4.6, Sonnet 4.6), the same prompting patterns apply since they are the same underlying models accessed through AWS Bedrock.

## Sources

- Intro to Claude: https://platform.claude.com/docs/en/intro
- Prompt engineering overview: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview
- Claude 4 best practices: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices
- XML tags: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags
- Define success and build evaluations: https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
