## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: prettier, eslint, vitest, playwright, storybook, sveltekit-adapter

---

## Project-Local Skills

These skills live in `.codex/skills` and are the default guidance for this repo. Read the matching `SKILL.md` before substantial work in that area.

- `pi-tauri-svelte-stack`: Tauri 2 + SvelteKit SPA + Rust core + Carbon stack, packaging, quality, CI, and architecture boundaries.
- `pi-carbon-workbench-ui`: Carbon-styled Svelte desktop UI, theming, layout, and component fallback strategy without React.
- `pi-agent-prompting`: OpenAI/Anthropic prompt templates, spec-mode prompts, eval guidance, and implementation brief patterns.

## Skill Selection

- Use `pi-tauri-svelte-stack` for app scaffolding, feature implementation, persistence, process supervision, packaging, or CI work.
- Use `pi-carbon-workbench-ui` for screen design, interaction design, theming, or Carbon component selection.
- Use `pi-agent-prompting` for requirements/design/tasks prompts, implementation briefs, structured output contracts, or eval criteria.
- Use the minimal set that covers the task. For feature work, the stack skill usually pairs with the UI skill or the prompting skill.

## Non-Negotiable Runtime And Test Policy

- Do not add mocks, mocked modules, shims, fakes, stubs, dummy services, temporary adapters, placeholder backends, or fake endpoints to this repo.
- Do not intercept, fulfill, abort, or rewrite app requests in Playwright to simulate backend behavior.
- Do not add alternate in-memory service layers just to unblock UI work.
- If a feature needs stable data before the full backend exists, drive it from a committed example project or real local repository state, not an invented service double.
- Every user-visible feature must be validated through the UI with Playwright against the real app runtime. Lower-level tests may supplement this, but they do not replace the UI workflow proof.
- Prefer real local projects, throwaway test repositories, and app-created state when exercising flows end to end.

## Quality Workflow

- Before a commit is considered ready, pass the local pre-commit gate: formatter, lint, type checks, and the `fallow` commit gate.
- Before a push is considered ready, pass the local pre-push gate: frontend tests, Rust checks, `fallow audit`, and local CodeRabbit CLI review.
- On Windows, prefer CodeRabbit CLI through WSL if the CLI is not installed directly in the shell. That matches the current CodeRabbit guidance for Windows environments.
- Do not ignore, defer, or hand-wave CodeRabbit findings. Agents are expected to fix or explicitly eliminate the cause of every local CodeRabbit finding before push.
- For pull requests, keep CodeRabbit enabled for drafts and non-default base branches as well as normal PRs. Resolve review comments and incremental re-reviews before the change is considered complete.
- The repo CodeRabbit configuration uses request-changes workflow. Unresolved CodeRabbit review findings are blocking feedback, not optional commentary.
