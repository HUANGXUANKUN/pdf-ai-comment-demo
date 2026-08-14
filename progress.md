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

## iOS Safari compatibility fix

The reported mobile failure was reproduced from the runtime signature and traced to the PDF.js modern build. The implementation is being migrated to the official PDF.js legacy display and worker builds so older Safari receives the complete compatibility layer. Verification will include a synthetic missing-API test, TypeScript, production build, desktop browser rendering, and the deployed mobile layout.

The complete compatibility regression now passes after adding the remaining `AbortSignal.any` shim. TypeScript and the production build both succeed. Browser verification confirms that the legacy display and worker pair render the sample PDF, create the TextLayer, and expose the full page on desktop. A 390×844 mobile screenshot also shows the PDF content rendered instead of the previous error state, with the responsive toolbar and status bar intact.

Annotating mode was rechecked after the compatibility migration. Switching modes succeeds, the TextLayer still contains 163 measurable text items, and hovering the real title coordinates produces the blue title highlight plus “Click to comment”. Runtime inspection reports no page error, a 660×855 Canvas, and working `Promise.withResolvers`, `Promise.try`, and `AbortSignal.any` functions.

The compatibility fix is finalized. Both PDF.js imports now use `pdfjs-dist/legacy/build/pdf.mjs`, and the worker uses the matching legacy worker. A focused `pdfjs-compat.ts` installs `AbortSignal.any` only when missing. `pnpm test:compat` is now part of the documented verification workflow, and the README explains why the legacy build is required for Safari/iOS Safari before 17.4.
