import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { inspectZip, readZipEntry, type ArchiveLimits } from "./safeArchive";

async function makeZip(
  entries: Record<string, string>,
  compression: "STORE" | "DEFLATE" = "STORE",
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
  return zip.generateAsync({ type: "uint8array", compression });
}

function replaceAscii(bytes: Uint8Array, from: string, to: string): Uint8Array {
  const output = new Uint8Array(bytes);
  const source = new TextEncoder().encode(from);
  const replacement = new TextEncoder().encode(to);
  if (source.length !== replacement.length) throw new Error("test replacement must keep its length");
  for (let offset = 0; offset <= output.length - source.length; offset++) {
    if (source.every((value, index) => output[offset + index] === value)) {
      output.set(replacement, offset);
    }
  }
  return output;
}

const tinyLimits: ArchiveLimits = {
  maxInputBytes: 1024 * 1024,
  maxEntries: 10,
  maxEntryBytes: 1024,
  maxTotalUncompressedBytes: 2048,
  maxCompressionRatio: 10,
};

describe("safe archive inspection", () => {
  it("inspects a valid archive and reads a stored entry with integrity checks", async () => {
    const bytes = await makeZip({ "Metadata/Properties.plist": "pages document" });
    const archive = inspectZip(bytes);
    expect(archive.entries.filter((entry) => !entry.isDirectory)).toHaveLength(1);
    expect(new TextDecoder().decode(await readZipEntry(bytes, archive, "Metadata/Properties.plist"))).toBe(
      "pages document",
    );
  });

  it("supports bounded deflate reads", async () => {
    const bytes = await makeZip({ "word/document.xml": "hello world" }, "DEFLATE");
    const archive = inspectZip(bytes);
    expect(new TextDecoder().decode(await readZipEntry(bytes, archive, "word/document.xml"))).toBe(
      "hello world",
    );
  });

  it("rejects traversal paths even when the extension looks like a document", async () => {
    const bytes = await makeZip({ "safe.txt": "nope" });
    const hostile = replaceAscii(bytes, "safe.txt", "../x.txt");
    expect(() => inspectZip(hostile)).toThrowError(
      expect.objectContaining({ code: "ARCHIVE_UNSAFE_PATH" }),
    );
  });

  it("rejects duplicate paths, unsupported limits and truncated archives", async () => {
    const distinct = await makeZip({ "a.txt": "one", "b.txt": "two" });
    const duplicate = replaceAscii(distinct, "b.txt", "a.txt");
    expect(() => inspectZip(duplicate)).toThrowError(
      expect.objectContaining({ code: "ARCHIVE_DUPLICATE_PATH" }),
    );

    const tooLarge = await makeZip({ "large.txt": "12345" });
    expect(() => inspectZip(tooLarge, { ...tinyLimits, maxEntryBytes: 3 })).toThrowError(
      expect.objectContaining({ code: "ARCHIVE_ENTRY_TOO_LARGE" }),
    );

    const compressed = await makeZip({ "ratio.txt": "a".repeat(200) }, "DEFLATE");
    expect(() => inspectZip(compressed, { ...tinyLimits, maxCompressionRatio: 2 })).toThrowError(
      expect.objectContaining({ code: "ARCHIVE_COMPRESSION_RATIO" }),
    );

    expect(() => inspectZip(tooLarge.slice(0, -5))).toThrowError(
      expect.objectContaining({ code: "ARCHIVE_MALFORMED" }),
    );
  });

  it("rejects corrupted entry data after central-directory inspection", async () => {
    const bytes = await makeZip({ "data.txt": "integrity" });
    const archive = inspectZip(bytes);
    const corrupted = new Uint8Array(bytes);
    const marker = new TextEncoder().encode("integrity");
    const offset = corrupted.findIndex((value, index) =>
      marker.every((item, markerIndex) => corrupted[index + markerIndex] === item),
    );
    expect(offset).toBeGreaterThanOrEqual(0);
    corrupted[offset] ^= 1;
    await expect(readZipEntry(corrupted, archive, "data.txt")).rejects.toThrow(
      /integrity checks/,
    );
  });
});
