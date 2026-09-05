/**
 * Runtime tests for the pdf-lib backed operations.
 * These run in Node (pdf-lib is platform-independent); browser-only paths
 * (pdf.js rendering, DOCX rasterization) are exercised via validation logic
 * and manual QA instead.
 */
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  getPdfPageCount,
  imagesToPdf,
  mergePdfs,
  optimizePdf,
  rotatePdf,
  splitPdf,
} from "./pdfOps";

async function makePdf(pages: number): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  const bytes = await doc.save();
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new File([copy], `test-${pages}p.pdf`, { type: "application/pdf" });
}

/** Minimal 1x1 PNG. */
function makePng(name: string): File {
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
    0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return new File([bytes], name, { type: "image/png" });
}

describe("pdf engine", () => {
  it("merges PDFs in order", async () => {
    const a = await makePdf(2);
    const b = await makePdf(3);
    const out = await mergePdfs([a, b]);
    expect(await getPdfPageCount(out)).toBe(5);
    expect([...out.slice(0, 5)]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });

  it("splits out exactly the requested pages", async () => {
    const src = await makePdf(6);
    const out = await splitPdf(src, [1, 3, 5]);
    expect(await getPdfPageCount(out)).toBe(3);
  });

  it("rejects empty page selections", async () => {
    const src = await makePdf(2);
    await expect(splitPdf(src, [])).rejects.toThrow(/No valid pages/);
  });

  it("rotates all pages and selected pages", async () => {
    const src = await makePdf(3);
    const all = await rotatePdf(src, null, 90);
    const doc = await PDFDocument.load(all);
    expect(doc.getPage(0).getRotation().angle).toBe(90);

    const partial = await rotatePdf(src, [2], 180);
    const doc2 = await PDFDocument.load(partial);
    expect(doc2.getPage(0).getRotation().angle).toBe(0);
    expect(doc2.getPage(1).getRotation().angle).toBe(180);
  });

  it("optimizes and reports honest sizes", async () => {
    const src = await makePdf(2);
    const { bytes, beforeBytes, afterBytes } = await optimizePdf(src);
    expect(beforeBytes).toBe(src.size);
    expect(afterBytes).toBe(bytes.length);
    expect(await getPdfPageCount(bytes)).toBe(2);
  });

  it("builds a PDF with one page per image", async () => {
    const out = await imagesToPdf([makePng("a.png"), makePng("b.png")]);
    expect(await getPdfPageCount(out)).toBe(2);
  });
});
