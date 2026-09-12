export const PUBLIC_WEB_TOOL_SLUGS = [
  "merge-pdf",
  "split-pdf",
  "images-to-pdf",
  "docx-to-pdf",
  "pages-to-word",
  "powerpoint-to-pdf",
  "keynote-to-powerpoint",
  "excel-to-pdf",
  "pdf-to-jpg",
  "rotate-pdf",
  "compress-pdf",
  "markdown-to-pdf",
  "pdf-to-markdown",
  "combine-to-pdf",
  "pages-to-pdf",
  "keynote-to-pdf",
  "numbers-to-xlsx",
  "numbers-to-pdf",
] as const;

export type ToolSlug = (typeof PUBLIC_WEB_TOOL_SLUGS)[number];

/** Historical native routes kept only so old bookmarks can redirect cleanly. */
export const LEGACY_TOOL_SLUGS = [
  "word-to-pdf",
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
  maxTotalBytes: number;
  processing: "local";
  category: ToolCategory;
  badge?: string;
}

export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_DOCX_BYTES = 50 * 1024 * 1024;
export const MAX_PPTX_BYTES = 50 * 1024 * 1024;
export const MAX_XLSX_BYTES = 50 * 1024 * 1024;
export const MAX_MARKDOWN_BYTES = 10 * 1024 * 1024;
export const MAX_BATCH_PDF_BYTES = 200 * 1024 * 1024;
export const MAX_BATCH_IMAGE_BYTES = 100 * 1024 * 1024;
export const MAX_BATCH_DOCX_BYTES = 100 * 1024 * 1024;
export const MAX_COMBINE_BYTES = 150 * 1024 * 1024;
export const MAX_APPLE_BYTES = 100 * 1024 * 1024;

