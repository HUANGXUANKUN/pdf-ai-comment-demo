import { LoaderCircle, MessageSquarePlus, Sparkles, X } from "lucide-react";
import {
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageViewport,
} from "pdfjs-dist";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  AnnotationKind,
  NormalizedPoint,
  NormalizedRect,
  PdfAnnotation,
  TextHitTarget,
  ViewerMode,
} from "@/types/pdf-review";

interface DraftAnchor {
  kind: AnnotationKind;
  pageNumber: number;
  point?: NormalizedPoint;
  rects: NormalizedRect[];
  selectedText?: string;
  popover: {
    x: number;
    y: number;
    placement: "above" | "below";
  };
}

interface AskAnchor {
  selectedText: string;
  rects: NormalizedRect[];
  popover: {
    x: number;
    y: number;
    placement: "above" | "below";
  };
}

interface PdfReviewPageProps {
  document: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  mode: ViewerMode;
  annotations: PdfAnnotation[];
  nextAnnotationNumber: number;
  onAddAnnotation: (annotation: Omit<PdfAnnotation, "id" | "createdAt">) => void;
  onActiveAnnotationChange: (id: string | null) => void;
  activeAnnotationId: string | null;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startedOnText: boolean;
}

interface RenderState {
  page: PDFPageProxy;
  viewport: PageViewport;
}

const DRAG_THRESHOLD = 6;
const POPOVER_WIDTH = 340;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pointInRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number },
) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

function rectArea(rect: { width: number; height: number }) {
  return rect.width * rect.height;
}

function normalizeRect(
  rect: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
): NormalizedRect {
  return {
    x: rect.x / width,
    y: rect.y / height,
    width: rect.width / width,
    height: rect.height / height,
  };
}

function normalizePoint(
  point: { x: number; y: number },
  width: number,
  height: number,
): NormalizedPoint {
  return {
    x: point.x / width,
    y: point.y / height,
  };
}

function toPageRect(rect: NormalizedRect, width: number, height: number) {
  return {
    x: rect.x * width,
    y: rect.y * height,
    width: rect.width * width,
    height: rect.height * height,
  };
}

function getSelectionText(selection: Selection) {
  return selection.toString().replace(/\s+/g, " ").trim();
}

function isNodeInside(container: HTMLElement, node: Node | null) {
  return Boolean(node && (node === container || container.contains(node)));
}

function getSelectionRects(
  selection: Selection,
  pageElement: HTMLElement,
): { text: string; rects: Array<{ x: number; y: number; width: number; height: number }> } | null {
  if (!selection.rangeCount || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (
    !isNodeInside(pageElement, range.startContainer) ||
    !isNodeInside(pageElement, range.endContainer)
  ) {
    return null;
  }

  const text = getSelectionText(selection);
  if (!text) return null;

  const pageBox = pageElement.getBoundingClientRect();
  const rects = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 1 && rect.height > 1)
    .map((rect) => ({
      x: rect.left - pageBox.left,
      y: rect.top - pageBox.top,
      width: rect.width,
      height: rect.height,
    }));

  if (!rects.length) return null;
  return { text, rects };
}

function choosePopoverPosition(
  rects: Array<{ x: number; y: number; width: number; height: number }>,
  pageWidth: number,
) {
  const first = rects[0];
  const last = rects[rects.length - 1];
  const top = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const x = clamp((first.x + maxX) / 2, POPOVER_WIDTH / 2 + 12, pageWidth - POPOVER_WIDTH / 2 - 12);
  const placement = top > 190 ? "above" : "below";
  const y = placement === "above" ? top - 12 : last.y + last.height + 12;
  return { x, y, placement } as const;
}

function buildTextTargets(textLayer: TextLayer, pageElement: HTMLElement) {
  const pageBox = pageElement.getBoundingClientRect();
  return textLayer.textDivs
    .map((element, order): TextHitTarget | null => {
      const text = textLayer.textContentItemsStr[order]?.replace(/\s+/g, " ").trim();
      if (!text || element.getAttribute("role") === "img") return null;

      const clientRects = Array.from(element.getClientRects())
        .filter((rect) => rect.width > 1 && rect.height > 1)
        .map((rect) => ({
          x: rect.left - pageBox.left,
          y: rect.top - pageBox.top,
          width: rect.width,
          height: rect.height,
        }));

      if (!clientRects.length) return null;
      return {
        id: `text-${order}`,
        text,
        order,
        rects: clientRects,
      };
    })
    .filter((item): item is TextHitTarget => item !== null);
}

