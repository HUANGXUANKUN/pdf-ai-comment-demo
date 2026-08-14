# PDF AI Comment Demo — Task Plan

## Goal
Build a polished React + TypeScript + PDF.js web app that reproduces the uploaded reference interaction: default mode supports text selection followed by an inline “Ask AI” composer; Annotating mode supports point comments, drag-box comments, text-selection comments, and hover hit-testing for PDF text elements.

## Product Decisions

- Use a custom PDF.js renderer rather than Chrome’s internal PDF iframe so that the app owns the text layer and coordinate system.
- Use a light Codex/editor-inspired shell: compact top toolbar, neutral gray canvas, centered paper, blue selection accents, and contextual popovers instead of a permanent sidebar.
- Store demo annotations in React state using normalized page coordinates so they survive zoom changes.
- Keep AI generation simulated and local; the static demo has no backend or API keys.

## Phases

| Phase | Status | Exit criteria |
|---|---|---|
| Analyze reference | Complete | Interaction states, layout, colors, and popover behavior documented |
| Scaffold | Complete | React 19 + TypeScript WebDev project running |
| PDF core | Complete | PDF.js renders pages and a usable text layer |
| Interaction model | Complete | Default Ask AI selection, annotating point/box/text comments, and hover text hit-testing work |
| Visual polish | Complete | Toolbar, paper canvas, pins, comment composer, zoom, responsive behavior match the reference |
| Verification | Complete | TypeScript check, production build, and browser interaction tests pass |
| Delivery | Complete | Source bundle and concise run/integration notes delivered |

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Target repository/file not visible in the sandbox/GitHub integration | 1 | User uploaded the source file directly; architecture was analyzed from the attachment |
| Text Hover stopped working after switching from Ask to Annotating mode | 1 | The mode effect was clearing the cached text hit index; preserved it across mode changes and reverified in the browser |

## Constraints

- Frontend-only; do not modify `server/`.
- Use TypeScript for all application code.
- Do not depend on Chrome’s internal PDF Viewer DOM.
- Keep a clean reusable component boundary so concepts can be moved into the user’s React app.
