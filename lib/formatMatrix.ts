/**
 * Folio v0.2 — single source of truth for format compatibility.
 *
 * Every conversion Folio advertises MUST have exactly one entry here.
 * React components generate UI state from this matrix; do not duplicate
 * compatibility rules inside components.
 *
 * Honesty rules:
 * - `browser` describes what the Next.js web app can do alone.
 * - `helper` describes what Folio for Mac (localhost helper + native apps)
 *   can do. Statuses marked `requires-manual-validation` need a real Mac
 *   with the named app installed; CI cannot validate them.
 */

export type EngineId =
  | "browser"
  | "pages"
  | "keynote"
  | "numbers"
  | "word"
  | "powerpoint"
  | "excel"
  | "libreoffice";

export type BrowserSupport = "full" | "beta" | "none";
export type HelperSupport = "native" | "fallback" | "none";

export type ConversionStatus =
  | "browser" // reliable browser-local conversion, no helper needed
  | "browser-beta" // browser conversion with known fidelity limits
  | "helper-native" // helper + native app (implemented, needs manual validation)
  | "helper-beta" // helper path exists, but is explicitly not release-validated
  | "helper-fallback" // helper + LibreOffice fallback path
  | "hybrid"; // browser fallback + helper high-fidelity upgrade path

export interface FormatConversion {
  /** Stable id, e.g. "pages-to-pdf". Also used for helper `from>to` mapping. */
  id: string;
  /** Lowercase input extensions without dots. */
  inputs: string[];
  /** Lowercase output extension without dot. */
  output: string;
  /** Tool route slug in apps/web. */
  toolSlug: string;
  /** Homepage category. */
  category: "PDF" | "Documents" | "Presentations" | "Spreadsheets" | "Images";
  title: string;
  description: string;
  browser: BrowserSupport;
  helper: HelperSupport;
  /** Preferred native engine when converting via the helper. */
  nativeEngine: EngineId;
  /** Local fallback engine (LibreOffice) where applicable. */
  fallbackEngine: EngineId | null;
  status: ConversionStatus;
  limitation: string;
  /** Helper allowlist pair, e.g. "pages>pdf". Null when helper is not used. */
  helperPair: string | null;
  requiresMac: boolean;
  requiresApp: string | null;
}

