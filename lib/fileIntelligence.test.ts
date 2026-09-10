import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { inspectFile } from "./fileIntelligence";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

async function pdfFile(name = "sample.pdf"): Promise<File> {
  const document = await PDFDocument.create();
  document.addPage([300, 400]);
  return new File([toArrayBuffer(await document.save())], name, { type: "application/pdf" });
}

function pngFile(name = "image.png"): File {
  return new File(
    [
      toArrayBuffer(new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
        0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
        0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
        0x60, 0x82,
      ])),
    ],
    name,
    { type: "image/png" },
  );
}

async function zipFile(
  name: string,
  entries: Record<string, string | Uint8Array>,
): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
  return new File([toArrayBuffer(await zip.generateAsync({ type: "uint8array" }))], name, {
    type: "application/zip",
  });
}

describe("content-based file intelligence", () => {
  it("detects real signatures instead of trusting extensions or MIME", async () => {
    const pdf = await inspectFile(await pdfFile("renamed.jpg"));
    expect(pdf.kind).toBe("pdf");
    expect(pdf.valid).toBe(true);
    expect(pdf.extensionMatch).toBe(false);
    expect(pdf.supportedActions).toContain("merge-pdf");
    expect(pdf.warnings).toContain("extension-mismatch");

    const png = await inspectFile(pngFile("photo.bin"));
    expect(png.kind).toBe("png");
    expect(png.valid).toBe(true);
    expect(png.supportedActions).toEqual(["image-to-pdf"]);

    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0xff, 0xd9])], "scan.jpg", {
      type: "image/jpeg",
    });
    expect((await inspectFile(jpeg)).kind).toBe("jpeg");
  });

  it("detects DOCX containers by their required entries", async () => {
    const docx = await zipFile("report.docx", {
      "[Content_Types].xml": "<Types>wordprocessingml.document</Types>",
      "word/document.xml": "<w:document><w:body>Hello</w:body></w:document>",
    });
    const result = await inspectFile(docx);
    expect(result.kind).toBe("docx");
    expect(result.generation).toBe("modern");
    expect(result.supportedActions).toEqual(["docx-to-pdf"]);
  });

  it("identifies modern Pages and exposes only a bounded embedded preview", async () => {
    const preview = await pdfFile("preview.pdf");
    const pages = await zipFile("proposal.pages", {
      "Index/Document.iwa": "binary",
      "Metadata/Properties.plist": "com.apple.iWork.Pages",
      "QuickLook/Preview.pdf": new Uint8Array(await preview.arrayBuffer()),
    });
    const result = await inspectFile(pages);
    expect(result.kind).toBe("pages");
    expect(result.generation).toBe("modern");
    expect(result.valid).toBe(true);
    expect(result.supportedActions).toEqual(["embedded-pdf"]);
    expect(result.warnings).toContain("renderer-evaluation-pending");
  });

  it("does not treat an arbitrary ZIP renamed to an Apple format as valid", async () => {
    const fake = await zipFile("not-really.pages", { "notes.txt": "hello" });
    const result = await inspectFile(fake);
    expect(result.kind).toBe("unknown");
    expect(result.valid).toBe(false);
    expect(result.safety).toBe("safe");
    expect(result.supportedActions).toEqual([]);
    expect(result.warnings).toContain("unsupported-container");
  });

  it("surfaces malformed content and unsafe containers without leaking parser errors", async () => {
    const malformedPdf = new File(["%PDF-1.7\nnot finished"], "bad.pdf", {
      type: "application/pdf",
    });
    const pdfResult = await inspectFile(malformedPdf);
    expect(pdfResult.kind).toBe("pdf");
    expect(pdfResult.valid).toBe(false);
    expect(pdfResult.warnings).toContain("malformed-content");

    const zip = await zipFile("unsafe.pages", { "safe.txt": "nope" });
    const bytes = new Uint8Array(await zip.arrayBuffer());
    const from = new TextEncoder().encode("safe.txt");
    const to = new TextEncoder().encode("../x.txt");
    for (let offset = 0; offset <= bytes.length - from.length; offset++) {
      if (from.every((value, index) => bytes[offset + index] === value)) bytes.set(to, offset);
    }
    const unsafe = await inspectFile(new File([bytes], "unsafe.pages"));
    expect(unsafe.safety).toBe("rejected");
    expect(unsafe.archiveErrorCode).toBe("ARCHIVE_UNSAFE_PATH");
    expect(unsafe.warningMessages[0]).toMatch(/malformed|safety/i);
  });
});
