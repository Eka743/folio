import { describe, expect, it } from "vitest";
import {
  FORMAT_MATRIX,
  HOMEPAGE_CATEGORIES,
  PUBLIC_WEB_FORMAT_MATRIX,
  conversionsByCategory,
  getConversion,
  getConversionBySlug,
} from "./formatMatrix";
import {
  DORMANT_NATIVE_CONVERSIONS,
  HELPER_ALLOWLIST,
  isHelperConversionAllowed,
} from "./dormantFormatMatrix";

describe("public format matrix", () => {
  it("contains only browser-local conversions", () => {
    expect(FORMAT_MATRIX).toBe(PUBLIC_WEB_FORMAT_MATRIX);
    expect(FORMAT_MATRIX.every((conversion) => conversion.status.startsWith("browser"))).toBe(true);
    expect(FORMAT_MATRIX.map((conversion) => conversion.toolSlug)).toEqual([
      "merge-pdf",
      "split-pdf",
      "compress-pdf",
      "rotate-pdf",
      "pdf-to-jpg",
      "images-to-pdf",
      "docx-to-pdf",
      "markdown-to-pdf",
      "pdf-to-markdown",
      "combine-to-pdf",
    ]);
  });

  it("keeps the browser DOCX route honest about fidelity", () => {
    const docx = getConversion("docx-to-pdf")!;
    expect(docx.browser).toBe("beta");
    expect(docx.status).toBe("browser-beta");
    expect(docx.limitation).toMatch(/pagination/i);
    expect(docx.limitation).toMatch(/complex/i);
  });

  it("keeps Markdown conversions browser-local and honest about reconstruction", () => {
    const toPdf = getConversion("markdown-to-pdf")!;
    expect(toPdf.browser).toBe("full");
    expect(toPdf.status).toBe("browser");
    expect(toPdf.limitation).toMatch(/HTML|remote images/i);

    const toMarkdown = getConversion("pdf-to-markdown")!;
    expect(toMarkdown.browser).toBe("beta");
    expect(toMarkdown.status).toBe("browser-beta");
    expect(toMarkdown.limitation).toMatch(/scanned|complex columns|original Markdown/i);
  });

  it("keeps browser PDF and image tools fully local", () => {
    for (const id of [
      "merge-pdf",
      "split-pdf",
      "compress-pdf",
      "rotate-pdf",
      "pdf-to-jpg",
      "images-to-pdf",
    ]) {
      const conversion = getConversion(id)!;
      expect(conversion.browser).toBe("full");
      expect(conversion.status).toBe("browser");
    }
  });

  it("groups every public conversion exactly once", () => {
    const seen = new Set<string>();
    for (const category of HOMEPAGE_CATEGORIES) {
      for (const conversion of conversionsByCategory(category)) {
        expect(conversion.category).toBe(category);
        expect(seen.has(conversion.id)).toBe(false);
        seen.add(conversion.id);
      }
    }
    expect(seen.size).toBe(PUBLIC_WEB_FORMAT_MATRIX.length);
    for (const conversion of PUBLIC_WEB_FORMAT_MATRIX) {
      expect(getConversion(conversion.id)).toBeDefined();
      expect(getConversionBySlug(conversion.toolSlug)).toBeDefined();
      expect(conversion.limitation.length).toBeGreaterThan(10);
    }
  });
});

describe("dormant native format matrix", () => {
  it("keeps native pairs out of the public matrix", () => {
    const publicIds = new Set(FORMAT_MATRIX.map((conversion) => conversion.id));
    for (const conversion of DORMANT_NATIVE_CONVERSIONS) {
      expect(publicIds.has(conversion.id)).toBe(false);
    }
  });

  it("keeps the helper allowlist available only to dormant native code", () => {
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
      expect(HELPER_ALLOWLIST).toContain(pair);
    }
    expect(isHelperConversionAllowed("PAGES", "PDF")).toBe(true);
    expect(isHelperConversionAllowed("pdf", "exe")).toBe(false);
  });

  it("keeps Keynote explicitly deferred", () => {
    for (const id of ["key-to-pdf", "key-to-pptx"]) {
      const conversion = DORMANT_NATIVE_CONVERSIONS.find((item) => item.id === id)!;
      expect(conversion.status).toBe("helper-beta");
      expect(conversion.limitation).toMatch(/deferred|unvalidated/i);
    }
  });
});
