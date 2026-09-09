export type ToolSlug =
  | "merge-pdf"
  | "split-pdf"
  | "images-to-pdf"
  | "docx-to-pdf"
  | "word-to-pdf"
  | "pages-to-pdf"
  | "pages-to-word"
  | "powerpoint-to-pdf"
  | "keynote-to-pdf"
  | "keynote-to-powerpoint"
  | "excel-to-pdf"
  | "numbers-to-pdf"
  | "numbers-to-excel"
  | "pdf-to-jpg"
  | "rotate-pdf"
  | "compress-pdf";

export type ToolProcessing = "local" | "mac-helper" | "hybrid";
export type ToolCategory =
  | "PDF"
  | "Documents"
  | "Presentations"
  | "Spreadsheets"
  | "Images";

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
  processing: ToolProcessing;
  category: ToolCategory;
  badge?: string;
  /** FORMAT_MATRIX conversion id used for helper routing (if any). */
  conversionId?: string;
  /** "doc" style source key sent to the helper (lowercase, no dot). */
  helperFrom?: string;
  /** Target key sent to the helper (lowercase, no dot). */
  helperTo?: string;
  /** Preferred native engine label for transparency UI. */
  nativeEngine?: string;
  /** Desktop app required for helper conversion. */
  requiresApp?: string;
  requiresMac?: boolean;
}

export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_DOCX_BYTES = 50 * 1024 * 1024;
export const MAX_OFFICE_BYTES = 50 * 1024 * 1024;
export const MAX_IWORK_BYTES = 100 * 1024 * 1024;

// MIME types for Office / iWork inputs. iWork bundles often arrive with an
// empty or generic MIME type, so extension matching remains the authority
// (see lib/files.ts); these entries document intent for pickers that honor it.
const MIME_DOC =
  "application/msword";
