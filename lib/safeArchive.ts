/**
 * Bounded, in-memory ZIP inspection for document containers.
 *
 * This parser intentionally does not extract arbitrary entries or write to
 * disk. It validates the central directory, rejects Zip64 and unsafe paths,
 * applies resource limits, and only then permits bounded entry reads.
 */

export type ArchiveErrorCode =
  | "ARCHIVE_TOO_LARGE"
  | "ARCHIVE_TOO_COMPLEX"
  | "ARCHIVE_ENTRY_TOO_LARGE"
  | "ARCHIVE_COMPRESSION_RATIO"
  | "ARCHIVE_ZIP64_UNSUPPORTED"
  | "ARCHIVE_ENCRYPTED"
  | "ARCHIVE_UNSUPPORTED_COMPRESSION"
  | "ARCHIVE_DUPLICATE_PATH"
  | "ARCHIVE_UNSAFE_PATH"
  | "ARCHIVE_MALFORMED"
  | "ARCHIVE_ENTRY_NOT_FOUND";

export class ArchiveInspectionError extends Error {
  readonly code: ArchiveErrorCode;

  constructor(code: ArchiveErrorCode, message: string) {
    super(message);
    this.name = "ArchiveInspectionError";
    this.code = code;
  }
}

export interface ArchiveLimits {
  maxInputBytes: number;
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalUncompressedBytes: number;
  maxCompressionRatio: number;
}

export const DESKTOP_ARCHIVE_LIMITS: ArchiveLimits = {
  maxInputBytes: 100 * 1024 * 1024,
  maxEntries: 10_000,
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalUncompressedBytes: 256 * 1024 * 1024,
  maxCompressionRatio: 200,
};

export const MOBILE_ARCHIVE_LIMITS: ArchiveLimits = {
  maxInputBytes: 25 * 1024 * 1024,
  maxEntries: 10_000,
  maxEntryBytes: 16 * 1024 * 1024,
  maxTotalUncompressedBytes: 64 * 1024 * 1024,
  maxCompressionRatio: 200,
};

export interface SafeArchiveEntry {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: 0 | 8;
  crc32: number;
  localHeaderOffset: number;
  isDirectory: boolean;
}

export interface SafeArchive {
  entries: SafeArchiveEntry[];
  totalUncompressedBytes: number;
  limits: ArchiveLimits;
}

const EOCD = 0x06054b50;
const ZIP64_EOCD = 0x06064b50;
const ZIP64_LOCATOR = 0x07064b50;
const CENTRAL_DIRECTORY = 0x02014b50;
const LOCAL_FILE = 0x04034b50;

function malformed(message: string): ArchiveInspectionError {
  return new ArchiveInspectionError("ARCHIVE_MALFORMED", message);
}

function readU16(view: DataView, offset: number): number {
  if (offset + 2 > view.byteLength) throw malformed("ZIP field is truncated.");
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number): number {
  if (offset + 4 > view.byteLength) throw malformed("ZIP field is truncated.");
  return view.getUint32(offset, true);
}

function decodePath(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw malformed("ZIP entry path is not valid UTF-8.");
  }
}

function validatePath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  if (
    normalized.length === 0 ||
    normalized.includes("\0") ||
    [...normalized].some((char) => char.charCodeAt(0) < 0x20) ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new ArchiveInspectionError(
      "ARCHIVE_UNSAFE_PATH",
      `Unsafe ZIP entry path: ${path}`,
    );
  }

  const parts = normalized.split("/");
  for (const part of parts) {
    if (part === "." || part === "..") {
      throw new ArchiveInspectionError(
        "ARCHIVE_UNSAFE_PATH",
        `Traversal ZIP entry path: ${path}`,
      );
    }
  }
  return normalized;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const start = Math.max(0, bytes.length - 22 - 65_535);
  for (let offset = bytes.length - 22; offset >= start; offset--) {
    if (offset < 0 || readU32(view, offset) !== EOCD) continue;
    const commentLength = readU16(view, offset + 20);
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  throw malformed("ZIP end-of-central-directory record was not found.");
}

function isZip64Value(value: number): boolean {
  return value === 0xffff || value === 0xffffffff;
}