export const FORMAT_MATRIX: FormatConversion[] = [
  // ---- Existing v0.1 PDF + image tools (unchanged behavior) ----
  {
    id: "merge-pdf",
    inputs: ["pdf"],
    output: "pdf",
    toolSlug: "merge-pdf",
    category: "PDF",
    title: "Merge PDF",
    description: "Combine multiple PDFs into one document, in your order.",
    browser: "full",
    helper: "none",
    nativeEngine: "browser",
    fallbackEngine: null,
    status: "browser",
    limitation: "PDF merge is exact (page streams are copied, not re-rendered).",
    helperPair: null,
    requiresMac: false,
    requiresApp: null,
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
    helper: "none",
    nativeEngine: "browser",
    fallbackEngine: null,
    status: "browser",
    limitation: "Page extraction is exact.",
    helperPair: null,
    requiresMac: false,
    requiresApp: null,
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
    helper: "none",
    nativeEngine: "browser",
    fallbackEngine: null,
    status: "browser",
    limitation:
      "Client-side optimization only; already-optimized PDFs may barely shrink.",
    helperPair: null,
    requiresMac: false,
    requiresApp: null,
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
    helper: "none",
    nativeEngine: "browser",
    fallbackEngine: null,
    status: "browser",
    limitation: "Rotation metadata only; page content untouched.",
    helperPair: null,
    requiresMac: false,
    requiresApp: null,
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
    helper: "none",
    nativeEngine: "browser",
    fallbackEngine: null,
    status: "browser",
    limitation: "Rasterized at 2x scale; very large PDFs may be slow on low-end devices.",
    helperPair: null,
    requiresMac: false,
    requiresApp: null,
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
    helper: "none",
    nativeEngine: "browser",
    fallbackEngine: null,
    status: "browser",
    limitation: "One image per A4 page, fitted without distortion.",
    helperPair: null,
    requiresMac: false,
    requiresApp: null,
  },
  // ---- Documents ----
  {
    id: "docx-to-pdf",
    inputs: ["docx"],
    output: "pdf",
    toolSlug: "docx-to-pdf",
    category: "Documents",
    title: "Word to PDF",
    description: "Convert Word documents to PDF. High fidelity with Word on Mac.",
    browser: "beta",
    helper: "native",
    nativeEngine: "word",
    fallbackEngine: "libreoffice",
    status: "hybrid",
    limitation:
      "Browser conversion (Beta) preserves headings/lists/tables/images but pagination, headers/footers and tracked changes differ from Word. With Folio for Mac + Word installed, conversion uses Microsoft Word locally for high fidelity.",
    helperPair: "docx>pdf",
    requiresMac: false,
    requiresApp: "Microsoft Word",
  },
  {
    id: "doc-to-pdf",
    inputs: ["doc"],
    output: "pdf",
    toolSlug: "word-to-pdf",
    category: "Documents",
    title: "Word to PDF",
    description: "Convert .doc / .docx to PDF locally on your Mac.",
    browser: "none",
    helper: "native",
    nativeEngine: "word",
    fallbackEngine: "libreoffice",
    status: "helper-native",
    limitation:
      "Legacy .doc requires Word or LibreOffice locally; browsers cannot reliably render .doc. Requires manual validation on a Mac with Word installed.",
    helperPair: "doc>pdf",
    requiresMac: true,
    requiresApp: "Microsoft Word",
  },
  {
    id: "pages-to-pdf",
    inputs: ["pages"],
    output: "pdf",
    toolSlug: "pages-to-pdf",
    category: "Documents",
    title: "Pages to PDF",
    description: "Export Apple Pages documents to PDF using Pages on your Mac.",
    browser: "none",
    helper: "native",
    nativeEngine: "pages",
    fallbackEngine: null,
    status: "helper-native",
    limitation:
      ".pages is a proprietary bundle format; there is no reliable browser parser. Conversion uses Pages.app export. Requires manual validation on a Mac with Pages installed.",
    helperPair: "pages>pdf",
    requiresMac: true,
    requiresApp: "Pages",
  },
  {
    id: "pages-to-docx",
    inputs: ["pages"],
    output: "docx",
    toolSlug: "pages-to-word",
    category: "Documents",
    title: "Pages to Word",
    description: "Export Apple Pages documents to .docx using Pages on your Mac.",
    browser: "none",
    helper: "native",
    nativeEngine: "pages",
    fallbackEngine: null,
    status: "helper-native",
    limitation:
      "Uses Pages.app export to Word. Complex layouts may shift; review in Word. Requires manual validation on a Mac with Pages installed.",
    helperPair: "pages>docx",
    requiresMac: true,
    requiresApp: "Pages",
  },
  // ---- Presentations ----
  {
    id: "pptx-to-pdf",
    inputs: ["pptx", "ppt"],
    output: "pdf",
    toolSlug: "powerpoint-to-pdf",
    category: "Presentations",
    title: "PowerPoint to PDF",
    description: "Convert PowerPoint decks to PDF locally on your Mac.",
    browser: "none",
    helper: "native",
    nativeEngine: "powerpoint",
    fallbackEngine: "libreoffice",
    status: "helper-native",
    limitation:
      "No reliable browser PPT renderer; uses PowerPoint.app (or LibreOffice fallback with possible fidelity loss). Requires manual validation with PowerPoint installed.",
    helperPair: "pptx>pdf",
    requiresMac: true,
    requiresApp: "Microsoft PowerPoint",
  },
  {
    id: "key-to-pdf",
    inputs: ["key"],
    output: "pdf",
    toolSlug: "keynote-to-pdf",
    category: "Presentations",
    title: "Keynote to PDF",
    description: "Beta: try exporting Keynote decks to PDF on your Mac.",
    browser: "none",
    helper: "native",
    nativeEngine: "keynote",
    fallbackEngine: null,
    status: "helper-beta",
    limitation:
      "Known limitation: macOS Automation permission for Keynote does not remain enabled reliably in the current release. Keynote → PDF is not validated and must not be treated as guaranteed working. Revisit this route separately.",
    helperPair: "key>pdf",
    requiresMac: true,
    requiresApp: "Keynote",
  },
  {
    id: "key-to-pptx",
    inputs: ["key"],
    output: "pptx",
    toolSlug: "keynote-to-powerpoint",
    category: "Presentations",
    title: "Keynote to PowerPoint",
    description: "Beta: try exporting Keynote decks to .pptx on your Mac.",
    browser: "none",
    helper: "native",
    nativeEngine: "keynote",
    fallbackEngine: null,
    status: "helper-beta",
    limitation:
      "Known limitation: macOS Automation permission for Keynote does not remain enabled reliably in the current release. Keynote → PPTX is not validated and must not be treated as guaranteed working. Revisit this route separately.",
    helperPair: "key>pptx",
    requiresMac: true,
    requiresApp: "Keynote",
  },
  // ---- Spreadsheets ----
  {
    id: "xlsx-to-pdf",
    inputs: ["xlsx", "xls"],
    output: "pdf",
    toolSlug: "excel-to-pdf",
    category: "Spreadsheets",
    title: "Excel to PDF",
    description: "Convert Excel workbooks to PDF locally on your Mac.",
    browser: "none",
    helper: "native",
    nativeEngine: "excel",
    fallbackEngine: "libreoffice",
    status: "helper-native",
    limitation:
      "Uses Excel.app (or LibreOffice fallback; pagination and charts may differ). Requires manual validation with Excel installed.",
    helperPair: "xlsx>pdf",
    requiresMac: true,
    requiresApp: "Microsoft Excel",
  },
  {
    id: "numbers-to-pdf",
    inputs: ["numbers"],
    output: "pdf",
    toolSlug: "numbers-to-pdf",
    category: "Spreadsheets",
    title: "Numbers to PDF",
    description: "Export Apple Numbers spreadsheets to PDF using Numbers on your Mac.",
    browser: "none",
    helper: "native",
    nativeEngine: "numbers",
    fallbackEngine: null,
    status: "helper-native",
    limitation:
      ".numbers is proprietary; conversion uses Numbers.app export. Requires manual validation on a Mac with Numbers installed.",
    helperPair: "numbers>pdf",
    requiresMac: true,
    requiresApp: "Numbers",
  },
  {
    id: "numbers-to-xlsx",
    inputs: ["numbers"],
    output: "xlsx",
    toolSlug: "numbers-to-excel",
    category: "Spreadsheets",
    title: "Numbers to Excel",
    description: "Export Numbers spreadsheets to .xlsx using Numbers on your Mac.",
    browser: "none",
    helper: "native",
    nativeEngine: "numbers",
    fallbackEngine: null,
    status: "helper-native",
    limitation:
      "Uses Numbers.app export to Excel. Formulas, charts and formatting may shift; review in Excel. Requires manual validation.",
    helperPair: "numbers>xlsx",
    requiresMac: true,
    requiresApp: "Numbers",
  },
];

