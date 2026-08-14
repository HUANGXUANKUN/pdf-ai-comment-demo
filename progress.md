# Progress Log

## 2026-08-14

- Reviewed the uploaded `WebPdfViewer.tsx` and confirmed it wraps Chrome’s PDF Viewer in an iframe with a toolbar-covering UI hack.
- Analyzed the uploaded interaction recording and extracted the default Ask AI flow and the three annotating flows: point, rectangle, and text selection.
- Initialized `/home/ubuntu/pdf-ai-comment-demo` as a static React + TypeScript WebDev project.
- Selected a light editor/Codex-inspired visual direction with contextual popovers and normalized-coordinate annotation storage.
- Next: install PDF.js, implement the viewer and interactions, then verify visually and functionally.

## Browser verification

The desktop app rendered the official PDF.js sample correctly with a high-DPI Canvas and a selectable DOM text layer. Default mode was tested by creating a real DOM Range over the PDF title: the inline Ask AI composer appeared at the selection, accepted a question, and replaced itself with the local demo response card.

Annotating mode was tested with a real pointer hover over the PDF title. The first pass exposed a state bug: switching modes cleared the cached text hit index without rebuilding it. The mode-change effect was corrected to preserve the index, after which hover highlighting and the “Click to comment” affordance worked. Clicking the highlighted title opened a text-anchored comment composer; saving it persisted the translucent highlight, numbered pin, comment count, and inspection card.

A real point click on empty page space created a numbered point draft and contextual comment composer. A controlled pointer drag created a normalized rectangle draft with blue border/fill and the expected comment popover. The coordinates were confirmed to remain page-relative rather than viewport-relative.

Desktop screenshots at 1440×900 confirmed the compact editor-like toolbar, centered paper, neutral stage, and contextual popovers. The 390×844 screenshot exposed that the narrow-screen controls visually used a second line while the app grid still reserved one toolbar row; the mobile grid was updated to a dedicated 96px two-row toolbar.

TypeScript checking and production builds passed. Vite reports only a non-blocking large-chunk warning because PDF.js and its worker are substantial dependencies.

## Finalization

The mobile toolbar was converted into an explicit 96px two-row layout and rechecked at 390×844. The final TypeScript check and production build both pass. The only build notice is Vite’s non-blocking large-chunk warning for the PDF.js runtime and worker.

A clean source archive was created at `/home/ubuntu/pdf-ai-comment-demo-source.zip`, excluding dependencies, build output, Git metadata, and internal planning files. `unzip -t` reported no errors. The reusable project README documents interactions, architecture, normalized coordinates, integration with the existing `PdfPreviewer`, CORS constraints, and production AI/persistence follow-ups.
