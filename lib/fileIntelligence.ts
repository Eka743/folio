import {
  ArchiveInspectionError,
  DESKTOP_ARCHIVE_LIMITS,
  inspectZip,
  readZipEntry,
  type ArchiveLimits,
  type SafeArchive,
} from "./safeArchive";
import { readFileBytes } from "./files";

export type FolioFileKind =
  | "pdf"
  | "jpeg"
  | "png"
  | "docx"
  | "pages"
  | "keynote"
  | "numbers"
  | "unknown";

export type FileGeneration = "modern" | "legacy" | "unknown";

export type FileCapabilityAction =
  | "merge-pdf"
  | "split-pdf"
  | "rotate-pdf"
  | "compress-pdf"
  | "pdf-to-jpg"
  | "image-to-pdf"
  | "docx-to-pdf"
  | "embedded-pdf"
  | "preview"
  | "experimental-render";

export type FileWarning =
  | "extension-mismatch"
  | "mime-mismatch"
  | "malformed-content"
  | "unsafe-container"
  | "unsupported-container"
  | "renderer-evaluation-pending";

export interface FileInspection {
  fileName: string;
  sizeBytes: number;
  kind: FolioFileKind;
  formatLabel: string;
  generation: FileGeneration;
  confidence: "high" | "medium" | "low" | "none";
  valid: boolean;
  safety: "safe" | "rejected";
  isContainer: boolean;
  extension: string;
  mime: string;
  extensionMatch: boolean;
  mimeMatch: boolean;
  supportedActions: FileCapabilityAction[];
  warnings: FileWarning[];
  warningMessages: string[];
  archiveErrorCode?: string;
}

export interface InspectFileOptions {
  limits?: ArchiveLimits;
}

const MAX_INSPECTION_BYTES = DESKTOP_ARCHIVE_LIMITS.maxInputBytes;
const MAX_METADATA_ENTRY_BYTES = 2 * 1024 * 1024;
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
];

function hasBytes(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function hasAscii(bytes: Uint8Array, text: string, start = 0, end = bytes.length): boolean {
  const needle = new TextEncoder().encode(text);
  const limit = Math.min(end, bytes.length) - needle.length;
  for (let offset = Math.max(0, start); offset <= limit; offset++) {
    let found = true;
    for (let index = 0; index < needle.length; index++) {
      if (bytes[offset + index] !== needle[index]) {
        found = false;
        break;
      }
    }
    if (found) return true;
  }
  return false;
}

function fileExtension(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? `.${match[1].toLowerCase()}` : "";
}

function labelFor(kind: FolioFileKind): string {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "jpeg":
      return "JPEG image";
    case "png":
      return "PNG image";
    case "docx":
      return "Word document";
    case "pages":
      return "Apple Pages document";
    case "keynote":
      return "Apple Keynote presentation";
    case "numbers":
      return "Apple Numbers spreadsheet";
    default:
      return "Unknown file";
  }
}

function actionsFor(
  kind: FolioFileKind,
  hasEmbeddedPdf: boolean,
): FileCapabilityAction[] {
  switch (kind) {
    case "pdf":
      return [
        "merge-pdf",
        "split-pdf",
        "rotate-pdf",
        "compress-pdf",
        "pdf-to-jpg",
      ];
    case "jpeg":
    case "png":
      return ["image-to-pdf"];
    case "docx":
      return ["docx-to-pdf"];
    case "pages":
    case "keynote":
    case "numbers":
      return hasEmbeddedPdf ? ["embedded-pdf"] : [];
    default:
      return [];
  }
}

function expectedExtensions(kind: FolioFileKind): string[] {
  switch (kind) {
    case "pdf":
      return [".pdf"];
    case "jpeg":
      return [".jpg", ".jpeg"];
    case "png":
      return [".png"];
    case "docx":
      return [".docx"];
    case "pages":
      return [".pages"];
    case "keynote":
      return [".key", ".keynote"];
    case "numbers":
      return [".numbers"];
    default:
      return [];
  }
}

