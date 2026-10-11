import { describe, expect, it } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import {
  moveVisualSignature,
  resizeVisualSignature,
  signPdf,
  visualRectToPdfImagePlacement,
} from "./signature";

const ONE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("signature coordinate mapping", () => {
  const page = { x: 20, y: 30, width: 600, height: 800 };
  const visual = { x: 10, y: 20, width: 100, height: 50 };

  it.each([
    [0, { x: 30, y: 760, rotation: 0 }],
    [90, { x: 90, y: 40, rotation: 90 }],
    [180, { x: 610, y: 100, rotation: 180 }],
    [270, { x: 550, y: 820, rotation: 270 }],
  ])("maps a visual rectangle at %i degrees", (rotation, expected) => {
    expect(visualRectToPdfImagePlacement(page, visual, rotation)).toEqual({
      ...expected,
      width: 100,
      height: 50,
    });
  });

  it("clamps movement to page bounds", () => {
    expect(moveVisualSignature(
      { x: 20, y: 30, width: 100, height: 50 },
      700,
      -100,
      { width: 600, height: 800 },
    )).toEqual({ x: 500, y: 0, width: 100, height: 50 });
  });

  it("keeps aspect ratio while resizing", () => {
    const resized = resizeVisualSignature(
      { x: 20, y: 30, width: 100, height: 50 },
      100,
      { width: 600, height: 800 },
      2,
    );
    expect(resized.width).toBe(200);
    expect(resized.height).toBe(100);
  });

  it("limits a resize when the page bottom would be crossed", () => {
    const resized = resizeVisualSignature(
      { x: 20, y: 740, width: 100, height: 50 },
      200,
      { width: 600, height: 800 },
      2,
    );
    expect(resized.height).toBe(60);
    expect(resized.width).toBe(120);
  });
});

describe("signed PDF export", () => {
  it("preserves pages and embeds the same signature on rotated and different-sized pages", async () => {
    const source = await PDFDocument.create();
    const first = source.addPage([600, 800]);
    first.setCropBox(20, 30, 600, 800);
    first.setRotation(degrees(90));
    const second = source.addPage([842, 595]);
    second.setRotation(degrees(0));
    const sourceBytes = await source.save();

    const output = await signPdf(
      sourceBytes,
      [{ id: "signature-1", label: "Test signature", dataUrl: ONE_PIXEL_PNG, width: 1, height: 1 }],
      [
        { id: "placement-1", assetId: "signature-1", pageIndex: 0, x: 20, y: 30, width: 120, height: 60 },
        { id: "placement-2", assetId: "signature-1", pageIndex: 1, x: 600, y: 400, width: 100, height: 100 },
      ],
    );

    expect(output.slice(0, 5)).toEqual(new TextEncoder().encode("%PDF-"));
    const parsed = await PDFDocument.load(output);
    expect(parsed.getPageCount()).toBe(2);
    expect(parsed.getPage(0).getRotation().angle).toBe(90);
    expect(parsed.getPage(1).getSize()).toEqual({ width: 842, height: 595 });
    expect(output.length).toBeGreaterThan(sourceBytes.length);
  });

  it("fails when no signature placement is supplied", async () => {
    const source = await PDFDocument.create();
    source.addPage([595, 842]);
    await expect(signPdf(
      await source.save(),
      [],
      [],
    )).rejects.toThrow(/Place at least one signature/);
  });

  it.each([1, 5, 20, 50])("preserves a %i-page document", async (pageCount) => {
    const source = await PDFDocument.create();
    for (let index = 0; index < pageCount; index++) source.addPage(index % 2 ? [612, 792] : [595, 842]);
    const output = await signPdf(
      await source.save(),
      [{ id: "signature-1", label: "Test signature", dataUrl: ONE_PIXEL_PNG, width: 1, height: 1 }],
      [{ id: "placement-1", assetId: "signature-1", pageIndex: pageCount - 1, x: 24, y: 24, width: 96, height: 48 }],
    );
    const parsed = await PDFDocument.load(output);
    expect(parsed.getPageCount()).toBe(pageCount);
  });
});
