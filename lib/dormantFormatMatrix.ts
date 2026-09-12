/**
 * Dormant native conversion registry.
 *
 * These pairs remain documented for the native packages and future work, but
 * are deliberately not imported by public pages or the public tool runner.
 */

export type EngineId =
  | "pages"
  | "keynote"
  | "numbers"
  | "word"
  | "powerpoint"
  | "excel"
  | "libreoffice";

export interface DormantNativeConversion {
  id: string;
  inputs: string[];
  output: string;
  toolSlug: string;
  title: string;
  description: string;
  nativeEngine: EngineId;
  fallbackEngine: EngineId | null;
  status: "helper-native" | "helper-beta" | "helper-fallback";
  limitation: string;
  helperPair: string;
  requiresApp: string;
}

export const DORMANT_NATIVE_CONVERSIONS: DormantNativeConversion[] = [
  {
    id: "docx-to-pdf-native",
    inputs: ["docx"],
    output: "pdf",
    toolSlug: "docx-to-pdf",
    title: "Word to PDF via Word",
    description: "Dormant native high-fidelity route.",
    nativeEngine: "word",
    fallbackEngine: "libreoffice",
    status: "helper-native",
    limitation: "Not part of the public web product.",
    helperPair: "docx>pdf",
    requiresApp: "Microsoft Word",
  },
  {
    id: "doc-to-pdf",
    inputs: ["doc"],
    output: "pdf",
    toolSlug: "word-to-pdf",
    title: "Word (.doc) to PDF",
    description: "Legacy Word conversion.",
    nativeEngine: "word",
    fallbackEngine: "libreoffice",
    status: "helper-native",
    limitation: "Legacy .doc conversion is not part of the public web product.",
    helperPair: "doc>pdf",
    requiresApp: "Microsoft Word",
  },
  {
    id: "pages-to-pdf-native",
    inputs: ["pages"],
    output: "pdf",
    toolSlug: "pages-to-pdf",
    title: "Pages to PDF via Pages",
    description: "Dormant native Pages export.",
    nativeEngine: "pages",
    fallbackEngine: null,
    status: "helper-native",
    limitation: "Native helper route is separate from the browser-local public route.",
    helperPair: "pages>pdf",
    requiresApp: "Pages",
  },
  {
    id: "pages-to-docx",
    inputs: ["pages"],
    output: "docx",
    toolSlug: "pages-to-word",
    title: "Pages to Word",
    description: "Apple Pages export to DOCX.",
    nativeEngine: "pages",
    fallbackEngine: null,
    status: "helper-native",
    limitation: "Proprietary iWork conversion is not part of the public web product.",
    helperPair: "pages>docx",
    requiresApp: "Pages",
  },
  {
    id: "pptx-to-pdf",
    inputs: ["pptx", "ppt"],
    output: "pdf",
    toolSlug: "powerpoint-to-pdf",
    title: "PowerPoint to PDF",
    description: "PowerPoint export.",
    nativeEngine: "powerpoint",
    fallbackEngine: "libreoffice",
    status: "helper-native",
    limitation: "Presentation conversion is not part of the public web product.",
    helperPair: "pptx>pdf",
    requiresApp: "Microsoft PowerPoint",
  },
  {
    id: "key-to-pdf",
    inputs: ["key"],
    output: "pdf",
    toolSlug: "keynote-to-pdf",
    title: "Keynote to PDF via Keynote",
    description: "Dormant native Keynote export.",
    nativeEngine: "keynote",
    fallbackEngine: null,
    status: "helper-beta",
    limitation: "Native helper route is separate from the browser-local public route.",
    helperPair: "key>pdf",
    requiresApp: "Keynote",
  },
  {
    id: "key-to-pptx",
    inputs: ["key"],
    output: "pptx",
    toolSlug: "keynote-to-powerpoint",
    title: "Keynote to PowerPoint",
    description: "Deferred Keynote export to PPTX.",
    nativeEngine: "keynote",
    fallbackEngine: null,
    status: "helper-beta",
    limitation: "Keynote automation remains deferred and unvalidated.",
    helperPair: "key>pptx",
    requiresApp: "Keynote",
  },
  {
    id: "numbers-to-pdf-native",
    inputs: ["numbers"],
    output: "pdf",
    toolSlug: "numbers-to-pdf",
    title: "Numbers to PDF via Numbers",
    description: "Dormant native Numbers export.",
    nativeEngine: "numbers",
    fallbackEngine: null,
    status: "helper-native",
    limitation: "Native helper route is separate from the browser-local public route.",
    helperPair: "numbers>pdf",
    requiresApp: "Numbers",
  },
  {
    id: "numbers-to-xlsx-native",
    inputs: ["numbers"],
    output: "xlsx",
    toolSlug: "numbers-to-excel",
    title: "Numbers to Excel via Numbers",
    description: "Dormant native Numbers export to XLSX.",
    nativeEngine: "numbers",
    fallbackEngine: null,
    status: "helper-native",
    limitation: "Native helper route is separate from the browser-local public route.",
    helperPair: "numbers>xlsx",
    requiresApp: "Numbers",
  },
  {
    id: "xlsx-to-pdf",
    inputs: ["xlsx", "xls"],
    output: "pdf",
    toolSlug: "excel-to-pdf",
    title: "Excel to PDF",
    description: "Excel export.",
    nativeEngine: "excel",
    fallbackEngine: "libreoffice",
    status: "helper-native",
    limitation: "Spreadsheet conversion is not part of the public web product.",
    helperPair: "xlsx>pdf",
    requiresApp: "Microsoft Excel",
  },
];

/** Kept in sync with the dormant helper package, never with public navigation. */
export const HELPER_ALLOWLIST = Array.from(
  new Set(
    DORMANT_NATIVE_CONVERSIONS.flatMap((conversion) => {
      const extras =
        conversion.id === "pptx-to-pdf"
          ? ["ppt>pdf"]
          : conversion.id === "xlsx-to-pdf"
            ? ["xls>pdf"]
            : [];
      return [conversion.helperPair, ...extras];
    }),
  ),
);

export function isHelperConversionAllowed(from: string, to: string): boolean {
  return HELPER_ALLOWLIST.includes(
    `${from.toLowerCase()}>${to.toLowerCase()}`,
  );
}
