# Requirements Document

## Introduction

This feature adds a "run as loop" capability to the thread composer. Instead of a single agent turn, the user can ask the agent to iterate on a task across multiple turns, re-running until objective, verifiable exit conditions are met or a bound is hit.

The goal is to reduce low-quality AI output by anchoring iteration to real gates the repository already trusts (diff review, lint, type checks, tests) rather than the model's self-assessment. The loop must converge toward a shrinking set of findings, stop when it stalls, respect hard caps on cost and time, and surface every iteration as durable, inspectable, interruptible thread activity.

This baseline scopes the diff-review gate as the only fully wired exit condition, because it reuses the existing ship-review machinery without new backend surface. Lint, type, and test gates are specified but gated behind a backend capability that does not yet exist.

## Glossary

- **Loop run**: a single user-initiated iterative session against one thread.
- **Iteration / pass**: one agent turn plus the gate evaluation that follows it.
- **Gate**: a verifiable check that returns pass/fail, a findings count, a content fingerprint, and an optional refinement prompt.
- **Exit condition**: the rule that ends a loop run (converged, exhausted, stalled, budget-exceeded, blocked, cancelled).
- **Convergence trail**: the per-iteration history of findings counts shown to the user.

## Requirements

### Requirement 1: Start a loop run from the composer

**User Story:** As a developer, I want to run a prompt as a loop instead of a single turn, so that the agent keeps refining the work until it meets quality gates.

#### Acceptance Criteria

1. WHEN the user composes a prompt in a thread THEN the system SHALL offer a "run as loop" option alongside the normal send action.
2. WHEN the user enables "run as loop" THEN the system SHALL present a loop configuration with selectable gates, a maximum iteration count, a stop-on-no-improvement toggle, and a time budget.
3. WHEN the user starts a loop run without changing defaults THEN the system SHALL use the diff-review gate, a maximum of 5 iterations, stop-on-no-improvement enabled, and a default time budget.
4. IF the target thread already has a loop run in progress THEN the system SHALL prevent starting a second concurrent loop run for that thread.
5. WHEN a loop run starts THEN the system SHALL send the user's prompt as the first iteration's agent turn through the existing thread runtime.

### Requirement 2: Iterate against verifiable gates

**User Story:** As a developer, I want each iteration evaluated by real checks, so that "done" means objective gates passed and not the model declaring victory.

#### Acceptance Criteria

1. WHEN an agent turn in a loop run completes THEN the system SHALL run every selected gate against the resulting repository state.
2. WHEN all selected gates pass THEN the system SHALL end the loop run with a converged outcome and SHALL NOT start another iteration.
3. WHEN at least one selected gate fails THEN the system SHALL compose the next iteration's prompt from the failing gates' refinement details.
4. WHEN the diff-review gate is selected THEN the system SHALL reuse the existing ship-review evaluation and fix-prompt generation rather than a separate review path.
5. IF a gate errors during evaluation THEN the system SHALL end the loop run with a blocked outcome and surface the gate error.
6. WHERE a gate's required backend capability is unavailable THEN the system SHALL hide or disable that gate in configuration rather than silently skipping it during a run.

### Requirement 3: Bound the loop to prevent runaway cost

**User Story:** As a developer, I want hard limits on how long a loop runs, so that it cannot spin indefinitely or burn unbounded cost.

#### Acceptance Criteria

1. WHEN the iteration count reaches the configured maximum without convergence THEN the system SHALL end the loop run with an exhausted outcome.
2. WHEN the elapsed time reaches the configured time budget THEN the system SHALL end the loop run with a budget-exceeded outcome at the next safe boundary between iterations.
3. WHILE a loop run is active THEN the system SHALL expose a stop control that ends the run with a cancelled outcome before the next iteration starts.
4. WHEN a loop run ends for any reason THEN the system SHALL leave the thread in a normal idle state with all completed iterations preserved.

### Requirement 4: Detect and stop on non-improvement

**User Story:** As a developer, I want the loop to stop when it stops making progress, so that it does not churn or oscillate without reducing findings.

#### Acceptance Criteria

1. WHEN stop-on-no-improvement is enabled AND an iteration produces the same repository diff fingerprint as the prior iteration AND the total findings count did not decrease THEN the system SHALL end the loop run with a stalled outcome.
2. WHEN an iteration reduces the total findings count below the prior iteration THEN the system SHALL treat the run as progressing and continue.
3. WHEN stop-on-no-improvement is disabled THEN the system SHALL continue iterating until another exit condition is reached.

### Requirement 5: Surface iterations as durable, inspectable activity

**User Story:** As a developer, I want to see what each iteration changed and how findings trended, so that I can trust the result and intervene when needed.

#### Acceptance Criteria

1. WHEN each iteration completes THEN the system SHALL record an inspectable entry containing the iteration number, the gates run, each gate's summary, and the total findings count.
2. WHEN a loop run is active THEN the system SHALL display a convergence trail showing how the total findings count changed across iterations.
3. WHEN each iteration runs an agent turn THEN the system SHALL preserve that turn as normal durable thread history that the user can review, interrupt, and revert.
4. WHEN a loop run ends THEN the system SHALL display the final outcome and the reason the run ended.
5. WHEN the agent is mid-turn inside a loop THEN the system SHALL distinguish active agent work from between-iteration gate evaluation.

### Requirement 6: Respect runtime and performance boundaries

**User Story:** As a maintainer, I want the loop to follow the project's runtime and caching rules, so that it does not regress streaming, caching, or context discipline.

#### Acceptance Criteria

1. WHEN a loop run waits for an agent turn to finish THEN the system SHALL observe incremental thread updates from the runtime rather than polling the agent session.
2. WHEN a gate produces an analysis output THEN the system SHALL key any cached result by the behavior-affecting inputs, including the diff fingerprint and the selected model.
3. WHEN repository diff content, the selected model, or the review contract changes THEN the system SHALL miss or invalidate the corresponding cached gate result.
4. WHEN composing an iteration prompt THEN the system SHALL include only task-specific gate findings and SHALL NOT load unrelated project docs, skills, or templates into the loop turn.