function expectedMimes(kind: FolioFileKind): string[] {
  switch (kind) {
    case "pdf":
      return ["application/pdf"];
    case "jpeg":
      return ["image/jpeg"];
    case "png":
      return ["image/png"];
    case "docx":
      return [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
    default:
      return [];
  }
}

function finishInspection(
  file: File,
  kind: FolioFileKind,
  options: {
    confidence: FileInspection["confidence"];
    generation?: FileGeneration;
    valid: boolean;
    safety?: FileInspection["safety"];
    isContainer?: boolean;
    warnings?: FileWarning[];
    warningMessages?: string[];
    hasEmbeddedPdf?: boolean;
    archiveErrorCode?: string;
  },
): FileInspection {
  const extension = fileExtension(file.name);
  const expectedExts = expectedExtensions(kind);
  const expectedMimeTypes = expectedMimes(kind);
  const extensionMatch = expectedExts.length > 0 && expectedExts.includes(extension);
  const mimeMatch = expectedMimeTypes.length > 0 && expectedMimeTypes.includes(file.type);
  const warnings = [...(options.warnings ?? [])];
  const warningMessages = [...(options.warningMessages ?? [])];
  if (kind !== "unknown" && !extensionMatch) {
    warnings.push("extension-mismatch");
    warningMessages.push(
      `The filename extension does not match the detected ${labelFor(kind)} content.`,
    );
  }
  if (kind !== "unknown" && file.type && !mimeMatch && expectedMimeTypes.length > 0) {
    warnings.push("mime-mismatch");
  }
  return {
    fileName: file.name,
    sizeBytes: file.size,
    kind,
    formatLabel: labelFor(kind),
    generation: options.generation ?? "unknown",
    confidence: options.confidence,
    valid: options.valid,
    safety: options.safety ?? (options.valid ? "safe" : "rejected"),
    isContainer: options.isContainer ?? false,
    extension,
    mime: file.type,
    extensionMatch,
    mimeMatch,
    supportedActions: actionsFor(kind, options.hasEmbeddedPdf ?? false),
    warnings: [...new Set(warnings)],
    warningMessages: [...new Set(warningMessages)],
    ...(options.archiveErrorCode
      ? { archiveErrorCode: options.archiveErrorCode }
      : {}),
  };
}

function hasPdfEnd(bytes: Uint8Array): boolean {
  return hasAscii(bytes, "%%EOF", Math.max(0, bytes.length - 2 * 1024 * 1024));
}

function inspectPdf(file: File, bytes: Uint8Array): FileInspection {
  const valid = hasBytes(bytes, PDF_SIGNATURE) && hasPdfEnd(bytes);
  return finishInspection(file, "pdf", {
    confidence: "high",
    valid,
    warningMessages: valid ? [] : ["The PDF header or end marker is missing."],
    warnings: valid ? [] : ["malformed-content"],
  });
}

function inspectJpeg(file: File, bytes: Uint8Array): FileInspection {
  const valid = hasBytes(bytes, JPEG_SIGNATURE) && bytes.length >= 4 &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  return finishInspection(file, "jpeg", {
    confidence: "high",
    valid,
    warningMessages: valid ? [] : ["The JPEG start or end marker is missing."],
    warnings: valid ? [] : ["malformed-content"],
  });
}

function inspectPng(file: File, bytes: Uint8Array): FileInspection {
  const hasHeader = hasBytes(bytes, PNG_SIGNATURE);
  const hasIhdr = hasHeader && bytes.length >= 33 &&
    new TextDecoder().decode(bytes.subarray(12, 16)) === "IHDR";
  const width = hasIhdr
    ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16)
    : 0;
  const height = hasIhdr
    ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20)
    : 0;
  const valid = hasIhdr && width > 0 && height > 0 && hasAscii(bytes, "IEND");
  return finishInspection(file, "png", {
    confidence: "high",
    valid,
    warningMessages: valid ? [] : ["The PNG signature, dimensions or end marker is invalid."],
    warnings: valid ? [] : ["malformed-content"],
  });
}

function entriesByLowerPath(archive: SafeArchive): Map<string, string> {
  return new Map(archive.entries.map((entry) => [entry.path.toLowerCase(), entry.path]));
}

