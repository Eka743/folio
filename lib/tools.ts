export const PUBLIC_WEB_TOOL_SLUGS = [
  "merge-pdf",
  "split-pdf",
  "images-to-pdf",
  "docx-to-pdf",
  "pdf-to-jpg",
  "rotate-pdf",
  "compress-pdf",
  "markdown-to-pdf",
  "pdf-to-markdown",
] as const;

export type ToolSlug = (typeof PUBLIC_WEB_TOOL_SLUGS)[number];

/** Historical native routes kept only so old bookmarks can redirect cleanly. */
export const LEGACY_TOOL_SLUGS = [
  "word-to-pdf",
  "pages-to-pdf",
  "pages-to-word",
  "powerpoint-to-pdf",
  "keynote-to-pdf",
  "keynote-to-powerpoint",
  "excel-to-pdf",
  "numbers-to-pdf",
  "numbers-to-excel",
] as const;

export type LegacyToolSlug = (typeof LEGACY_TOOL_SLUGS)[number];
export type ToolCategory = "PDF" | "Documents" | "Images";

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
  category: ToolCategory;
  badge?: string;
}

export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_DOCX_BYTES = 50 * 1024 * 1024;
export const MAX_MARKDOWN_BYTES = 10 * 1024 * 1024;

const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const TOOLS: FolioTool[] = [
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    shortName: "Merge",
    description: "Combine multiple PDFs into one document, in your order.",
    longDescription:
      "Select two or more PDF files, drag to reorder them, then merge them into one downloadable PDF.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: true,
    maxFiles: 20,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
    category: "PDF",
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    shortName: "Split",
    description: "Extract pages or page ranges into a new PDF.",
    longDescription:
      "Select a PDF and describe the pages to keep, for example 1-3,5,8-10. Only those pages are included in the download.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
    category: "PDF",
  },
  {
    slug: "images-to-pdf",
    name: "JPG / PNG to PDF",
    shortName: "Images",
    description: "Turn JPG or PNG images into a clean PDF, one per page.",
    longDescription:
      "Add JPG or PNG images, reorder them, and generate a PDF with one image per page, fitted without distortion.",
    accepts: ".jpg,.jpeg,.png",
    acceptMime: ["image/jpeg", "image/png"],
    multiple: true,
    maxFiles: 30,
    maxFileBytes: MAX_IMAGE_BYTES,
    processing: "local",
    category: "Images",
  },
  {
    slug: "docx-to-pdf",
    name: "Word to PDF",
    shortName: "DOCX",
    description: "Convert a .docx file to PDF in your browser. Beta.",
    longDescription:
      "Convert a .docx file in your browser. Headings, lists, tables and images are supported, but complex Word layouts and pagination may differ.",
    accepts: ".docx",
    acceptMime: [MIME_DOCX],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_DOCX_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
  {
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    shortName: "To JPG",
    description: "Render PDF pages as JPG images, in a ZIP download.",
    longDescription:
      "Render every page of a PDF to a JPG image. Single pages download directly; multi-page documents arrive in a ZIP archive.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
    category: "PDF",
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
    category: "PDF",
  },
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    shortName: "Compress",
    description: "Shrink PDFs where possible and see honest before/after sizes.",
    longDescription:
      "Rewrite a PDF with optimized object streams and cleaned metadata. Folio shows the original and resulting size, even when the file barely shrinks.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
    category: "PDF",
  },
  {
    slug: "markdown-to-pdf",
    name: "Markdown to PDF",
    shortName: "Markdown",
    description: "Turn Markdown into a polished, downloadable PDF.",
    longDescription:
      "Convert a Markdown file into a clean A4 PDF with headings, lists, code, tables and safe local rendering.",
    accepts: ".md,.markdown",
    acceptMime: ["text/markdown"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_MARKDOWN_BYTES,
    processing: "local",
    category: "Documents",
  },
  {
    slug: "pdf-to-markdown",
    name: "PDF to Markdown",
    shortName: "PDF to MD",
    description: "Extract useful Markdown from text-based PDFs.",
    longDescription:
      "Extract readable text and conservative list and heading structure from a PDF. Scanned PDFs need OCR, which Folio does not provide.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
];

export function getTool(slug: string): FolioTool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function isRetiredToolSlug(slug: string): slug is LegacyToolSlug {
  return (LEGACY_TOOL_SLUGS as readonly string[]).includes(slug);
}
