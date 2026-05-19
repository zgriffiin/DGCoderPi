# Frontend Design Prototyping — Intent Specification

## Summary

Add a visual design capability to Pi that supports two complementary workflows:

1. **Prototype Mode**: An agent-assisted HTML prototyping surface where users collaboratively build, iterate, and refine page layouts and UI designs as part of (or independent from) the spec flow. Prototypes serve as visual references or starting points during later implementation.

2. **Annotation Mode**: A click-to-annotate overlay on built application pages that lets users visually mark elements, attach change requests, and pass structured feedback to the agent for implementation.

Both modes close the gap between "what I see" and "what I want changed" — replacing text-only descriptions with spatial, element-aware feedback that agents can act on precisely.

## Problem

Today, the spec flow produces requirements, design, and task artifacts entirely in text. When a user wants to communicate layout intent, component placement, spacing, visual hierarchy, or interaction behavior, they must describe it in prose. This creates several friction points:

- **Ambiguity**: "Move the sidebar toggle to the top" could mean many things without visual context.
- **Iteration cost**: Each design revision requires a full text exchange, mental model alignment, and re-reading of prior context.
- **No visual artifact**: The spec flow produces no renderable reference that a user can point at and say "like this, but change X."
- **Post-build feedback is disconnected**: Once the app is built, users must screenshot, describe elements by name, and hope the agent finds the right component. There is no spatial link between "this thing on screen" and "this code."

Tools like Cursor's visual editor, Agentation, and Vibe Annotations have demonstrated that pointing beats describing — capturing element context (selectors, positions, component paths) alongside natural-language notes produces tighter feedback loops and better agent outcomes.

## Goals

- Let users express design intent visually, not just textually, at any point in the spec or build process.
- Produce renderable HTML prototypes that serve as durable references alongside spec artifacts.
- Support iterative refinement through conversational back-and-forth with the agent on a live preview.
- After implementation, let users annotate the real running app and generate structured change requests the agent can act on.
- Keep the experience integrated into the Pi workbench — not a separate tool or browser extension.

## Non-Goals

- This is not a pixel-perfect design tool or Figma replacement. Fidelity targets are "good enough to communicate intent," not production-ready assets.
- This does not replace the existing spec flow. It augments it with an optional visual artifact.
- This does not require a running backend or real data. Prototypes use static or placeholder content to communicate layout and interaction patterns.
- This is not a WYSIWYG page builder. The user works with the agent conversationally; the agent produces the HTML.

## Prior Art and Research

### Cursor Visual Editor (Dec 2025)

Cursor's browser-integrated visual editor lets users drag elements, inspect component props, and "point and prompt" — clicking on any element and describing what to change. Agents run changes in parallel. Key insight: unifying the rendered page, the codebase, and visual editing tools in one window removes context-switching.

### Agentation / Vibe Annotations (2025–2026)

Browser-based annotation tools that overlay on localhost development pages. Users click elements, leave notes, and the tool captures selectors, positions, file paths, and element context. Output is structured markdown that any AI coding agent can consume. Key insight: short notes ("slow this down," "make this rounded") become precise when paired with automatically captured element context.

### Huashu Design / Claude Design Skills (2026)

Agent skills that transform coding agents into designers capable of producing high-fidelity HTML prototypes through natural language. The agent generates complete HTML/CSS artifacts that can be previewed and iterated on. Key insight: HTML is a universal prototype medium — it renders everywhere, requires no special tooling, and agents are already excellent at producing it.

### Builder.io Fusion (2025–2026)

Collaborative platform where design changes on rendered pages become code edits in the repo. Prototypes built with real components accelerate the development lifecycle. Key insight: prototypes that use the actual design system (not abstract wireframes) translate more cleanly into production code.

### document.designMode (Browser Native)

The browser's built-in `document.designMode = "on"` makes any page content-editable. While limited, it demonstrates the principle that direct manipulation of rendered content is the most intuitive feedback mechanism.

## Proposed Capability

### Part 1: Prototype Mode

