# Pi Desktop App Functional Specification

## Product Summary

This project is a Windows desktop application for running and supervising AI coding work in local repositories.

The app is not just a prompt box. It is a durable workspace for managing projects, organizing long-running agent work into threads, inspecting what the agent did, reviewing repository impact, and recovering cleanly when work is interrupted.

The agent engine for the new system is Pi. The product itself is the desktop application and its user workflows around Pi-driven software work.

## Product Intent

The system should let a user:

- open and manage multiple software projects
- create and continue multiple threads of work inside each project
- prompt a coding agent against a real repository
- create structured feature specifications before implementation work begins
- watch progress and inspect intermediate activity while work is running
- review code changes, diffs, checkpoints, and file impact after each turn
- handle approvals, follow-up questions, and retries without losing context
- manage task workflows around the coding work
- run quality and review workflows before important git actions
- return to the app later and still understand the state of every active or completed thread

## Platform Scope

- Windows desktop app only
- local-repository workflow first
- local agent tooling and local git workflows first
- no requirement to preserve a browser-first or server-first product shape

## Core Experience

The primary user experience is a project-centered desktop workspace with persistent history.

Users should be able to work across many repositories, keep multiple agent conversations alive at once, switch between them quickly, and trust that the app still reflects reality after restarts, reconnects, or partial failures.

## Functional Areas

### Project Management

The app should support:

- creating and opening multiple projects
- identifying each project by its repository or workspace path
- storing project metadata and project-level settings
- showing project state in a persistent sidebar or navigator
- archiving, hiding, or removing projects from active view without losing history by default

### Multi-Project And Multi-Thread Workspace

The app should support:

- multiple projects visible in the same application
- multiple threads per project
- fast switching between projects and threads
- thread grouping under each project
- clear visual status for idle, running, waiting, failed, completed, and interrupted threads
- persistent thread titles, timestamps, and summary metadata
- archived thread handling without deleting useful history

### Thread-Based Agent Work

Each thread should function as a durable unit of coding work.

The app should support:

- starting a new thread for a task or problem
- continuing an existing thread over many turns
- preserving the full conversational history of the thread
- keeping thread-local context such as chosen model, branch, working directory, and recent activity
- retrying or continuing work without forcing the user to start over

### Specification Mode

The app should support a dedicated Specification Mode for new or existing threads.

Specification Mode should be used when the user wants to plan work before implementation. The initial baseline should follow Kiro's publicly documented spec workflow shape, adapted to this desktop app and Pi as the agent engine.

This capability should include:

- creating a new thread directly in Specification Mode
- converting a normal thread into Specification Mode when planning becomes necessary
- a guided three-phase workflow of requirements, design, and tasks
- the ability to move phase-by-phase instead of jumping straight to code generation
- visible phase state such as draft, in review, approved, regenerated, and superseded
- preserving the full discussion that led to each artifact
- continuing normal implementation work from the resulting task list inside the same thread or a linked implementation thread

### Specification Artifacts

Specification Mode should produce durable planning artifacts associated with the thread.

This capability should include:

- a requirements artifact describing what should be built
- a design artifact describing the implementation approach
- a task artifact describing the execution plan
- explicit version history for each artifact
- regeneration of downstream artifacts when upstream artifacts change
- traceability from tasks back to requirements
- export or storage as markdown files if the user wants project-local copies

### Specification Workflow

The default specification workflow should follow a requirements-first sequence inspired by Kiro's public docs:

1. Requirements
2. Design
3. Tasks

The workflow behavior should include:

- requirements generation from a natural-language feature or project prompt
- requirements written in a structured, testable format
- encouragement toward EARS-style acceptance criteria where appropriate
- explicit capture of user stories, functional behavior, edge cases, and error handling
- design generation only after requirements are reviewed or approved
- design output that covers architecture, components, interfaces, data flow, error handling, and testing approach
- task generation only after the design is accepted
- task output broken into discrete, trackable tasks and subtasks with dependencies and expected outcomes
- task details that include validation expectations such as testing, UX completeness, and other delivery requirements when relevant
- the ability to revise requirements and regenerate design and tasks without losing prior versions

The app may later support alternative workflows such as design-first or bugfix-spec workflows, but requirements-first should be the initial baseline.

### Specification Prompt Templates

The app should support editable prompt templates for Specification Mode in settings.

This capability should include:

- a default system prompt or instruction template for each specification phase
- separate editable templates for requirements, design, and tasks
- optional project-level overrides in addition to global defaults
- prompt template versioning so the user can improve prompts over time without losing prior variants
- one-click reset to built-in defaults
- import and export of prompt template sets
- visibility into which prompt template version produced a given artifact
- the ability to test or preview a prompt template before adopting it as the default

The system should treat these prompts as product configuration, not hardcoded behavior.

### Specification Review Experience

The app should support review and iteration of specification artifacts before implementation starts.

This capability should include:

- inline review of generated requirements, design, and tasks
- approve, revise, and regenerate actions at each phase
- discussion attached to a specific artifact or phase
- highlighting of changes between artifact versions
- the ability to mark requirements or tasks as optional, deferred, or out of scope
- a clear handoff from approved tasks into execution tracking

