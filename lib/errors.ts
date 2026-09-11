import { ArchiveInspectionError } from "./safeArchive";
import { FileReadError } from "./files";

export type UserErrorCode =
  | "file-read"
  | "invalid-pdf"
  | "invalid-image"
  | "invalid-docx"
  | "invalid-markdown"
  | "unsafe-container"
  | "invalid-container"
  | "browser-capability"
  | "input"
  | "unknown";

export interface UserFacingError {
  code: UserErrorCode;
  message: string;
  /** The original exception is retained for tests and local debugging, not rendered. */
  cause: unknown;
  debugMessage: string;
}

function errorText(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return typeof cause === "string" ? cause : "";
}

function archiveMessage(code: ArchiveInspectionError["code"]): string {
  switch (code) {
    case "ARCHIVE_ENCRYPTED":
      return "This file is encrypted and can’t be opened in the browser.";
    case "ARCHIVE_UNSUPPORTED_COMPRESSION":
      return "This file uses a compression method Folio can’t open in the browser.";
    case "ARCHIVE_TOO_LARGE":
    case "ARCHIVE_TOO_COMPLEX":
    case "ARCHIVE_ENTRY_TOO_LARGE":
    case "ARCHIVE_COMPRESSION_RATIO":
    case "ARCHIVE_ZIP64_UNSUPPORTED":
      return "This file is too complex to inspect safely in the browser.";
    case "ARCHIVE_UNSAFE_PATH":
    case "ARCHIVE_DUPLICATE_PATH":
      return "This file container has unsafe or duplicate entries and can’t be opened.";
    case "ARCHIVE_ENTRY_NOT_FOUND":
    case "ARCHIVE_MALFORMED":
      return "This file container is incomplete or damaged. Choose another file.";
  }
}

function knownMessage(message: string): { code: UserErrorCode; message: string } | null {
  if (/^Could not read this PDF|invalid PDF structure|not a valid PDF/i.test(message)) {
    return {
      code: "invalid-pdf",
      message: "Could not read this PDF. It may be corrupted, password-protected, or not a valid PDF.",
    };
  }
  if (/^Could not read this Markdown|valid UTF-8|binary data|larger than Folio’s 10 MB/i.test(message)) {
    return { code: "invalid-markdown", message: "We couldn’t read this Markdown file. Choose a valid UTF-8 .md file and try again." };
  }
  if (/^Could not read .+\.|^Could not render page|^Generated JPEG could not be decoded/i.test(message)) {
    return { code: "invalid-image", message: "We couldn’t read this image. Choose a valid JPG or PNG and try again." };
  }
  if (/DOCX|Word document|document\.xml/i.test(message)) {
    return { code: "invalid-docx", message: "We couldn’t read this Word document. Choose a valid DOCX file and try again." };
  }
  if (/Canvas unavailable|browser could not render/i.test(message)) {
    return { code: "browser-capability", message: "This browser couldn’t render the file. Try again or use another browser." };
  }
  if (/^Add at least|^Add exactly|^Empty page or range found|^No valid pages|^No images|^No readable content|scanned pages|Text extraction is not available|more than \d+ pages|more extractable text|Markdown block is too large|Markdown file would create more than|^This Apple document has no embedded PDF preview|^The embedded PDF preview is not valid|^Only .+ allowed|^Select one file at a time/i.test(message)) {
    return { code: "input", message };
  }
  return null;
}

export function describeError(
  cause: unknown,
  fallback = "Something went wrong. Check the file and try again.",
): UserFacingError {
  const rawMessage = errorText(cause);
  let code: UserErrorCode = "unknown";
  let message = fallback;

  if (cause instanceof FileReadError || /I\/O read operation failed|NotReadableError/i.test(rawMessage)) {
    code = "file-read";
    message = "We couldn’t read this file. Remove it and select it again.";
  } else if (cause instanceof ArchiveInspectionError) {
    code = cause.code === "ARCHIVE_UNSAFE_PATH" || cause.code === "ARCHIVE_DUPLICATE_PATH"
      ? "unsafe-container"
      : "invalid-container";
    message = archiveMessage(cause.code);
  } else {
    const known = knownMessage(rawMessage);
    if (known) {
      code = known.code;
      message = known.message;
    }
  }

  return {
    code,
    message,
    cause,
    debugMessage: rawMessage || "Non-Error exception",
  };
}
