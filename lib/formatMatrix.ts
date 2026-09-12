/**
 * Public web-tool compatibility.
 *
 * This is intentionally separate from the dormant native conversion registry
 * in `dormantFormatMatrix.ts`. Public navigation, routes, and metadata must
 * only consume this browser-local allowlist.
 */

export type BrowserSupport = "full" | "beta";
export type ConversionStatus = "browser" | "browser-beta";
export type PublicToolCategory = "PDF" | "Documents" | "Images";

export interface FormatConversion {
  id: string;
  inputs: string[];
  output: string;
  toolSlug: string;
  category: PublicToolCategory;
  title: string;
  description: string;
  browser: BrowserSupport;
  status: ConversionStatus;
  limitation: string;
}

export const PUBLIC_WEB_FORMAT_MATRIX: FormatConversion[] = [
  {
    id: "merge-pdf",
    inputs: ["pdf"],
    output: "pdf",
    toolSlug: "merge-pdf",
    category: "PDF",
    title: "Merge PDF",
    description: "Combine multiple PDFs into one document, in your order.",
    browser: "full",
    status: "browser",
    limitation: "PDF merge is exact because page streams are copied, not re-rendered.",
  },
  {
    id: "split-pdf",
    inputs: ["pdf"],
    output: "pdf",
    toolSlug: "split-pdf",
    category: "PDF",
    title: "Split PDF",
    description: "Extract pages or page ranges into a new PDF.",
    browser: "full",
    status: "browser",
    limitation: "Page extraction is exact.",
  },
  {
    id: "compress-pdf",
    inputs: ["pdf"],
    output: "pdf",
    toolSlug: "compress-pdf",
    category: "PDF",
    title: "Compress PDF",
    description: "Shrink PDFs where possible and see honest before/after sizes.",
    browser: "full",
    status: "browser",
    limitation:
      "Client-side optimization only; already-optimized PDFs may barely shrink.",
  },
  {
    id: "rotate-pdf",
    inputs: ["pdf"],
    output: "pdf",
    toolSlug: "rotate-pdf",
    category: "PDF",
    title: "Rotate PDF",
    description: "Rotate all pages, or selected pages, by 90° steps.",
    browser: "full",
    status: "browser",
    limitation: "Rotation metadata changes page orientation without re-rendering content.",
  },
  {
    id: "pdf-to-jpg",
    inputs: ["pdf"],
    output: "jpg",
    toolSlug: "pdf-to-jpg",
    category: "PDF",
    title: "PDF to JPG",
    description: "Render PDF pages as JPG images, in a ZIP download.",
    browser: "full",
    status: "browser",
    limitation: "Pages are rasterized at 2x scale; very large PDFs may be slow on low-end devices.",
  },
  {
    id: "images-to-pdf",
    inputs: ["jpg", "jpeg", "png"],
    output: "pdf",
    toolSlug: "images-to-pdf",
    category: "Images",
    title: "JPG / PNG to PDF",
    description: "Turn JPG or PNG images into a clean PDF, one per page.",
    browser: "full",
    status: "browser",
    limitation: "Images are placed one per A4 page and fitted without distortion.",
  },
  {
    id: "docx-to-pdf",
    inputs: ["docx"],
    output: "pdf",
    toolSlug: "docx-to-pdf",
    category: "Documents",
    title: "Word to PDF",
    description: "Convert a .docx file to PDF in the browser. Beta.",
    browser: "beta",
    status: "browser-beta",
    limitation:
      "Headings, lists, tables and images are supported, but complex layouts, pagination, headers, footers and tracked changes may differ.",
  },
  {
    id: "pages-to-word",
    inputs: ["pages"],
    output: "docx",
    toolSlug: "pages-to-word",
    category: "Documents",
    title: "Pages to Word",
    description: "Export supported Pages content to an editable Word document locally. Beta.",
    browser: "beta",
    status: "browser-beta",
    limitation: "Text, tables, images and basic shapes are exported to a real DOCX package; advanced Pages layout and unsupported objects may differ or fail closed.",
  },
  {
    id: "powerpoint-to-pdf",
    inputs: ["pptx"],
    output: "pdf",
    toolSlug: "powerpoint-to-pdf",
    category: "Documents",
    title: "PowerPoint to PDF",
    description: "Convert PowerPoint slides into a validated PDF locally. Beta.",
    browser: "beta",
    status: "browser-beta",
    limitation: "Text, tables, embedded PNG/JPEG images and basic shapes are supported; animations, video, OLE and unsupported graphics are not exported.",
  },
  {
    id: "keynote-to-powerpoint",
    inputs: ["keynote"],
    output: "pptx",
    toolSlug: "keynote-to-powerpoint",
    category: "Documents",
    title: "Keynote to PowerPoint",
    description: "Export supported Keynote slides to a real PowerPoint package locally. Beta.",
    browser: "beta",
    status: "browser-beta",
    limitation: "This emits a real OOXML PPTX package, and representative Keynote 15.3.1 open/save/reopen validation is complete; advanced Apple features are not exported.",
  },
  {
    id: "excel-to-pdf",
    inputs: ["xlsx"],
    output: "pdf",
    toolSlug: "excel-to-pdf",
    category: "Documents",
    title: "Excel to PDF",
    description: "Convert Excel worksheets into a readable PDF locally. Beta.",
    browser: "beta",
    status: "browser-beta",
    limitation: "Multiple sheets, saved values, formulas, merged cells and basic formatting are represented; Excel recalculation and advanced print styling are not reproduced.",
  },
  {
    id: "markdown-to-pdf",
    inputs: ["md", "markdown"],
    output: "pdf",
    toolSlug: "markdown-to-pdf",
    category: "Documents",
    title: "Markdown to PDF",
    description: "Turn Markdown into a polished, downloadable PDF.",
    browser: "full",
    status: "browser",
    limitation:
      "Raw HTML is disabled, remote images are omitted, and output is laid out for A4 pages.",
  },
  {
    id: "pdf-to-markdown",
    inputs: ["pdf"],
    output: "md",
    toolSlug: "pdf-to-markdown",
    category: "Documents",
    title: "PDF to Markdown",
    description: "Extract useful Markdown from text-based PDFs.",
    browser: "beta",
    status: "browser-beta",
    limitation:
      "This reconstructs text and defensible structure; scanned pages, complex columns and exact original Markdown are not recovered.",
  },
  {
    id: "combine-to-pdf",
    inputs: ["pdf", "docx", "md", "markdown", "jpg", "jpeg", "png"],
    output: "pdf",
    toolSlug: "combine-to-pdf",
    category: "Documents",
    title: "Combine documents to PDF",
    description: "Normalize PDFs, Word, Markdown and images into one PDF in your order.",
    browser: "beta",
    status: "browser-beta",
    limitation:
      "Each source is normalized locally; DOCX and Markdown layout remains renderer-dependent.",
  },
  {
    id: "pages-to-pdf",
    inputs: ["pages"],
    output: "pdf",
    toolSlug: "pages-to-pdf",
    category: "Documents",
    title: "Pages to PDF",
    description: "Export supported Apple Pages content to PDF locally. Beta.",
    browser: "beta",
    status: "browser-beta",
    limitation:
      "Text, tables, images and basic shapes are supported. Animations, advanced layout features and unsupported objects fail closed instead of being silently omitted.",
  },
  {
    id: "keynote-to-pdf",
    inputs: ["keynote"],
    output: "pdf",
    toolSlug: "keynote-to-pdf",
    category: "Documents",
    title: "Keynote to PDF",
    description: "Export supported Keynote slides to PDF locally. Beta.",
    browser: "beta",
    status: "browser-beta",
    limitation:
      "Slide text, tables, images, basic shapes and saved chart data are supported. Animations, transitions, video and unsupported objects are not exported.",
  },
  {
    id: "numbers-to-xlsx",
    inputs: ["numbers"],
    output: "xlsx",
    toolSlug: "numbers-to-xlsx",
    category: "Documents",
    title: "Numbers to XLSX",
    description: "Export saved Numbers tables to an Excel workbook locally. Beta.",
    browser: "beta",
    status: "browser-beta",
    limitation:
      "Saved cell values and table structure are exported. Formulas are not recalculated, and charts, formatting and unsupported Numbers features are not represented in XLSX.",
  },
  {
    id: "numbers-to-pdf",
    inputs: ["numbers"],
    output: "pdf",
    toolSlug: "numbers-to-pdf",
    category: "Documents",
    title: "Numbers to PDF",
    description: "Export supported Numbers tables to a readable PDF locally. Beta.",
    browser: "beta",
    status: "browser-beta",
    limitation:
      "Tables and saved chart data are rendered in a clean layout; formulas are not recalculated and native print styling is not reproduced.",
  },
];

/** Public compatibility matrix. Do not add native-only conversions here. */
export const FORMAT_MATRIX = PUBLIC_WEB_FORMAT_MATRIX;

export function getConversion(id: string): FormatConversion | undefined {
  return PUBLIC_WEB_FORMAT_MATRIX.find((conversion) => conversion.id === id);
}

export function getConversionBySlug(slug: string): FormatConversion | undefined {
  return PUBLIC_WEB_FORMAT_MATRIX.find((conversion) => conversion.toolSlug === slug);
}

export const HOMEPAGE_CATEGORIES = ["PDF", "Documents", "Images"] as const;

export function conversionsByCategory(
  category: (typeof HOMEPAGE_CATEGORIES)[number],
): FormatConversion[] {
  return PUBLIC_WEB_FORMAT_MATRIX.filter(
    (conversion) => conversion.category === category,
  );
}