An optional phase in the spec flow (activatable at any point) where the user works with the agent to produce HTML page prototypes.

#### Entry Points

- From the spec flow: after requirements or design are drafted, user can say "let's prototype this"
- From any thread: user can start a prototype conversation directly
- From an existing prototype: user can resume iteration

#### Workflow

1. User describes the page or component they want to see — referencing the spec, a UI framework, a layout concept, or just a rough idea.
2. Agent generates an HTML prototype (single-file HTML with inline CSS, or HTML + Carbon/Tailwind CDN references for richer fidelity).
3. Prototype renders in a preview pane within the Pi workbench (likely using the Tauri webview or an embedded iframe).
4. User views the rendered result and responds conversationally: "move the nav to the left," "make the cards wider," "add a loading state."
5. Agent regenerates or patches the prototype. Preview updates.
6. Iteration continues until the user is satisfied or moves on.
7. The prototype is stored as a versioned artifact associated with the thread or spec.

#### Prototype Characteristics

- Self-contained HTML (or HTML + CDN stylesheet references)
- Can reference Carbon design tokens and components via CDN for visual consistency with the app's design system
- Supports light and dark theme previewing
- Responsive — user can resize the preview to test different viewport sizes
- Versioned — each iteration is a snapshot the user can compare or revert to
- Exportable — user can save the HTML locally or reference it in implementation tasks

#### Preview Surface

- Rendered in the right-side inspector or a dedicated center-pane tab
- Supports zoom, viewport resize, and theme toggle
- Shows the current HTML source alongside the rendered output (split or tabbed)
- Allows the user to click elements in the preview to reference them in conversation ("change this element's color")

### Part 2: Annotation Mode

A visual feedback overlay on the running application (or a prototype) that lets users mark elements and attach change requests.

#### Entry Points

- From a running app preview within Pi (if the app is served locally)
- From a stored prototype in the workbench
- User activates "annotation mode" via a toolbar toggle or command

#### Workflow

1. User activates annotation mode on a rendered page.
2. The page gets an overlay that highlights elements on hover and allows click-to-select.
3. User clicks an element. A balloon/callout appears anchored to that element.
4. User types a short note: "make this bolder," "align with the card above," "this should be a dropdown."
5. The system captures alongside the note:
   - Element selector (CSS selector path or component identifier)
   - Element bounding box and position on page
   - Relevant source file path (if determinable from source maps or component tree)
   - Screenshot snippet of the annotated area
   - Current viewport size and theme
6. User can add multiple annotations across the page.
7. When done, user submits annotations. The system generates a structured annotation payload.
8. The payload is sent to the agent as a new message in the thread, formatted for precise action.
9. Agent reads the structured annotations and implements the requested changes.

#### Annotation Payload Structure

Each annotation should produce structured context like:

```markdown
## Visual Feedback

### Annotation 1

**Element:** .sidebar > .nav-item:nth-child(3)
**Component:** NavigationItem (src/lib/components/Navigation.svelte:42)
**Position:** 12%, 35% (viewport 1440×900, theme: g100)
**Feedback:** "Make this icon larger and add a hover tooltip"

### Annotation 2

**Element:** .thread-card .timestamp
**Component:** ThreadCard (src/lib/components/ThreadCard.svelte:78)
**Position:** 85%, 22% (viewport 1440×900, theme: g100)
**Feedback:** "Use relative time format instead of absolute"
```

#### Annotation UI Characteristics

- Balloon callouts anchored to selected elements (similar to BugHerd, Marker.io, or Agentation)
- Non-destructive overlay — does not modify the underlying page
- Supports multiple annotations per session
- Annotations are numbered and visually connected to their elements
- Callouts support text input and optional priority/category tags
- Session can be saved, resumed, or discarded
- Works on both prototype previews and the real running app

### Integration with Spec Flow

- Prototypes can be linked to requirements or design artifacts
- Annotations on prototypes feed back into the design phase
- Annotations on the built app can generate new tasks or revision requests
- The agent can reference a prototype when implementing tasks ("build this page to match prototype v3")

