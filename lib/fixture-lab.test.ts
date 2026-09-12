import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateFixtureLab } from "../scripts/fixture-lab.mjs";
import { parsePptxDirect, parseXlsxDirect } from "./office.parser";
import { excelToPdf, powerpointToPdf } from "./office";

function fileFromPath(path: string, name: string, type: string): File {
  const bytes = readFileSync(path);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new File([copy.buffer], name, { type });
}

describe("generated fixture lab", () => {
  it("keeps every Office fixture parseable through the independent safe readers", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "folio-fixture-lab-unit-"));
    try {
      await generateFixtureLab(outputDir);
      for (const name of ["simple.pptx", "text.pptx", "images.pptx", "shapes.pptx", "tables.pptx", "widescreen.pptx", "multipage.pptx", "unicode.pptx", "mixed.pptx"]) {
        const file = fileFromPath(join(outputDir, "pptx", name), name, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
        const parsed = await parsePptxDirect(file);
        expect(parsed.slides.length, name).toBeGreaterThan(0);
        const output = await powerpointToPdf(file);
        expect(output.length, name).toBeGreaterThan(200);
      }
      for (const name of ["simple.xlsx", "multi-sheet.xlsx", "formulas.xlsx", "merged.xlsx", "formatting.xlsx", "dates.xlsx", "wide-table.xlsx", "long-table.xlsx", "unicode.xlsx", "mixed.xlsx"]) {
        const file = fileFromPath(join(outputDir, "xlsx", name), name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        const parsed = await parseXlsxDirect(file);
        expect(parsed.sheets.length, name).toBeGreaterThan(0);
        if (name === "mixed.xlsx") {
          expect(parsed.sheets[0].rows[1][2].value).toBe("2026-09-11");
        }
        const output = await excelToPdf(file);
        expect(output.length, name).toBeGreaterThan(200);
      }
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
