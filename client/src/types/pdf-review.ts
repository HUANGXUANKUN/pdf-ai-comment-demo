export type ViewerMode = "ask" | "annotate";

export type AnnotationKind = "point" | "area" | "text";

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfAnnotation {
  id: string;
  number: number;
  pageNumber: number;
  kind: AnnotationKind;
  comment: string;
  selectedText?: string;
  point?: NormalizedPoint;
  rects: NormalizedRect[];
  createdAt: number;
}

export interface TextHitTarget {
  id: string;
  text: string;
  order: number;
  rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}