function findTextTarget(
  targets: TextHitTarget[],
  x: number,
  y: number,
): TextHitTarget | null {
  const candidates = targets.filter((target) =>
    target.rects.some((rect) => pointInRect(x, y, rect)),
  );

  candidates.sort((a, b) => {
    const areaA = a.rects.reduce((total, rect) => total + rectArea(rect), 0);
    const areaB = b.rects.reduce((total, rect) => total + rectArea(rect), 0);
    if (areaA !== areaB) return areaA - areaB;
    return b.order - a.order;
  });

  return candidates[0] ?? null;
}

function ContextComposer({
  variant,
  selectedText,
  position,
  initialValue = "",
  onCancel,
  onSubmit,
}: {
  variant: "ask" | "comment";
  selectedText?: string;
  position: DraftAnchor["popover"];
  initialValue?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    window.setTimeout(() => onSubmit(trimmed), variant === "ask" ? 650 : 180);
  };

  return (
    <div
      className="context-composer"
      data-placement={position.placement}
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="context-composer__header">
        <div className="context-composer__title">
          {variant === "ask" ? <Sparkles size={14} /> : <MessageSquarePlus size={14} />}
          <span>{variant === "ask" ? "Ask AI about this" : "Add comment"}</span>
        </div>
        <button aria-label="Cancel" className="context-composer__close" onClick={onCancel}>
          <X size={14} />
        </button>
      </div>

      {selectedText && (
        <div className="context-composer__quote">“{selectedText.slice(0, 145)}{selectedText.length > 145 ? "…" : ""}”</div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        rows={2}
        placeholder={variant === "ask" ? "Ask a question or request a rewrite…" : "Leave a review comment…"}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit();
          if (event.key === "Escape") onCancel();
        }}
      />

      <div className="context-composer__footer">
        <span>⌘ Enter to submit</span>
        <button disabled={!value.trim() || submitting} onClick={submit}>
          {submitting && <LoaderCircle size={13} className="animate-spin" />}
          {variant === "ask" ? "Ask" : "Comment"}
        </button>
      </div>
    </div>
  );
}

function AiResponse({
  position,
  question,
  selectedText,
  onClose,
}: {
  position: AskAnchor["popover"];
  question: string;
  selectedText: string;
  onClose: () => void;
}) {
  return (
    <div
      className="ai-response-card"
      data-placement={position.placement}
      style={{ left: position.x, top: position.y }}
    >
      <div className="ai-response-card__header">
        <span className="ai-response-card__badge"><Sparkles size={12} /> AI</span>
        <button aria-label="Close answer" onClick={onClose}><X size={14} /></button>
      </div>
      <p className="ai-response-card__question">{question}</p>
      <p>
        This passage focuses on <strong>{selectedText.split(" ").slice(0, 6).join(" ")}</strong>. In a production build, this card would send the selected text, nearby paragraph, page number, and PDF coordinates to your AI service.
      </p>
    </div>
  );
}

