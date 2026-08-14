# PDF AI Comment Demo

This is a frontend-only React + TypeScript demonstration of a PDF.js review experience inspired by the uploaded Codex-style interaction recording. It replaces Chrome’s isolated PDF iframe with an application-owned Canvas and DOM text layer, allowing the React app to understand PDF text geometry and place contextual UI precisely.

## Included interactions

| Mode | Interaction | Result |
|---|---|---|
| Default / Ask | Select text with the native browser selection | A contextual Ask AI composer appears beside the selected PDF text |
| Default / Ask | Submit a question | A local simulated AI response card replaces the composer |
| Annotating | Hover a PDF text element | The corresponding PDF.js text item is highlighted and becomes a comment target |
| Annotating | Click a hovered text element | A text-anchored comment draft opens with the selected text quoted |
| Annotating | Click empty page space | A numbered point pin and comment composer appear |
| Annotating | Drag across the page | A translucent rectangular review region and comment composer appear |
| Annotating | Submit a comment | The normalized anchor, highlight, numbered pin, and comment card persist in React state |

The toolbar also includes page navigation, zoom controls, a mode switch, a per-page comment count, and local PDF upload. The included AI response is intentionally simulated because this demo is static and does not contain backend credentials.

## Run locally

```bash
pnpm install
pnpm dev
```

Production verification commands are:

```bash
pnpm test:compat
pnpm check
pnpm build
```

All three commands pass in the delivered version. `test:compat` removes the recent Promise and AbortSignal APIs from the test runtime before loading PDF.js, which guards the older-iOS Safari path that originally failed during TextLayer initialization.

## Browser compatibility

The viewer uses the official PDF.js legacy display and worker builds. This is intentional: recent PDF.js modern builds call `Promise.withResolvers()`, which is unavailable in Safari and iOS Safari before 17.4. The legacy build installs the required Promise compatibility methods, while `client/src/lib/pdfjs-compat.ts` supplies the remaining `AbortSignal.any()` behavior before PDF.js is evaluated.

## Important files

| File | Responsibility |
|---|---|
| `client/src/components/PdfReviewWorkspace.tsx` | PDF loading, worker setup, toolbar, upload, page/zoom/mode state, and persisted comments |
| `client/src/components/PdfReviewPage.tsx` | Canvas rendering, PDF.js TextLayer, selection geometry, text hit-testing, point/area/text anchors, composers, pins, and comment cards |
| `client/src/lib/pdfjs-compat.ts` | Minimal `AbortSignal.any()` fallback required by the PDF.js legacy display build on older Safari |
| `client/src/types/pdf-review.ts` | Normalized coordinate and annotation types |
| `client/src/index.css` | Complete Codex/editor-inspired visual system and responsive behavior |
| `client/src/pages/Home.tsx` | Demo entry page |

## Architecture

Each PDF page is rendered into a high-DPI Canvas. PDF.js also renders an invisible DOM TextLayer over the Canvas. In default mode, browser selection produces a `Range`; its client rectangles become the selected anchor and determine the popover position. In annotating mode, the page owns pointer events. Text item rectangles are cached after TextLayer rendering, and pointer movement selects one unique hit target by containment, area, and content order.

Annotations are stored with normalized page coordinates rather than viewport pixels. A point is stored as `x / pageWidth` and `y / pageHeight`; rectangles use normalized `x`, `y`, `width`, and `height`. This allows the highlights and pins to remain aligned when zoom changes.

## Moving this into the existing app

The current `WebPdfViewer.tsx` can remain as the fast standard preview. Add the new viewer as an interactive mode and switch between them at the parent `PdfPreviewer` level. The Chrome iframe should not be nested underneath this TextLayer implementation; the interactive mode should own PDF rendering completely.

In the existing application, replace the sample URL with `data.pdfFile` or `data.url`. A `File` can be loaded through an object URL as shown in `PdfReviewWorkspace.tsx`. Remote URLs must either return suitable CORS headers or be fetched through the application’s authenticated file proxy before being passed to PDF.js.

For production AI calls, send the selected text, nearby paragraph, page number, normalized rectangles, and document identifier to the existing AI backend. Persist `PdfAnnotation` records in the application store or database instead of component state. The current local simulated response makes the UI flow testable without introducing an API dependency.

## Current demo boundaries

This demo stores comments only for the current browser session and does not write annotations back into the PDF file. Scanned PDFs without a text layer still support point and rectangle comments, but text Hover requires OCR geometry. Production-scale documents should virtualize pages and build the text hit index only for visible pages.