const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_PPTX =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
    maxTotalBytes: MAX_BATCH_PDF_BYTES,
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
    maxTotalBytes: MAX_PDF_BYTES,
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
    maxTotalBytes: MAX_BATCH_IMAGE_BYTES,
    processing: "local",
    category: "Images",
  },
  {
    slug: "docx-to-pdf",
    name: "Word to PDF",
    shortName: "DOCX",
    description: "Convert one or more Word documents into one PDF. Beta.",
    longDescription:
      "Convert one or more .docx files into one PDF in your browser. Reorder documents before processing; headings, lists, tables and images are supported, but complex Word layouts and pagination may differ.",
    accepts: ".docx",
    acceptMime: [MIME_DOCX],
    multiple: true,
    maxFiles: 10,
    maxFileBytes: MAX_DOCX_BYTES,
    maxTotalBytes: MAX_BATCH_DOCX_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
  {
    slug: "pages-to-word",
    name: "Pages to Word",
    shortName: "Pages → DOCX",
    description: "Export supported Pages content to an editable Word document. Beta.",
    longDescription:
      "Convert a .pages document into a real .docx package in your browser. Text, tables, images and basic shapes are supported; advanced Pages layout and unsupported objects fail closed.",
    accepts: ".pages",
    acceptMime: ["application/vnd.apple.pages"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_APPLE_BYTES,
    maxTotalBytes: MAX_APPLE_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
  {
    slug: "powerpoint-to-pdf",
    name: "PowerPoint to PDF",
    shortName: "PPTX",
    description: "Convert a PowerPoint presentation into a PDF locally.",
    longDescription:
      "Convert a .pptx presentation into a validated PDF in your browser. Slide text, tables, embedded PNG/JPEG images and basic shapes are supported; unsupported objects fail closed.",
    accepts: ".pptx",
    acceptMime: [MIME_PPTX],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_PPTX_BYTES,
    maxTotalBytes: MAX_PPTX_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
  {
    slug: "keynote-to-powerpoint",
    name: "Keynote to PowerPoint",
    shortName: "Keynote → PPTX",
    description: "Export supported Keynote slides to a real PowerPoint file. Beta.",
    longDescription:
      "Convert supported .key presentations into a real .pptx package locally. Slide text, tables, images and basic shapes are exported; charts, video, animations and unsupported objects fail closed.",
    accepts: ".key,.keynote",
    acceptMime: ["application/vnd.apple.keynote"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_APPLE_BYTES,
    maxTotalBytes: MAX_APPLE_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
  {
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    shortName: "XLSX",
    description: "Convert an Excel workbook into a readable PDF locally. Beta.",
    longDescription:
      "Convert a .xlsx workbook into a validated PDF in your browser. Multiple sheets, saved values, formulas, merged cells and basic formatting are included; advanced Excel features are not recalculated.",
    accepts: ".xlsx",
    acceptMime: [MIME_XLSX],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_XLSX_BYTES,
    maxTotalBytes: MAX_XLSX_BYTES,
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
    maxTotalBytes: MAX_PDF_BYTES,
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
    maxTotalBytes: MAX_PDF_BYTES,
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
    maxTotalBytes: MAX_PDF_BYTES,
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
    maxTotalBytes: MAX_MARKDOWN_BYTES,
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
    maxTotalBytes: MAX_PDF_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
  {
    slug: "combine-to-pdf",
    name: "Combine documents to PDF",
    shortName: "Combine",
    description: "Join PDFs, Word, Markdown and images into one PDF. Beta.",
    longDescription:
      "Normalize PDFs, Word documents, Markdown and JPG/PNG images into one PDF in your chosen order. Each source is processed locally and must convert successfully.",
    accepts: ".pdf,.docx,.md,.markdown,.jpg,.jpeg,.png",
    acceptMime: [
      "application/pdf",
      MIME_DOCX,
      "text/markdown",
      "image/jpeg",
      "image/png",
    ],
    multiple: true,
    maxFiles: 20,
    maxFileBytes: MAX_PDF_BYTES,
    maxTotalBytes: MAX_COMBINE_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
  {
    slug: "pages-to-pdf",
    name: "Pages to PDF",
    shortName: "Pages",
    description: "Export supported Pages content to PDF locally. Beta.",
    longDescription:
      "Convert a .pages document into a reviewable PDF in your browser. Text, tables, images and basic shapes are supported; unsupported content fails closed.",
    accepts: ".pages",
    acceptMime: ["application/vnd.apple.pages"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_APPLE_BYTES,
    maxTotalBytes: MAX_APPLE_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
  {
    slug: "keynote-to-pdf",
    name: "Keynote to PDF",
    shortName: "Keynote",
    description: "Export supported Keynote slides to PDF locally. Beta.",
    longDescription:
      "Convert a .key presentation into a reviewable PDF in your browser. Text, tables, images, basic shapes and saved chart data are supported; unsupported content fails closed.",
    accepts: ".key,.keynote",
    acceptMime: ["application/vnd.apple.keynote"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_APPLE_BYTES,
    maxTotalBytes: MAX_APPLE_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
  {
    slug: "numbers-to-xlsx",
    name: "Numbers to XLSX",
    shortName: "Numbers",
    description: "Export saved Numbers tables to Excel locally. Beta.",
    longDescription:
      "Convert a .numbers spreadsheet into an .xlsx workbook in your browser. Saved cell values and table structure are preserved; formulas are not recalculated.",
    accepts: ".numbers",
    acceptMime: ["application/vnd.apple.numbers"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_APPLE_BYTES,
    maxTotalBytes: MAX_APPLE_BYTES,
    processing: "local",
    category: "Documents",
    badge: "Beta",
  },
  {
    slug: "numbers-to-pdf",
    name: "Numbers to PDF",
    shortName: "Numbers PDF",
    description: "Export supported Numbers tables to a readable PDF. Beta.",
    longDescription:
      "Convert a .numbers spreadsheet into a readable PDF in your browser. Tables and saved chart data are rendered locally; native print styling and formula recalculation are not reproduced.",
    accepts: ".numbers",
    acceptMime: ["application/vnd.apple.numbers"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_APPLE_BYTES,
    maxTotalBytes: MAX_APPLE_BYTES,
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
