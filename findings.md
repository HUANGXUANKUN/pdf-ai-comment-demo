# Findings

## Uploaded reference video

The recording is approximately 26.85 seconds, portrait 1294×1934. It shows a PDF/document review interface with a compact top toolbar and a centered white document on a neutral gray workspace.

Default mode uses native-looking text selection. After the selection completes, a small contextual “Ask ChatGPT” style composer appears close to the selected text. The interaction is inline and context-bound rather than using a permanent sidebar.

Annotating mode supports three anchors: a single-point pin, a dragged rectangle with translucent blue fill and blue border, and a text-range highlight with a numbered blue pin. Completing an anchor opens a nearby comment composer. Cancel removes the draft anchor; submitting persists the numbered marker.

Visual treatment is restrained: blue around #2563eb, translucent selection fill around rgba(37, 99, 235, 0.16–0.22), text highlight radius around 2px, rectangle radius around 4px, and very short fade/scale transitions.

## Existing `WebPdfViewer.tsx`

The user’s current viewer is an iframe loading a PDF URL. An absolutely-positioned React toolbar covers the right side of Chrome’s internal PDF Viewer toolbar. The outer React app cannot reliably access the internal PDF text geometry, selection, zoom, page scroll state, or DOM due to Chromium’s internal viewer isolation. Therefore precise text hover and anchored annotations require a custom viewer.

## Demo implementation approach

Use `pdfjs-dist` to render each page to Canvas and to create a DOM text layer. Use the text layer’s rendered spans as the source for text hit boxes. Page-level pointer handling performs unique text hit-testing and displays a lightweight hover highlight without binding thousands of independent React event handlers.

Persist annotations in normalized page coordinates. Render rectangle and point annotations in a transparent overlay. Text annotations are saved as normalized rectangles derived from `Range.getClientRects()`. This permits zooming without losing anchors.

Use the official Mozilla PDF.js sample PDF for initial content, while allowing the user to upload a local PDF for testing.