## Architecture Considerations

### Prototype Rendering

- Use Tauri's webview capabilities or a sandboxed iframe to render HTML prototypes
- Prototypes are isolated from the app runtime — they are static HTML documents
- Preview pane communicates with the main app via Tauri IPC for theme sync, viewport control, and element selection

### Annotation Overlay

- Inject a lightweight annotation script into the preview webview or app webview
- The script handles: element highlighting on hover, click-to-select, callout positioning, and context capture
- Element identification uses CSS selector generation (robust path from root) and, where available, source map or component-tree lookup
- Annotation data flows back to the main app via IPC, not stored in the rendered page

### Storage

- Prototypes stored as versioned HTML files in the project's thread or spec data
- Annotations stored as structured JSON associated with the thread
- Both are lightweight, reconstructable artifacts (aligned with caching guidance)

### Agent Prompt Integration

- Prototype requests use the existing implementation prompt pattern with a `<deliverables>` block specifying HTML output
- Annotation payloads are formatted as structured context blocks that the agent can parse and act on
- The agent skill for prototyping would be a natural extension of `pi-agent-prompting`

## Open Questions

1. **Prototype fidelity**: Should prototypes default to plain HTML/CSS, or should they use Carbon CDN references to match the app's design system? (Recommendation: offer both, default to Carbon-aligned.)

2. **Source mapping for annotations**: How reliably can we map a rendered DOM element back to a source file and line? Source maps work for JS bundles; Svelte component boundaries may need a dev-mode component tree inspector.

3. **Annotation on production builds vs dev builds**: Dev builds have richer source information. Should annotation mode require a dev server, or should it work (with reduced precision) on production builds too?

4. **Prototype scope**: Single-page prototypes only, or should multi-page navigation be supported? (Recommendation: start with single-page, add navigation later.)

5. **Collaboration**: Is this single-user only, or should annotations be shareable (e.g., exported as markdown for team review)? (Recommendation: single-user first, export capability for sharing.)

6. **Prototype-to-code bridge**: Should there be an explicit "implement this prototype" action that generates implementation tasks from the prototype HTML? Or is the prototype purely a visual reference?

7. **Viewport and device simulation**: Beyond simple resize, should the preview support device presets (mobile, tablet, desktop) for responsive prototyping?

## Relationship to Existing Features

| Existing Feature                          | Relationship                                                       |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Spec flow (requirements → design → tasks) | Prototype Mode is an optional visual artifact alongside text specs |
| Thread composer                           | Prototype iteration happens through normal thread conversation     |
| Right-side inspector                      | Prototype preview and annotation review surface here               |
| Diff viewer                               | Prototype version diffs could use similar comparison UI            |
| Agent prompting patterns                  | Prototype and annotation prompts extend existing templates         |
| Carbon UI system                          | Prototypes can reference Carbon tokens for design-system alignment |

## Success Criteria

- A user can describe a page layout in conversation and see a rendered HTML prototype within the same thread.
- A user can iterate on a prototype through multiple conversational turns without losing prior versions.
- A user can click on elements in a rendered page and attach change notes that the agent can act on.
- Annotations capture enough element context that the agent can locate and modify the correct code without guessing.
- The feature integrates naturally into the existing workbench layout without requiring external tools or browser extensions.

## References

- [Cursor Visual Editor](https://trycursor.com/blog/browser-visual-editor) — point-and-prompt on rendered pages
- [Agentation](https://agentation.com/) — click-to-annotate with structured agent output
- [Vibe Annotations](https://vibeannotations.com/) — visual feedback overlay for AI coding agents via MCP
- [Builder.io Fusion](https://builder.io/) — collaborative design-to-code with real components
- [Huashu Design](https://github.com/alchaincyf/huashu-design) — HTML-native design skill for AI agents
- [benji.org/annotating](https://benji.org/annotating) — essay on why pointing beats describing for agent feedback
- [BugHerd](https://bugherd.com/) — visual website feedback with pinned comments
- [Marker.io](https://marker.io/) — website annotation and bug reporting