export function inspectZip(
  bytes: Uint8Array,
  limits: ArchiveLimits = DESKTOP_ARCHIVE_LIMITS,
): SafeArchive {
  if (bytes.length > limits.maxInputBytes) {
    throw new ArchiveInspectionError(
      "ARCHIVE_TOO_LARGE",
      "The archive is larger than the supported safety limit.",
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset >= 20 && readU32(view, eocdOffset - 20) === ZIP64_LOCATOR) {
    throw new ArchiveInspectionError(
      "ARCHIVE_ZIP64_UNSUPPORTED",
      "Zip64 archives are not supported by the bounded browser inspector.",
    );
  }
  if (eocdOffset >= 56 && readU32(view, eocdOffset - 56) === ZIP64_EOCD) {
    throw new ArchiveInspectionError(
      "ARCHIVE_ZIP64_UNSUPPORTED",
      "Zip64 archives are not supported by the bounded browser inspector.",
    );
  }

  const diskNumber = readU16(view, eocdOffset + 4);
  const centralDisk = readU16(view, eocdOffset + 6);
  const entriesOnDisk = readU16(view, eocdOffset + 8);
  const entryCount = readU16(view, eocdOffset + 10);
  const centralSize = readU32(view, eocdOffset + 12);
  const centralOffset = readU32(view, eocdOffset + 16);

  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    isZip64Value(entriesOnDisk) ||
    isZip64Value(entryCount) ||
    isZip64Value(centralSize) ||
    isZip64Value(centralOffset)
  ) {
    throw new ArchiveInspectionError(
      "ARCHIVE_ZIP64_UNSUPPORTED",
      "Multi-disk and Zip64 archives are not supported.",
    );
  }
  if (entryCount === 0) throw malformed("ZIP archive contains no entries.");
  if (entryCount > limits.maxEntries) {
    throw new ArchiveInspectionError(
      "ARCHIVE_TOO_COMPLEX",
      "The archive contains too many entries.",
    );
  }
  if (
    centralOffset > bytes.length ||
    centralSize > bytes.length - centralOffset ||
    centralOffset + centralSize > eocdOffset
  ) {
    throw malformed("ZIP central directory is outside the input.");
  }

  const entries: SafeArchiveEntry[] = [];
  const seen = new Set<string>();
  let cursor = centralOffset;
  let totalUncompressedBytes = 0;

  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > centralOffset + centralSize || readU32(view, cursor) !== CENTRAL_DIRECTORY) {
      throw malformed("ZIP central directory entry is malformed.");
    }
    const flags = readU16(view, cursor + 8);
    const compressionMethod = readU16(view, cursor + 10);
    const crc32 = readU32(view, cursor + 16);
    const compressedSize = readU32(view, cursor + 20);
    const uncompressedSize = readU32(view, cursor + 24);
    const nameLength = readU16(view, cursor + 28);
    const extraLength = readU16(view, cursor + 30);
    const commentLength = readU16(view, cursor + 32);
    const diskStart = readU16(view, cursor + 34);
    const localHeaderOffset = readU32(view, cursor + 42);
    const recordLength = 46 + nameLength + extraLength + commentLength;

    if (cursor + recordLength > centralOffset + centralSize) {
      throw malformed("ZIP central directory entry is truncated.");
    }
    if (flags & 0x1) {
      throw new ArchiveInspectionError(
        "ARCHIVE_ENCRYPTED",
        "Encrypted ZIP entries cannot be inspected locally.",
      );
    }
    if (diskStart !== 0 || isZip64Value(localHeaderOffset)) {
      throw new ArchiveInspectionError(
        "ARCHIVE_ZIP64_UNSUPPORTED",
        "Multi-disk and Zip64 entries are not supported.",
      );
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new ArchiveInspectionError(
        "ARCHIVE_UNSUPPORTED_COMPRESSION",
        "The archive uses an unsupported compression method.",
      );
    }
    if (uncompressedSize > limits.maxEntryBytes) {
      throw new ArchiveInspectionError(
        "ARCHIVE_ENTRY_TOO_LARGE",
        "A ZIP entry is larger than the supported safety limit.",
      );
    }
    if (
      compressedSize === 0
        ? uncompressedSize > 0
        : uncompressedSize / compressedSize > limits.maxCompressionRatio
    ) {
      throw new ArchiveInspectionError(
        "ARCHIVE_COMPRESSION_RATIO",
        "A ZIP entry has an unsafe compression ratio.",
      );
    }
    if (uncompressedSize > limits.maxTotalUncompressedBytes - totalUncompressedBytes) {
      throw new ArchiveInspectionError(
        "ARCHIVE_TOO_COMPLEX",
        "The archive expands beyond the supported aggregate safety limit.",
      );
    }

    const path = validatePath(
      decodePath(bytes.subarray(cursor + 46, cursor + 46 + nameLength)),
    );
    if (seen.has(path)) {
      throw new ArchiveInspectionError(
        "ARCHIVE_DUPLICATE_PATH",
        `Duplicate ZIP entry path: ${path}`,
      );
    }
    seen.add(path);
    totalUncompressedBytes += uncompressedSize;
    entries.push({
      path,
      compressedSize,
      uncompressedSize,
      compressionMethod: compressionMethod as 0 | 8,
      crc32,
      localHeaderOffset,
      isDirectory: path.endsWith("/"),
    });
    cursor += recordLength;
  }

  if (cursor !== centralOffset + centralSize) {
    throw malformed("ZIP central directory size does not match its entries.");
  }

  return { entries, totalUncompressedBytes, limits };
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readLocalEntryData(
  bytes: Uint8Array,
  entry: SafeArchiveEntry,
): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localHeaderOffset;
  if (offset + 30 > bytes.length || readU32(view, offset) !== LOCAL_FILE) {
    throw malformed(`ZIP local header is missing for ${entry.path}.`);
  }
  const localCompressionMethod = readU16(view, offset + 8);
  if (localCompressionMethod !== entry.compressionMethod) {
    throw malformed(`ZIP compression metadata does not match for ${entry.path}.`);
  }
  const nameLength = readU16(view, offset + 26);
  const extraLength = readU16(view, offset + 28);
  const localName = validatePath(
    decodePath(bytes.subarray(offset + 30, offset + 30 + nameLength)),
  );
  if (localName !== entry.path) throw malformed("ZIP entry names do not match.");
  const dataStart = offset + 30 + nameLength + extraLength;
  if (dataStart > bytes.length || entry.compressedSize > bytes.length - dataStart) {
    throw malformed(`ZIP entry data is truncated for ${entry.path}.`);
  }
  return bytes.slice(dataStart, dataStart + entry.compressedSize);
}

