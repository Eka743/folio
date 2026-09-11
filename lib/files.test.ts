import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatPercentChange,
  readFileBytes,
  safeFileName,
  validateFiles,
  withExtension,
} from "./files";
import { TOOLS } from "./tools";

function fakeFile(name: string, size: number, type: string): File {
  const bytes = new Uint8Array(Math.min(size, 16));
  const f = new File([bytes], name, { type });
  // File sizes are read-only; override for validation tests.
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("formatBytes", () => {
  it("formats small and large sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
  });
});

describe("formatPercentChange", () => {
  it("computes signed percentages", () => {
    expect(formatPercentChange(1000, 800)).toBe("-20.0%");
    expect(formatPercentChange(1000, 1000)).toBe("0.0%");
  });
});

describe("safeFileName / withExtension", () => {
  it("strips directories and extensions", () => {
    expect(safeFileName("C:\\docs\\Report Q2.pdf")).toBe("Report Q2");
    expect(withExtension("a/b.png", "pdf")).toBe("b.pdf");
  });

  it("falls back on hostile names", () => {
    expect(safeFileName("...")).toBe("folio-output");
  });
});

describe("readFileBytes", () => {
  it("returns an independent byte snapshot", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "sample.pdf");
    const first = await readFileBytes(file);
    first[0] = 99;
    const second = await readFileBytes(file);

    expect([...second]).toEqual([1, 2, 3]);
  });

  it("hides low-level read failures behind an actionable error", async () => {
    const unreadable = {
      arrayBuffer: async () => {
        throw new DOMException("The I/O read operation failed.", "NotReadableError");
      },
    } as unknown as Blob;

    await expect(readFileBytes(unreadable)).rejects.toMatchObject({
      name: "FileReadError",
      message: "We couldn’t read this file. Remove it and select it again.",
    });
  });

  it("reports when both browser read paths fail", async () => {
    const originalReader = globalThis.FileReader;
    class FailingReader {
      result: ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;

      readAsArrayBuffer(): void {
        this.onerror?.();
      }
    }
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      value: FailingReader,
    });
    try {
      const unreadable = {
        arrayBuffer: async () => {
          throw new DOMException("The I/O read operation failed.", "NotReadableError");
        },
      } as unknown as Blob;
      await expect(readFileBytes(unreadable)).rejects.toMatchObject({
        name: "FileReadError",
        message: "We couldn’t read this file. Remove it and select it again.",
      });
    } finally {
      Object.defineProperty(globalThis, "FileReader", {
        configurable: true,
        value: originalReader,
      });
    }
  });

  it("falls back when WebKit leaves FileReader pending", async () => {
    const originalReader = globalThis.FileReader;
    class StalledReader {
      result: ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      readAsArrayBuffer(): void {
        // Simulate the WebKit picker-backed Blob regression: no event is
        // delivered, but the Blob's independent arrayBuffer path is healthy.
      }
    }
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      value: StalledReader,
    });
    try {
      const readable = {
        arrayBuffer: async () => new Uint8Array([7, 8, 9]).buffer,
      } as unknown as Blob;
      await expect(readFileBytes(readable)).resolves.toEqual(new Uint8Array([7, 8, 9]));
    } finally {
      Object.defineProperty(globalThis, "FileReader", {
        configurable: true,
        value: originalReader,
      });
    }
  });
});

describe("validateFiles", () => {
  const merge = TOOLS.find((t) => t.slug === "merge-pdf")!;

  it("accepts valid PDFs and rejects wrong types", () => {
    const good = fakeFile("a.pdf", 1000, "application/pdf");
    const bad = fakeFile("b.png", 1000, "image/png");
    const { accepted, complaints } = validateFiles(merge, [good, bad], 0);
    expect(accepted).toHaveLength(1);
    expect(complaints).toHaveLength(1);
    expect(complaints[0].reason).toMatch(/accepts/);
  });

  it("accepts by extension when the browser omits the MIME type", () => {
    const f = fakeFile("scan.pdf", 1000, "");
    const { accepted } = validateFiles(merge, [f], 0);
    expect(accepted).toHaveLength(1);
  });

  it("rejects empty and oversized files and enforces maxFiles", () => {
    const empty = fakeFile("e.pdf", 0, "application/pdf");
    const huge = fakeFile(
      "h.pdf",
      merge.maxFileBytes + 1,
      "application/pdf",
    );
    const r = validateFiles(merge, [empty, huge], 0);
    expect(r.accepted).toHaveLength(0);
    expect(r.complaints).toHaveLength(2);

    const many = Array.from({ length: 25 }, (_, i) =>
      fakeFile(`f${i}.pdf`, 100, "application/pdf"),
    );
    const capped = validateFiles(merge, many, 0);
    expect(capped.accepted).toHaveLength(merge.maxFiles);
    expect(capped.complaints.length).toBeGreaterThan(0);
  });

  it("enforces the aggregate byte limit across repeated additions", () => {
    const first = fakeFile("first.pdf", merge.maxTotalBytes - 100, "application/pdf");
    const second = fakeFile("second.pdf", 101, "application/pdf");
    const result = validateFiles(merge, [second], 1, first.size);

    expect(result.accepted).toHaveLength(0);
    expect(result.complaints[0].fileName).toBe("second.pdf");
    expect(result.complaints[0].reason).toMatch(/total limit/i);
  });
});
