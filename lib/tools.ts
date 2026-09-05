export type ToolSlug =
  | "merge-pdf"
  | "split-pdf"
  | "images-to-pdf"
  | "docx-to-pdf"
  | "pdf-to-jpg"
  | "rotate-pdf"
  | "compress-pdf";

export interface FolioTool {
  slug: ToolSlug;
  name: string;
  shortName: string;
  description: string;
  longDescription: string;
  accepts: string;
  acceptMime: string[];
  multiple: boolean;
  maxFiles: number;
  maxFileBytes: number;
  processing: "local";
  badge?: string;
}

export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_DOCX_BYTES = 50 * 1024 * 1024;

export const TOOLS: FolioTool[] = [
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    shortName: "Merge",
    description: "Combine multiple PDFs into one document, in your order.",
    longDescription:
      "Select two or more PDF files, drag to reorder them, then merge into a single downloadable PDF.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: true,
    maxFiles: 20,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    shortName: "Split",
    description: "Extract pages or page ranges into a new PDF.",
    longDescription:
      "Upload one PDF and describe the pages to keep, e.g. 1-3,5,8-10. Only those pages are included in the download.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
  },
  {
    slug: "images-to-pdf",
    name: "JPG / PNG to PDF",
    shortName: "Images",
    description: "Turn JPG or PNG images into a clean PDF, one per page.",
    longDescription:
      "Add JPG or PNG images, reorder them, and generate a PDF with one image per page, fitted to the page without distortion.",
    accepts: ".jpg,.jpeg,.png",
    acceptMime: ["image/jpeg", "image/png"],
    multiple: true,
    maxFiles: 30,
    maxFileBytes: MAX_IMAGE_BYTES,
    processing: "local",
  },
  {
    slug: "docx-to-pdf",
    name: "DOCX to PDF",
    shortName: "DOCX",
    description: "Convert Word documents to PDF with formatting preserved.",
    longDescription:
      "Convert a .docx file to PDF in your browser. Headings, bold/italic, lists, tables and images are preserved as faithfully as client-side conversion allows.",
    accepts: ".docx",
    acceptMime: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_DOCX_BYTES,
    processing: "local",
    badge: "Beta",
  },
  {
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    shortName: "To JPG",
    description: "Render PDF pages as JPG images, in a ZIP download.",
    longDescription:
      "Render every page of a PDF to a JPG image. Single pages download directly; multi-page documents arrive as a ZIP archive.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
  },
  {
    slug: "rotate-pdf",
    name: "Rotate PDF",
    shortName: "Rotate",
    description: "Rotate all pages, or selected pages, by 90° steps.",
    longDescription:
      "Rotate every page of a PDF, or just the pages you list, clockwise by 90, 180 or 270 degrees.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
  },
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    shortName: "Compress",
    description: "Shrink PDFs where possible and see honest before/after sizes.",
    longDescription:
      "Rewrite a PDF with optimized object streams and cleaned metadata. Folio always shows the original and resulting size — if nothing can be saved, it says so.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
    badge: "Honest",
  },
];

export function getTool(slug: string): FolioTool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