export function PdfReviewPage({
  document,
  pageNumber,
  scale,
  mode,
  annotations,
  nextAnnotationNumber,
  onAddAnnotation,
  onActiveAnnotationChange,
  activeAnnotationId,
}: PdfReviewPageProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const textLayerInstanceRef = useRef<TextLayer | null>(null);
  const [renderState, setRenderState] = useState<RenderState | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [textTargets, setTextTargets] = useState<TextHitTarget[]>([]);
  const [hoverTarget, setHoverTarget] = useState<TextHitTarget | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [draft, setDraft] = useState<DraftAnchor | null>(null);
  const [askAnchor, setAskAnchor] = useState<AskAnchor | null>(null);
  const [aiResponse, setAiResponse] = useState<{
    anchor: AskAnchor;
    question: string;
  } | null>(null);

  useEffect(() => {
    setDraft(null);
    setAskAnchor(null);
    setAiResponse(null);
    setHoverTarget(null);
  }, [mode, pageNumber, scale]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<PDFPageProxy["render"]> | null = null;
    let textLayer: TextLayer | null = null;

    const renderPage = async () => {
      setRenderError(null);
      setRenderState(null);
      const page = await document.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const textContainer = textLayerRef.current;
      const pageElement = pageRef.current;
      if (!canvas || !textContainer || !pageElement) return;

      setRenderState({ page, viewport });

      const outputScale = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      renderTask = page.render({
        canvas,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      await renderTask.promise;
      if (cancelled) return;

      textContainer.replaceChildren();
      const textContent = await page.getTextContent();
      if (cancelled) return;

      textLayer = new TextLayer({
        textContentSource: textContent,
        container: textContainer,
        viewport,
      });
      textLayerInstanceRef.current = textLayer;
      await textLayer.render();
      if (cancelled) return;

      await globalThis.document.fonts?.ready;
      requestAnimationFrame(() => {
        if (!cancelled && pageRef.current) {
          setTextTargets(buildTextTargets(textLayer!, pageRef.current));
        }
      });
    };

    renderPage().catch((error: unknown) => {
      if (!cancelled) {
        setRenderError(error instanceof Error ? error.message : "Unable to render this PDF page.");
      }
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
      textLayerInstanceRef.current = null;
    };
  }, [document, pageNumber, scale]);

  useLayoutEffect(() => {
    if (!renderState || !pageRef.current) return;
    const { viewport } = renderState;
    pageRef.current.style.setProperty("--scale-factor", String(viewport.scale));
    pageRef.current.style.setProperty("--user-unit", String(viewport.userUnit));
  }, [renderState]);

  const pageSize = useMemo(() => {
    if (!renderState) return { width: 680, height: 880 };
    return {
      width: renderState.viewport.width,
      height: renderState.viewport.height,
    };
  }, [renderState]);

  const pageAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.pageNumber === pageNumber),
    [annotations, pageNumber],
  );

  const localPoint = useCallback((clientX: number, clientY: number) => {
    const pageBox = pageRef.current?.getBoundingClientRect();
    if (!pageBox) return { x: 0, y: 0 };
    return {
      x: clamp(clientX - pageBox.left, 0, pageBox.width),
      y: clamp(clientY - pageBox.top, 0, pageBox.height),
    };
  }, []);

  const handleDefaultSelection = useCallback(() => {
    if (mode !== "ask" || !pageRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    const result = getSelectionRects(selection, pageRef.current);
    if (!result) return;

    const { width, height } = pageRef.current.getBoundingClientRect();
    onActiveAnnotationChange(null);
    setAiResponse(null);
    setAskAnchor({
      selectedText: result.text,
      rects: result.rects.map((rect) => normalizeRect(rect, width, height)),
      popover: choosePopoverPosition(result.rects, width),
    });
  }, [mode, onActiveAnnotationChange]);

  const createDraftFromText = useCallback((target: TextHitTarget) => {
    const pageElement = pageRef.current;
    if (!pageElement) return;
    onActiveAnnotationChange(null);
    const { width, height } = pageElement.getBoundingClientRect();
    const selection = window.getSelection();
    const selectionResult = selection ? getSelectionRects(selection, pageElement) : null;
    const text = selectionResult?.text || target.text;
    const rects = selectionResult?.rects || target.rects;

    setDraft({
      kind: "text",
      pageNumber,
      selectedText: text,
      rects: rects.map((rect) => normalizeRect(rect, width, height)),
      popover: choosePopoverPosition(rects, width),
    });
  }, [onActiveAnnotationChange, pageNumber]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== "annotate" || draft) return;
    const point = localPoint(event.clientX, event.clientY);
    const target = findTextTarget(textTargets, point.x, point.y);
    setHoverTarget(target);

    if (dragState && dragState.pointerId === event.pointerId) {
      setDragState((current) =>
        current
          ? { ...current, currentX: point.x, currentY: point.y }
          : null,
      );
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== "annotate" || draft || event.button !== 0) return;
    onActiveAnnotationChange(null);
    const point = localPoint(event.clientX, event.clientY);
    const target = findTextTarget(textTargets, point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      startedOnText: Boolean(target),
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mode !== "annotate" || !dragState || dragState.pointerId !== event.pointerId) return;
    const point = localPoint(event.clientX, event.clientY);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    const distance = Math.hypot(deltaX, deltaY);
    const pageElement = pageRef.current;
    if (!pageElement) return;
    const { width, height } = pageElement.getBoundingClientRect();

    if (distance >= DRAG_THRESHOLD) {
      const box = {
        x: Math.min(dragState.startX, point.x),
        y: Math.min(dragState.startY, point.y),
        width: Math.abs(deltaX),
        height: Math.abs(deltaY),
      };
      setDraft({
        kind: "area",
        pageNumber,
        rects: [normalizeRect(box, width, height)],
        popover: choosePopoverPosition([box], width),
      });
    } else {
      const target = findTextTarget(textTargets, point.x, point.y);
      if (target) {
        createDraftFromText(target);
      } else {
        const normalizedPoint = normalizePoint(point, width, height);
        setDraft({
          kind: "point",
          pageNumber,
          point: normalizedPoint,
          rects: [],
          popover: {
            x: clamp(point.x + 18, POPOVER_WIDTH / 2 + 12, width - POPOVER_WIDTH / 2 - 12),
            y: point.y + 18,
            placement: point.y > height * 0.68 ? "above" : "below",
          },
        });
      }
    }

    setDragState(null);
  };

  const submitComment = (comment: string) => {
    if (!draft) return;
    onAddAnnotation({
      number: nextAnnotationNumber,
      pageNumber,
      kind: draft.kind,
      comment,
      selectedText: draft.selectedText,
      point: draft.point,
      rects: draft.rects,
    });
    setDraft(null);
    setHoverTarget(null);
    window.getSelection()?.removeAllRanges();
  };

  const dragRect = useMemo(() => {
    if (!dragState) return null;
    return {
      x: Math.min(dragState.startX, dragState.currentX),
      y: Math.min(dragState.startY, dragState.currentY),
      width: Math.abs(dragState.currentX - dragState.startX),
      height: Math.abs(dragState.currentY - dragState.startY),
    };
  }, [dragState]);

  const draftRects = draft?.rects.map((rect) => toPageRect(rect, pageSize.width, pageSize.height)) ?? [];
  const askRects = askAnchor?.rects.map((rect) => toPageRect(rect, pageSize.width, pageSize.height)) ?? [];
  const responseRects = aiResponse?.anchor.rects.map((rect) => toPageRect(rect, pageSize.width, pageSize.height)) ?? [];

  const pageStyle = {
    width: pageSize.width,
    height: pageSize.height,
    "--scale-factor": renderState?.viewport.scale ?? scale,
    "--user-unit": renderState?.viewport.userUnit ?? 1,
  } as CSSProperties;

  return (
    <div className="pdf-page-shell">
      <div
        ref={pageRef}
        className="pdf-review-page"
        style={pageStyle}
        data-mode={mode}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDragState(null)}
        onMouseUp={handleDefaultSelection}
      >
        <canvas ref={canvasRef} className="pdf-canvas" />
        <div ref={textLayerRef} className="textLayer pdf-text-layer" />

        <div className="annotation-visual-layer" aria-hidden="true">
          {pageAnnotations.map((annotation) => {
            const rects = annotation.rects.map((rect) => toPageRect(rect, pageSize.width, pageSize.height));
            const point = annotation.point
              ? {
                  x: annotation.point.x * pageSize.width,
                  y: annotation.point.y * pageSize.height,
                }
              : null;
            const anchorRect = rects.at(-1);
            const pinX = point?.x ?? (anchorRect ? anchorRect.x + anchorRect.width : 0);
            const pinY = point?.y ?? (anchorRect ? anchorRect.y + anchorRect.height : 0);

            return (
              <div key={annotation.id}>
                {rects.map((rect, index) => (
                  <div
                    key={`${annotation.id}-${index}`}
                    className={`saved-annotation saved-annotation--${annotation.kind}`}
                    data-active={activeAnnotationId === annotation.id}
                    style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                  />
                ))}
                <button
                  className="annotation-pin"
                  data-active={activeAnnotationId === annotation.id}
                  style={{ left: pinX, top: pinY }}
                  aria-label={`Comment ${annotation.number}: ${annotation.comment}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseEnter={() => onActiveAnnotationChange(annotation.id)}
                  onMouseLeave={() => onActiveAnnotationChange(null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onActiveAnnotationChange(activeAnnotationId === annotation.id ? null : annotation.id);
                  }}
                >
                  {annotation.number}
                </button>
                {activeAnnotationId === annotation.id && (
                  <div
                    className="saved-comment-card"
                    style={{ left: clamp(pinX + 18, 160, pageSize.width - 160), top: pinY + 12 }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <div className="saved-comment-card__meta">Comment {annotation.number}</div>
                    {annotation.selectedText && (
                      <div className="saved-comment-card__quote">“{annotation.selectedText.slice(0, 100)}{annotation.selectedText.length > 100 ? "…" : ""}”</div>
                    )}
                    <p>{annotation.comment}</p>
                  </div>
                )}
              </div>
            );
          })}

          {mode === "annotate" && hoverTarget && !dragState && !draft && (
            <>
              {hoverTarget.rects.map((rect, index) => (
                <div
                  key={`${hoverTarget.id}-${index}`}
                  className="text-hover-highlight"
                  style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                />
              ))}
              <div
                className="text-hover-label"
                style={{
                  left: hoverTarget.rects[0].x,
                  top: Math.max(8, hoverTarget.rects[0].y - 28),
                }}
              >
                Click to comment
              </div>
            </>
          )}

          {dragRect && dragRect.width >= 2 && dragRect.height >= 2 && (
            <div
              className="draft-area-highlight"
              style={{ left: dragRect.x, top: dragRect.y, width: dragRect.width, height: dragRect.height }}
            />
          )}

          {draftRects.map((rect, index) => (
            <div
              key={`draft-${index}`}
              className={`draft-anchor-highlight draft-anchor-highlight--${draft?.kind}`}
              style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            />
          ))}

          {draft?.kind === "point" && draft.point && (
            <div
              className="draft-point-pin"
              style={{ left: draft.point.x * pageSize.width, top: draft.point.y * pageSize.height }}
            >
              {nextAnnotationNumber}
            </div>
          )}

          {(askAnchor ? askRects : responseRects).map((rect, index) => (
            <div
              key={`ask-${index}`}
              className="ask-selection-highlight"
              style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            />
          ))}
        </div>

        {draft && (
          <ContextComposer
            key={`${draft.kind}-${draft.popover.x}-${draft.popover.y}`}
            variant="comment"
            selectedText={draft.selectedText}
            position={draft.popover}
            onCancel={() => {
              setDraft(null);
              window.getSelection()?.removeAllRanges();
            }}
            onSubmit={submitComment}
          />
        )}

        {askAnchor && !aiResponse && (
          <ContextComposer
            key={`${askAnchor.selectedText}-${askAnchor.popover.x}`}
            variant="ask"
            selectedText={askAnchor.selectedText}
            position={askAnchor.popover}
            onCancel={() => {
              setAskAnchor(null);
              window.getSelection()?.removeAllRanges();
            }}
            onSubmit={(question) => {
              setAiResponse({ anchor: askAnchor, question });
              setAskAnchor(null);
              window.getSelection()?.removeAllRanges();
            }}
          />
        )}

        {aiResponse && (
          <AiResponse
            position={aiResponse.anchor.popover}
            question={aiResponse.question}
            selectedText={aiResponse.anchor.selectedText}
            onClose={() => setAiResponse(null)}
          />
        )}

        {!renderState && !renderError && (
          <div className="pdf-page-loading">
            <LoaderCircle className="animate-spin" size={24} />
            <span>Rendering text layer…</span>
          </div>
        )}

        {renderError && (
          <div className="pdf-page-error">
            <strong>Couldn’t render this page</strong>
            <span>{renderError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
