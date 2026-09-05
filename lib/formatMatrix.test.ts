import { describe, expect, it } from "vitest";
import {
  FORMAT_MATRIX,
  HELPER_ALLOWLIST,
  conversionsByCategory,
  engineDisplayName,
  getConversion,
  getConversionBySlug,
  isHelperConversionAllowed,
} from "./formatMatrix";

describe("formatMatrix", () => {
  it("covers every required conversion pair", () => {
    for (const pair of [
      "pages>pdf",
      "pages>docx",
      "key>pdf",
      "key>pptx",
      "numbers>pdf",
      "numbers>xlsx",
      "docx>pdf",
      "doc>pdf",
      "pptx>pdf",
      "ppt>pdf",
      "xlsx>pdf",
      "xls>pdf",
    ]) {
      expect(
        HELPER_ALLOWLIST,
        `missing helper pair ${pair}`,
      ).toContain(pair);
    }
  });

  it("has no duplicate tool slugs and every entry resolves", () => {
    const slugs = FORMAT_MATRIX.map((c) => c.toolSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of FORMAT_MATRIX) {
      expect(getConversion(c.id)).toBeDefined();
      expect(getConversionBySlug(c.toolSlug)).toBeDefined();
    }
  });

  it("keeps v0.1 browser tools fully browser-local", () => {
    for (const id of [
      "merge-pdf",
      "split-pdf",
      "compress-pdf",
      "rotate-pdf",
      "pdf-to-jpg",
      "images-to-pdf",
    ]) {
      const c = getConversion(id)!;
      expect(c.browser).toBe("full");
      expect(c.helperPair).toBeNull();
      expect(c.requiresMac).toBe(false);
    }
  });

  it("marks iWork conversions as mac-only with native engines", () => {
    const pages = getConversion("pages-to-pdf")!;
    expect(pages.requiresMac).toBe(true);
    expect(pages.nativeEngine).toBe("pages");
    expect(pages.fallbackEngine).toBeNull(); // never fake iWork via LibreOffice
    const key = getConversion("key-to-pptx")!;
    expect(key.nativeEngine).toBe("keynote");
    const numbers = getConversion("numbers-to-xlsx")!;
    expect(numbers.nativeEngine).toBe("numbers");
  });

  it("gives Office conversions an honest LibreOffice fallback", () => {
    expect(getConversion("docx-to-pdf")!.fallbackEngine).toBe("libreoffice");
    expect(getConversion("pptx-to-pdf")!.fallbackEngine).toBe("libreoffice");
    expect(getConversion("xlsx-to-pdf")!.fallbackEngine).toBe("libreoffice");
  });

  it("exposes an honest allowlist check", () => {
    expect(isHelperConversionAllowed("pages", "pdf")).toBe(true);
    expect(isHelperConversionAllowed("PAGES", "PDF")).toBe(true);
    expect(isHelperConversionAllowed("pdf", "exe")).toBe(false);
  });

  it("never mislabels engines", () => {
    expect(engineDisplayName("libreoffice")).toBe("LibreOffice");
    expect(engineDisplayName("word")).toBe("Microsoft Word");
    expect(engineDisplayName("pages")).toBe("Pages");
  });

  it("groups homepage categories without duplication", () => {
    const cats = [
      "PDF",
      "Documents",
      "Presentations",
      "Spreadsheets",
      "Images",
    ] as const;
    const seen = new Set<string>();
    for (const cat of cats) {
      for (const c of conversionsByCategory(cat)) {
        expect(c.category).toBe(cat);
        expect(seen.has(c.id)).toBe(false);
        seen.add(c.id);
      }
    }
    expect(seen.size).toBe(FORMAT_MATRIX.length);
  });

  it("documents a limitation for every conversion", () => {
    for (const c of FORMAT_MATRIX) {
      expect(c.limitation.length).toBeGreaterThan(10);
    }
  });
});
