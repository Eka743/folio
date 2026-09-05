import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatPercentChange,
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
});
