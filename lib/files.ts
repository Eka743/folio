import type { FolioTool } from "./tools";

export interface FileComplaint {
  fileName: string;
  reason: string;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${Number.isInteger(value) ? String(value) : value >= 100 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function formatPercentChange(before: number, after: number): string {
  if (before <= 0) return "—";
  const pct = ((after - before) / before) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/** Make a filename safe for download across browsers/OSes. */
export function safeFileName(name: string, fallback = "folio-output"): string {
  const base = name
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[a-z0-9]+$/i, "")
    .trim();
  const cleaned = (base || "")
    .replace(/[^\w\-. ()[\]]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\- ]+|[.\- ]+$/g, "")
    .slice(0, 120);
  return cleaned || fallback;
}

export function withExtension(base: string, ext: string): string {
  return `${safeFileName(base)}.${ext}`;
}

let fileReadQueue: Promise<void> = Promise.resolve();
const FILE_READ_TIMEOUT_MS = 750;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), FILE_READ_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

/**
 * Read a local Blob/File into an independent byte snapshot.
 *
 * Safari can reject or leave Blob.arrayBuffer() pending for some
 * picker-backed files. FileReader uses a separate compatibility path and is
 * the primary read path here. The copy also means downstream parsers never
 * share a browser-owned buffer.
 */
async function readFileBytesInternal(blob: Blob): Promise<Uint8Array> {
  let readerError: unknown;
  if (typeof FileReader === "function") {
    try {
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        let settled = false;
        const timeout = setTimeout(() => {
          try {
            reader.abort();
          } catch {
            // The reader may already have completed between the timer and abort.
          }
          if (!settled) {
            settled = true;
            reject(new Error("The browser did not finish reading the file."));
          }
        }, FILE_READ_TIMEOUT_MS);
        const finish = (callback: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          callback();
        };
        reader.onload = () => {
          finish(() => {
            if (reader.result instanceof ArrayBuffer) resolve(reader.result);
            else reject(new Error("The browser returned no readable file data."));
          });
        };
        reader.onerror = () => finish(() => reject(reader.error ?? new Error("FileReader failed.")));
        reader.onabort = () => finish(() => reject(new Error("The file read was aborted.")));
        reader.readAsArrayBuffer(blob);
      });
      const bytes = new Uint8Array(buffer);
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      return copy;
    } catch (fallbackError) {
      readerError = fallbackError;
    }
  }

  try {
    const buffer = await withTimeout(blob.arrayBuffer(), "The browser did not finish reading the file.");
    const bytes = new Uint8Array(buffer);
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return copy;
  } catch (nativeError) {
    throw new FileReadError(
      "We couldn’t read this file. Remove it and select it again.",
      { nativeError, readerError },
    );
  }
}

/**
 * Keep browser-owned Blob handles out of competing read operations. This is
 * especially important in WebKit when a preview and content inspection start
 * from the same picker-backed File at nearly the same time.
 */
export function readFileBytes(blob: Blob): Promise<Uint8Array> {
  const next = fileReadQueue.then(() => readFileBytesInternal(blob));
  fileReadQueue = next.then(() => undefined, () => undefined);
  return next;
}

export class FileReadError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "FileReadError";
    this.cause = cause;
  }
}

/**
 * Validate candidate files against a tool's rules.
 * Returns the accepted files plus human-readable complaints.
 */
export function validateFiles(
  tool: FolioTool,
  incoming: File[],
  alreadyAccepted: number,
  alreadyAcceptedBytes = 0,
): { accepted: File[]; complaints: FileComplaint[] } {
  const accepted: File[] = [];
  const complaints: FileComplaint[] = [];
  let acceptedBytes = alreadyAcceptedBytes;

  for (const file of incoming) {
    if (alreadyAccepted + accepted.length >= tool.maxFiles) {
      complaints.push({
        fileName: file.name || "Unnamed file",
        reason: `Only ${tool.maxFiles} file${tool.maxFiles === 1 ? "" : "s"} allowed for ${tool.name}.`,
      });
      continue;
    }

    const ext = file.name.includes(".")
      ? `.${file.name.split(".").pop()!.toLowerCase()}`
      : "";
    const allowedExts = tool.accepts
      .split(",")
      .map((s) => s.trim().toLowerCase());
    const mimeOk =
      tool.acceptMime.length === 0 || tool.acceptMime.includes(file.type);
    // Some browsers report empty/incorrect MIME types; fall back to extension.
    const extOk = allowedExts.includes(ext);

    if (!mimeOk && !extOk) {
      complaints.push({
        fileName: file.name || "Unnamed file",
        reason: `${tool.name} accepts ${tool.accepts} files.`,
      });
      continue;
    }

    if (file.size === 0) {
      complaints.push({
        fileName: file.name,
        reason: "This file is empty (0 bytes).",
      });
      continue;
    }

    if (file.size > tool.maxFileBytes) {
      complaints.push({
        fileName: file.name,
        reason: `Too large (${formatBytes(file.size)}). Limit is ${formatBytes(tool.maxFileBytes)} per file.`,
      });
      continue;
    }

    if (acceptedBytes + file.size > tool.maxTotalBytes) {
      complaints.push({
        fileName: file.name,
        reason: `The selected files are larger than Folio’s ${formatBytes(tool.maxTotalBytes)} total limit for ${tool.name}.`,
      });
      continue;
    }

    accepted.push(file);
    acceptedBytes += file.size;
  }

  return { accepted, complaints };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadBytes(
  bytes: Uint8Array,
  mime: string,
  filename: string,
): void {
  // Copy into a plain ArrayBuffer so TS DOM types accept it.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  downloadBlob(new Blob([copy], { type: mime }), filename);
}