export async function readZipEntry(
  bytes: Uint8Array,
  archive: SafeArchive,
  path: string,
): Promise<Uint8Array> {
  const entry = archive.entries.find((candidate) => candidate.path === path);
  if (!entry) {
    throw new ArchiveInspectionError(
      "ARCHIVE_ENTRY_NOT_FOUND",
      `ZIP entry was not found: ${path}`,
    );
  }
  const compressed = readLocalEntryData(bytes, entry);
  let result: Uint8Array;
  if (entry.compressionMethod === 0) {
    result = compressed;
  } else {
    if (typeof DecompressionStream !== "function") {
      throw new ArchiveInspectionError(
        "ARCHIVE_UNSUPPORTED_COMPRESSION",
        "This browser cannot safely decompress the archive entry.",
      );
    }
    const compressedCopy = new Uint8Array(compressed.length);
    compressedCopy.set(compressed);
    const stream = new Blob([compressedCopy.buffer]).stream().pipeThrough(
      new DecompressionStream("deflate-raw"),
    );
    result = await readDecompressedBytes(stream, entry.uncompressedSize);
  }
  if (result.length !== entry.uncompressedSize || crc32(result) !== entry.crc32) {
    throw malformed(`ZIP entry failed integrity checks: ${entry.path}.`);
  }
  return result;
}

async function readDecompressedBytes(
  stream: ReadableStream<Uint8Array>,
  expectedLength: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > expectedLength) {
        throw new ArchiveInspectionError(
          "ARCHIVE_ENTRY_TOO_LARGE",
          "A ZIP entry expanded beyond its declared safety limit.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