function findPath(archive: SafeArchive, predicate: (lowerPath: string) => boolean): string | undefined {
  return archive.entries.find((entry) => predicate(entry.path.toLowerCase()))?.path;
}

function isIWorkMarkerPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.includes("metadata") || lower.includes("properties") ||
    lower.endsWith("index.xml") || lower.endsWith("info.plist") ||
    lower.includes("buildversion");
}

function kindFromText(text: string): Exclude<FolioFileKind, "pdf" | "jpeg" | "png" | "docx" | "unknown"> | undefined {
  const lower = text.toLowerCase();
  if (/(?:iwork|apple).*pages|pages.*(?:document|template)|com\.apple\.pages/.test(lower)) {
    return "pages";
  }
  if (/(?:iwork|apple).*keynote|keynote.*(?:document|template)|com\.apple\.keynote/.test(lower)) {
    return "keynote";
  }
  if (/(?:iwork|apple).*numbers|numbers.*(?:document|template)|com\.apple\.numbers/.test(lower)) {
    return "numbers";
  }
  return undefined;
}

async function inspectZipContainer(
  file: File,
  bytes: Uint8Array,
  limits: ArchiveLimits,
): Promise<FileInspection> {
  let archive: SafeArchive;
  try {
    archive = inspectZip(bytes, limits);
  } catch (error) {
    if (error instanceof ArchiveInspectionError) {
      return finishInspection(file, "unknown", {
        confidence: "none",
        valid: false,
        safety: "rejected",
        isContainer: true,
        warnings: [
          error.code === "ARCHIVE_UNSAFE_PATH" ? "unsafe-container" : "malformed-content",
        ],
        warningMessages: ["This document container is malformed or exceeds Folio’s safety limits."],
        archiveErrorCode: error.code,
      });
    }
    throw error;
  }

  const paths = entriesByLowerPath(archive);
  const contentTypesPath = paths.get("[content_types].xml");
  const wordDocumentPath = findPath(archive, (path) => path === "word/document.xml");
  if (contentTypesPath && wordDocumentPath) {
    return finishInspection(file, "docx", {
      confidence: "high",
      generation: "modern",
      valid: true,
      isContainer: true,
    });
  }

  const iwaCount = archive.entries.filter((entry) =>
    entry.path.toLowerCase().startsWith("index/") && entry.path.toLowerCase().endsWith(".iwa"),
  ).length;
  const hasLegacyMarker = Boolean(
    findPath(archive, (path) =>
      path === "index.xml" || path === "quicklook/preview.pdf" ||
      path === "preview.pdf" || path.includes("preview.jpg"),
    ),
  );
  const hasIWorkStructure = iwaCount > 0 || hasLegacyMarker;
  if (!hasIWorkStructure) {
    return finishInspection(file, "unknown", {
      confidence: "low",
      valid: false,
      safety: "safe",
      isContainer: true,
      warnings: ["unsupported-container"],
      warningMessages: ["This ZIP container is not a supported document format."],
    });
  }

  let detectedKind: FolioFileKind | undefined;
  const markerEntries = archive.entries.filter((entry) =>
    isIWorkMarkerPath(entry.path) && !entry.isDirectory &&
    entry.uncompressedSize <= MAX_METADATA_ENTRY_BYTES,
  );
  for (const entry of markerEntries.slice(0, 8)) {
    try {
      const entryBytes = await readZipEntry(bytes, archive, entry.path);
      const text = new TextDecoder().decode(entryBytes);
      detectedKind = kindFromText(text);
      if (detectedKind) break;
    } catch {
      // A non-text metadata entry is not evidence against the otherwise valid
      // container. Continue looking at the next bounded marker entry.
    }
  }

  const extension = fileExtension(file.name);
  if (!detectedKind && extension === ".pages") detectedKind = "pages";
  if (!detectedKind && (extension === ".key" || extension === ".keynote")) detectedKind = "keynote";
  if (!detectedKind && extension === ".numbers") detectedKind = "numbers";
  if (!detectedKind) {
    return finishInspection(file, "unknown", {
      confidence: "low",
      generation: iwaCount > 0 ? "modern" : "legacy",
      valid: false,
      safety: "safe",
      isContainer: true,
      warnings: ["unsupported-container"],
      warningMessages: ["This Apple document could not be identified as Pages, Keynote or Numbers."],
    });
  }

  const previewPath = findPath(archive, (path) => path === "quicklook/preview.pdf");
  let hasEmbeddedPdf = false;
  if (previewPath) {
    try {
      const preview = await readZipEntry(bytes, archive, previewPath);
      hasEmbeddedPdf = hasBytes(preview, PDF_SIGNATURE) && hasPdfEnd(preview);
    } catch {
      hasEmbeddedPdf = false;
    }
  }
  return finishInspection(file, detectedKind, {
    confidence: detectedKind === "pages" && extension === ".pages" ? "high" : "medium",
    generation: iwaCount > 0 ? "modern" : "legacy",
    valid: true,
    safety: "safe",
    isContainer: true,
    hasEmbeddedPdf,
    warnings: ["renderer-evaluation-pending"],
    warningMessages: [
      "Browser-native rendering for Apple documents is still experimental; no document conversion is enabled yet.",
    ],
  });
}

