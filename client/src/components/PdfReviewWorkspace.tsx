import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageSquareText,
  Minus,
  MousePointer2,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import "@/lib/pdfjs-compat";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { useEffect, useMemo, useRef, useState } from "react";
import { PdfReviewPage } from "./PdfReviewPage";
import type { PdfAnnotation, ViewerMode } from "@/types/pdf-review";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SAMPLE_PDF_URL = "/manus-storage/pdf-ai-comment-sample_14db2300.pdf";
const MIN_SCALE = 0.72;
const MAX_SCALE = 1.55;
const SCALE_STEP = 0.1;

interface SourceState {
  url: string;
  name: string;
  isObjectUrl: boolean;
}

function ToolbarIconButton({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="toolbar-icon-button"
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ViewerSkeleton() {
  return (
    <div className="viewer-skeleton" aria-label="Loading PDF">
      <div className="viewer-skeleton__paper">
        <div className="viewer-skeleton__line viewer-skeleton__line--title" />
        <div className="viewer-skeleton__line" />
        <div className="viewer-skeleton__line viewer-skeleton__line--short" />
        <div className="viewer-skeleton__line" />
        <div className="viewer-skeleton__line viewer-skeleton__line--medium" />
      </div>
    </div>
  );
}

export function PdfReviewWorkspace() {
  const [source, setSource] = useState<SourceState>({
    url: SAMPLE_PDF_URL,
    name: "TraceMonkey research paper.pdf",
    isObjectUrl: false,
  });
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.08);
  const [mode, setMode] = useState<ViewerMode>("ask");
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;

    setPdfDocument(null);
    setLoadError(null);
    setLoadProgress(0);
    setPageNumber(1);

    task = getDocument({ url: source.url });
    task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      if (!cancelled && total > 0) {
        setLoadProgress(Math.round((loaded / total) * 100));
      }
    };

    task.promise
      .then((document) => {
        if (!cancelled) {
          setPdfDocument(document);
          setLoadProgress(100);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load this PDF.");
        }
      });

    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [source.url]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const visibleAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.pageNumber === pageNumber),
    [annotations, pageNumber],
  );

  const zoomOut = () => {
    setScale((value) => Math.max(MIN_SCALE, Number((value - SCALE_STEP).toFixed(2))));
  };

  const zoomIn = () => {
    setScale((value) => Math.min(MAX_SCALE, Number((value + SCALE_STEP).toFixed(2))));
  };

  const openFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setLoadError("Please choose a PDF file.");
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setSource({ url, name: file.name, isObjectUrl: true });
    setAnnotations([]);
    setActiveAnnotationId(null);
  };

  const addAnnotation = (
    annotation: Omit<PdfAnnotation, "id" | "createdAt">,
  ) => {
    const created: PdfAnnotation = {
      ...annotation,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setAnnotations((current) => [...current, created]);
    setActiveAnnotationId(created.id);
  };

  return (
    <main className="review-app-shell">
      <header className="review-toolbar">
        <div className="review-toolbar__file">
          <ToolbarIconButton label="Back to files" onClick={() => window.history.back()}>
            <ArrowLeft size={17} />
          </ToolbarIconButton>
          <div className="review-toolbar__file-icon"><FileText size={17} /></div>
          <div className="review-toolbar__file-copy">
            <strong>{source.name}</strong>
            <span>{pdfDocument ? `${pdfDocument.numPages} pages` : `Loading ${loadProgress}%`}</span>
          </div>
        </div>

        <div className="review-toolbar__controls">
          <div className="toolbar-group" aria-label="Page navigation">
            <ToolbarIconButton
              label="Previous page"
              disabled={!pdfDocument || pageNumber <= 1}
              onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft size={16} />
            </ToolbarIconButton>
            <span className="toolbar-readout">
              <strong>{pageNumber}</strong>
              <span>/</span>
              <span>{pdfDocument?.numPages ?? "—"}</span>
            </span>
            <ToolbarIconButton
              label="Next page"
              disabled={!pdfDocument || pageNumber >= pdfDocument.numPages}
              onClick={() => setPageNumber((page) => Math.min(pdfDocument?.numPages ?? page, page + 1))}
            >
              <ChevronRight size={16} />
            </ToolbarIconButton>
          </div>

          <div className="toolbar-group" aria-label="Zoom controls">
            <ToolbarIconButton label="Zoom out" disabled={scale <= MIN_SCALE} onClick={zoomOut}>
              <Minus size={15} />
            </ToolbarIconButton>
            <span className="toolbar-readout toolbar-readout--zoom">{Math.round(scale * 100)}%</span>
            <ToolbarIconButton label="Zoom in" disabled={scale >= MAX_SCALE} onClick={zoomIn}>
              <Plus size={15} />
            </ToolbarIconButton>
          </div>
        </div>

        <div className="review-toolbar__actions">
          <div className="mode-switch" role="group" aria-label="Viewer mode">
            <button
              type="button"
              data-active={mode === "ask"}
              onClick={() => setMode("ask")}
            >
              <Sparkles size={14} />
              Ask
            </button>
            <button
              type="button"
              data-active={mode === "annotate"}
              onClick={() => setMode("annotate")}
            >
              <MousePointer2 size={14} />
              Annotating
            </button>
          </div>

          <div className="comment-count" title="Comments on this page">
            <MessageSquareText size={15} />
            <span>{visibleAnnotations.length}</span>
          </div>

          <button className="open-pdf-button" type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} />
            Open PDF
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              openFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </header>

      <section className="review-stage">
        <div className="mode-hint" data-mode={mode}>
          {mode === "ask" ? (
            <><Sparkles size={13} /> Select text to ask AI in place</>
          ) : (
            <><MousePointer2 size={13} /> Hover text, click a point, or drag a box to comment</>
          )}
        </div>

        {loadError ? (
          <div className="viewer-error-card">
            <FileText size={24} />
            <div>
              <strong>Unable to open this PDF</strong>
              <p>{loadError}</p>
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()}>Choose another file</button>
          </div>
        ) : !pdfDocument ? (
          <ViewerSkeleton />
        ) : (
          <PdfReviewPage
            key={`${source.url}-${pageNumber}-${scale}`}
            document={pdfDocument}
            pageNumber={pageNumber}
            scale={scale}
            mode={mode}
            annotations={annotations}
            nextAnnotationNumber={annotations.length + 1}
            onAddAnnotation={addAnnotation}
            activeAnnotationId={activeAnnotationId}
            onActiveAnnotationChange={setActiveAnnotationId}
          />
        )}
      </section>

      <footer className="review-statusbar">
        <span><span className="status-dot" /> PDF.js text layer connected</span>
        <span>{mode === "ask" ? "Default mode" : "Annotation mode"}</span>
        <span>{annotations.length} saved {annotations.length === 1 ? "comment" : "comments"}</span>
      </footer>
    </main>
  );
}