export function getConversion(id: string): FormatConversion | undefined {
  return FORMAT_MATRIX.find((c) => c.id === id);
}

export function getConversionBySlug(slug: string): FormatConversion | undefined {
  return FORMAT_MATRIX.find((c) => c.toolSlug === slug);
}

/** Explicit allowlist mirrored by the Swift helper. Must stay in sync. */
export const HELPER_ALLOWLIST: string[] = Array.from(
  new Set(
    FORMAT_MATRIX.filter((c) => c.helperPair !== null).flatMap((c) => {
      const pair = c.helperPair as string;
      // "pptx-to-pdf" covers both ppt and pptx inputs.
      const extras: string[] =
        c.id === "pptx-to-pdf"
          ? ["ppt>pdf"]
          : c.id === "xlsx-to-pdf"
            ? ["xls>pdf"]
            : c.id === "docx-to-pdf"
              ? ["doc>pdf"]
              : [];
      return [pair, ...extras];
    }),
  ),
);

export function isHelperConversionAllowed(from: string, to: string): boolean {
  return HELPER_ALLOWLIST.includes(
    `${from.toLowerCase()}>${to.toLowerCase()}`,
  );
}

const ENGINE_LABELS: Record<EngineId, string> = {
  browser: "Browser (local)",
  pages: "Pages",
  keynote: "Keynote",
  numbers: "Numbers",
  word: "Microsoft Word",
  powerpoint: "Microsoft PowerPoint",
  excel: "Microsoft Excel",
  libreoffice: "LibreOffice",
};

/** Human-readable engine name. Never claim a native app when LibreOffice ran. */
export function engineDisplayName(engine: EngineId): string {
  return ENGINE_LABELS[engine];
}

export const HOMEPAGE_CATEGORIES = [
  "PDF",
  "Documents",
  "Presentations",
  "Spreadsheets",
  "Images",
] as const;

export function conversionsByCategory(
  category: (typeof HOMEPAGE_CATEGORIES)[number],
): FormatConversion[] {
  return FORMAT_MATRIX.filter((c) => c.category === category);
}