export async function inspectFile(
  file: File,
  options: InspectFileOptions = {},
): Promise<FileInspection> {
  if (file.size === 0) {
    return finishInspection(file, "unknown", {
      confidence: "none",
      valid: false,
      safety: "rejected",
      warnings: ["malformed-content"],
      warningMessages: ["This file is empty (0 bytes)."],
    });
  }
  if (file.size > MAX_INSPECTION_BYTES) {
    return finishInspection(file, "unknown", {
      confidence: "none",
      valid: false,
      safety: "rejected",
      warnings: ["unsafe-container"],
      warningMessages: ["This file is larger than Folio’s 100 MB local inspection limit."],
      archiveErrorCode: "ARCHIVE_TOO_LARGE",
    });
  }

  const bytes = await readFileBytes(file);
  if (hasBytes(bytes, PDF_SIGNATURE)) return inspectPdf(file, bytes);
  if (hasBytes(bytes, JPEG_SIGNATURE)) return inspectJpeg(file, bytes);
  if (hasBytes(bytes, PNG_SIGNATURE)) return inspectPng(file, bytes);
  if (bytes.length >= 4 && readU32(bytes, 0) === 0x04034b50) {
    return inspectZipContainer(file, bytes, options.limits ?? DESKTOP_ARCHIVE_LIMITS);
  }
  return finishInspection(file, "unknown", {
    confidence: "none",
    valid: false,
    safety: "safe",
    warningMessages: ["Folio could not identify this file from its content."],
  });
}

/** Read only the exact QuickLook PDF entry from an already inspected iWork file. */
export async function readEmbeddedPdfPreview(
  file: File,
  options: InspectFileOptions = {},
): Promise<Uint8Array> {
  const bytes = await readFileBytes(file);
  const archive = inspectZip(bytes, options.limits ?? DESKTOP_ARCHIVE_LIMITS);
  const previewPath = findPath(
    archive,
    (path) => path === "quicklook/preview.pdf",
  );
  if (!previewPath) throw new Error("This Apple document has no embedded PDF preview.");
  const preview = await readZipEntry(bytes, archive, previewPath);
  if (!hasBytes(preview, PDF_SIGNATURE) || !hasPdfEnd(preview)) {
    throw new Error("The embedded PDF preview is not valid.");
  }
  return preview;
}

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

export function capabilityLabel(action: FileCapabilityAction): string {
  switch (action) {
    case "merge-pdf":
      return "Merge PDFs";
    case "split-pdf":
      return "Extract PDF pages";
    case "rotate-pdf":
      return "Rotate PDF";
    case "compress-pdf":
      return "Compress PDF";
    case "pdf-to-jpg":
      return "Convert PDF to JPG";
    case "image-to-pdf":
      return "Create a PDF";
    case "docx-to-pdf":
      return "Convert to PDF";
    case "embedded-pdf":
      return "Open embedded PDF preview";
    case "preview":
      return "Preview";
    case "experimental-render":
      return "Try experimental renderer";
  }
}