const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_PPT = "application/vnd.ms-powerpoint";
const MIME_PPTX =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MIME_XLS = "application/vnd.ms-excel";
const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
    category: "PDF",
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
    category: "PDF",
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
    category: "Images",
  },
  {
    slug: "docx-to-pdf",
    name: "Word to PDF",
    shortName: "DOCX",
    description:
      "Fast browser conversion for .docx — or high fidelity with Word on Mac.",
    longDescription:
      "Convert a .docx file to PDF in your browser (Beta: headings, lists, tables and images preserved; pagination and advanced Word features may differ). On a Mac with Folio for Mac + Microsoft Word, the same file converts locally with Word for high fidelity.",
    accepts: ".docx",
    acceptMime: [MIME_DOCX],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_DOCX_BYTES,
    processing: "hybrid",
    category: "Documents",
    badge: "Beta",
    conversionId: "docx-to-pdf",
    helperFrom: "docx",
    helperTo: "pdf",
    nativeEngine: "word",
    requiresApp: "Microsoft Word",
  },
  {
    slug: "word-to-pdf",
    name: "Word (.doc) to PDF",
    shortName: "Word",
    description: "Convert legacy .doc and .docx to PDF locally on your Mac.",
    longDescription:
      "Convert .doc or .docx to PDF using Microsoft Word on your Mac via Folio for Mac (LibreOffice fallback offered when Word isn't installed and fidelity is communicated). Browsers cannot reliably render legacy .doc, so this tool requires macOS.",
    accepts: ".doc,.docx",
    acceptMime: [MIME_DOC, MIME_DOCX],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_OFFICE_BYTES,
    processing: "mac-helper",
    category: "Documents",
    badge: "Mac",
    conversionId: "doc-to-pdf",
    helperFrom: "doc",
    helperTo: "pdf",
    nativeEngine: "word",
    requiresApp: "Microsoft Word",
    requiresMac: true,
  },
  {
    slug: "pages-to-pdf",
    name: "Pages to PDF",
    shortName: "Pages",
    description: "Export Apple Pages documents to PDF using Pages on your Mac.",
    longDescription:
      "Export a .pages document to PDF using Pages.app on your Mac via Folio for Mac. Your document never leaves your Mac. Requires macOS, Folio for Mac, and Pages.",
    accepts: ".pages",
    acceptMime: ["application/x-iwork-pages-sffpages", "application/octet-stream"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_IWORK_BYTES,
    processing: "mac-helper",
    category: "Documents",
    badge: "Mac",
    conversionId: "pages-to-pdf",
    helperFrom: "pages",
    helperTo: "pdf",
    nativeEngine: "pages",
    requiresApp: "Pages",
    requiresMac: true,
  },
  {
    slug: "pages-to-word",
    name: "Pages to Word",
    shortName: "Pg→Doc",
    description: "Export Apple Pages documents to .docx using Pages on your Mac.",
    longDescription:
      "Export a .pages document to .docx using Pages.app on your Mac via Folio for Mac. Complex layouts may shift — review in Word. Requires macOS, Folio for Mac, and Pages.",
    accepts: ".pages",
    acceptMime: ["application/x-iwork-pages-sffpages", "application/octet-stream"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_IWORK_BYTES,
    processing: "mac-helper",
    category: "Documents",
    badge: "Mac",
    conversionId: "pages-to-docx",
    helperFrom: "pages",
    helperTo: "docx",
    nativeEngine: "pages",
    requiresApp: "Pages",
    requiresMac: true,
  },
  {
    slug: "powerpoint-to-pdf",
    name: "PowerPoint to PDF",
    shortName: "Slides",
    description: "Convert PowerPoint decks to PDF locally on your Mac.",
    longDescription:
      "Convert .ppt or .pptx to PDF using Microsoft PowerPoint on your Mac via Folio for Mac (LibreOffice fallback offered when PowerPoint isn't installed, clearly labeled). Requires macOS.",
    accepts: ".ppt,.pptx",
    acceptMime: [MIME_PPT, MIME_PPTX],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_OFFICE_BYTES,
    processing: "mac-helper",
    category: "Presentations",
    badge: "Mac",
    conversionId: "pptx-to-pdf",
    helperFrom: "pptx",
    helperTo: "pdf",
    nativeEngine: "powerpoint",
    requiresApp: "Microsoft PowerPoint",
    requiresMac: true,
  },
  {
    slug: "keynote-to-pdf",
    name: "Keynote to PDF",
    shortName: "Keynote",
    description: "Beta: try exporting Keynote decks to PDF on your Mac.",
    longDescription:
      "Beta / known limitation: the Keynote macOS Automation permission does not remain enabled reliably in the current release, so Keynote → PDF is not validated or guaranteed. The implementation remains available for later compatibility work; your document stays on your Mac.",
    accepts: ".key",
    acceptMime: ["application/x-iwork-keynote-sffkey", "application/octet-stream"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_IWORK_BYTES,
    processing: "mac-helper",
    category: "Presentations",
    badge: "Mac",
    conversionId: "key-to-pdf",
    helperFrom: "key",
    helperTo: "pdf",
    nativeEngine: "keynote",
    requiresApp: "Keynote",
    requiresMac: true,
  },
  {
    slug: "keynote-to-powerpoint",
    name: "Keynote to PowerPoint",
    shortName: "Kn→Pp",
    description: "Beta: try exporting Keynote decks to .pptx on your Mac.",
    longDescription:
      "Beta / known limitation: the Keynote macOS Automation permission does not remain enabled reliably in the current release, so Keynote → PPTX is not validated or guaranteed. If it does run, transitions, builds and some fonts may not survive; review the output. Your document stays on your Mac.",
    accepts: ".key",
    acceptMime: ["application/x-iwork-keynote-sffkey", "application/octet-stream"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_IWORK_BYTES,
    processing: "mac-helper",
    category: "Presentations",
    badge: "Mac",
    conversionId: "key-to-pptx",
    helperFrom: "key",
    helperTo: "pptx",
    nativeEngine: "keynote",
    requiresApp: "Keynote",
    requiresMac: true,
  },
  {
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    shortName: "Excel",
    description: "Convert Excel workbooks to PDF locally on your Mac.",
    longDescription:
      "Convert .xls or .xlsx to PDF using Microsoft Excel on your Mac via Folio for Mac (LibreOffice fallback offered when Excel isn't installed, clearly labeled). Requires macOS.",
    accepts: ".xls,.xlsx",
    acceptMime: [MIME_XLS, MIME_XLSX],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_OFFICE_BYTES,
    processing: "mac-helper",
    category: "Spreadsheets",
    badge: "Mac",
    conversionId: "xlsx-to-pdf",
    helperFrom: "xlsx",
    helperTo: "pdf",
    nativeEngine: "excel",
    requiresApp: "Microsoft Excel",
    requiresMac: true,
  },
  {
    slug: "numbers-to-pdf",
    name: "Numbers to PDF",
    shortName: "Numbers",
    description:
      "Export Apple Numbers spreadsheets to PDF using Numbers on your Mac.",
    longDescription:
      "Export a .numbers spreadsheet to PDF using Numbers.app on your Mac via Folio for Mac. Your document never leaves your Mac. Requires macOS, Folio for Mac, and Numbers.",
    accepts: ".numbers",
    acceptMime: ["application/x-iwork-numbers-sffnumbers", "application/octet-stream"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_IWORK_BYTES,
    processing: "mac-helper",
    category: "Spreadsheets",
    badge: "Mac",
    conversionId: "numbers-to-pdf",
    helperFrom: "numbers",
    helperTo: "pdf",
    nativeEngine: "numbers",
    requiresApp: "Numbers",
    requiresMac: true,
  },
  {
    slug: "numbers-to-excel",
    name: "Numbers to Excel",
    shortName: "Nm→Xl",
    description: "Export Numbers spreadsheets to .xlsx using Numbers on your Mac.",
    longDescription:
      "Export a .numbers spreadsheet to .xlsx using Numbers.app on your Mac via Folio for Mac. Formulas, charts and formatting may shift — review in Excel. Requires macOS, Folio for Mac, and Numbers.",
    accepts: ".numbers",
    acceptMime: ["application/x-iwork-numbers-sffnumbers", "application/octet-stream"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_IWORK_BYTES,
    processing: "mac-helper",
    category: "Spreadsheets",
    badge: "Mac",
    conversionId: "numbers-to-xlsx",
    helperFrom: "numbers",
    helperTo: "xlsx",
    nativeEngine: "numbers",
    requiresApp: "Numbers",
    requiresMac: true,
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
      "Rewrite a PDF with optimized object streams and cleaned metadata. Folio always shows the original and resulting size — if nothing can be saved, it says so.",
    accepts: ".pdf",
    acceptMime: ["application/pdf"],
    multiple: false,
    maxFiles: 1,
    maxFileBytes: MAX_PDF_BYTES,
    processing: "local",
    category: "PDF",
  },
];

export function getTool(slug: string): FolioTool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