### Agent Interaction

The app should support:

- a chat-style composer for prompting Pi
- streamed assistant output while a turn is running
- multi-turn back-and-forth within the same thread
- explicit send, stop, and retry actions
- protection against accidental duplicate sends while a turn is active
- user-visible distinction between active agent work and post-run processing

### Model Selection

The app should support:

- model selection at the thread level
- changing the selected model for future work in a thread
- presenting the available Pi model catalog in a usable way
- showing the currently selected model in thread UI and history views

### Plans, Activities, And Progress

The app should support:

- rendering the agent's proposed plans when provided
- showing live progress and activity while the agent is working
- separating user-visible content from operational activity
- compact activity rows for noisy tool output
- expandable detail views for long logs, tool calls, or work-log entries
- clear indicators for waiting states, recovery states, and completed states

### Approvals And Follow-Up Input

The app should support:

- surfacing approval requests inside the thread
- allowing the user to approve or deny gated actions
- surfacing follow-up questions or user-input requests from the agent
- letting the user answer those requests without breaking thread continuity
- keeping pending approvals and pending user input visible until resolved

### Attachments And Context

The app should support:

- image attachments in conversation flows
- displaying attachment previews where relevant
- showing contextual thread metadata such as repository, branch, or worktree
- showing terminal or environment context associated with the thread

### Git-Aware Change Review

The app should support:

- changed-file summaries after agent work
- per-turn diff summaries
- viewing diffs for the latest turn by default
- switching to broader diff scopes when needed
- review of repository impact without leaving the app for basic inspection

### Checkpoints And Recovery Actions

The app should support:

- checkpoints tied to thread progress
- checkpoint diffs that help the user understand what changed between turns
- rollback-style actions from checkpoints when available
- visible checkpoint status so the user knows whether recovery points are ready, missing, or failed

### Branch And Worktree Awareness

The app should support:

- associating a thread with its branch or worktree context
- showing branch and worktree information in thread views
- keeping thread state understandable when multiple parallel lines of work exist in the same repository

### Quality Gate

The app should support a post-run quality gate for file-changing work.

This capability should include:

- running formatting, linting, and typechecking checks
- recording pass or fail status in the thread timeline
- surfacing code-shape or policy failures when configured
- making quality-gate behavior configurable per user or project

### Beans Workflow Management

The app should support Beans-style project workflow management directly from the desktop UI.

This capability should include:

- initializing Beans in the active project
- listing and searching beans
- viewing the roadmap
- creating and updating beans
- archiving beans-related project state when needed
- generating prompts that help split larger work into smaller child tasks

### Git Review And PR Helpers

The app should support repository-level review helpers around important git actions.

This capability should include:

- pre-action review workflows before commit, push, or pull request creation when configured
- local review-tool integration such as CodeRabbit-style review commands
- project-tracked review policy that can block certain git actions until checks pass
- PR helper flows that assist users in preparing code for review

### Settings And Tool Health

The app should support:

- application settings for agent behavior and local tooling
- project-level settings where appropriate
- visibility into tool health, availability, and misconfiguration
- actionable messages when required local tools or authentication are missing

### History, Persistence, And Resume

The app should support:

- durable storage of projects, threads, messages, activities, plans, and diffs
- resuming the app after restart without losing thread context
- preserving completed and in-progress work across interruptions
- restoring enough state that the user can continue without manual reconstruction

### Reliability And Recovery

From a user perspective, the app should behave predictably when:

- the app is restarted
- the machine sleeps or resumes
- the agent run is interrupted
- local tools stall or fail
- a thread needs to be refreshed or resynchronized

The expected product behavior is that thread state remains coherent, active work is clearly marked, stale status is corrected, and recovery does not require the user to manually piece together what happened.

### Observability And Diagnostics

The app should support:

- visible error states instead of silent failure
- thread-level diagnostics that help explain why work failed or stalled
- enough operational history for users to inspect what happened during a run
- desktop-friendly failure handling that leaves the user with a readable fallback rather than a blank app state

## Functional Priorities

The product should prioritize:

1. predictable project and thread state
2. trustworthy recovery after interruption
3. clear review of repository changes
4. strong multi-project and multi-thread usability
5. integrated workflow helpers around coding, review, and task management

## Specification Mode Baseline

The Specification Mode feature should start by emulating the publicly documented Kiro behavior, not by assuming access to Kiro's private internal prompts.

The baseline to emulate is:

- feature specs organized around `requirements`, `design`, and `tasks`
- requirements-first flow as the default user path
- structured requirements with testable acceptance criteria
- design artifacts that translate approved requirements into an implementation approach
- task artifacts that break the design into discrete executable work with dependencies and traceability
- artifact review and regeneration when upstream planning changes

If public examples of Kiro-style prompts are useful, they may be used as inspiration for default templates, but the app should treat its own prompt templates as first-party, user-editable product configuration.

## Non-Goals For This Document

This document does not define:

- internal transport choices
- server architecture
- browser architecture
- protocol design
- implementation milestones
- migration steps from the current codebase

It defines the product capabilities the replacement system should deliver.
