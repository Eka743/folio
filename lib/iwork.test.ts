import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { inspectZip, readZipEntry } from "./safeArchive";
import { appleToPdf, numbersToXlsx, parseAppleDocument, renderAppleDocumentToPdf } from "./iwork";
import type { IworkDocument } from "@file-viewer/renderer-iwork";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

async function appleFile(name: string, xml: string): Promise<File> {
  const zip = new JSZip();
  const metadata = name.endsWith(".pages")
    ? "synthetic Pages"
    : name.endsWith(".numbers")
      ? "synthetic Numbers"
      : "synthetic Keynote";
  zip.file(name.endsWith(".key") ? "index.apxl" : "index.xml", xml);
  zip.file("Metadata/Properties.plist", metadata);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new File([toArrayBuffer(bytes)], name, { type: "application/zip" });
}

describe("local Apple document exports", () => {
  it("exports a supported Pages document as a loadable PDF", async () => {
    const file = await appleFile(
      "sample.pages",
      `<document><page name="Page 1"><p>Pages regression marker</p><p>Second paragraph</p></page><page name="Page 2"><p>Second page</p></page></document>`,
    );
    const document = await parseAppleDocument(file, "pages");
    expect(document.limitedPreview).toBe(false);
    expect(document.scenes).toHaveLength(2);
    const bytes = await appleToPdf(file, "pages");
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    expect(await (await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });

  it("exports Keynote slides with one PDF page per supported slide", async () => {
    const file = await appleFile(
      "sample.key",
      `<document><slide-list><slide name="One"><title><text-storage><p>Slide one</p></text-storage></title><body><text-storage><p>Body one</p></text-storage></body></slide><slide name="Two"><body><text-storage><p>Slide two</p></text-storage></body></slide></slide-list></document>`,
    );
    const bytes = await appleToPdf(file, "keynote");
    expect(await (await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });

  it("keeps non-WinAnsi Apple text from aborting PDF export", async () => {
    const file = await appleFile(
      "unicode.pages",
      `<document><page name="Unicode"><p>acción, niño, café, 日本語 👋</p></page></document>`,
    );
    const bytes = await appleToPdf(file, "pages");
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    expect(await (await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("exports saved Numbers tables to a valid XLSX archive", async () => {
    const file = await appleFile(
      "sample.numbers",
      `<document xmlns:sfa="http://developer.apple.com/namespaces/sfa"><workspace name="Budget"><table><row><cell><string sfa:string="Item"/></cell><cell><string sfa:string="Total"/></cell></row><row><cell><string sfa:string="Alpha"/></cell><cell><string sfa:string="30"/></cell></row></table></workspace></document>`,
    );
    const bytes = await numbersToXlsx(file);
    const archive = inspectZip(bytes);
    expect(archive.entries.map((entry) => entry.path)).toContain("xl/workbook.xml");
    expect(archive.entries.map((entry) => entry.path)).toContain("xl/sharedStrings.xml");
    const workbook = await readZipEntry(bytes, archive, "xl/workbook.xml");
    expect(new TextDecoder().decode(workbook)).toMatch(/Budget/);
    const worksheet = new TextDecoder().decode(await readZipEntry(bytes, archive, "xl/worksheets/sheet1.xml"));
    const sharedStrings = new TextDecoder().decode(await readZipEntry(bytes, archive, "xl/sharedStrings.xml"));
    expect(worksheet).toContain('t="s"');
    expect(worksheet).not.toContain('t="str"');
    expect(sharedStrings).toContain("Alpha");
  });

  it("paginates a long Numbers table through the public parser path", async () => {
    const rows = Array.from({ length: 80 }, (_, index) => `<row><cell><string sfa:string="Row ${index + 1}"/></cell><cell><string sfa:string="${index * 10}"/></cell></row>`).join("");
    const file = await appleFile(
      "long.numbers",
      `<document xmlns:sfa="http://developer.apple.com/namespaces/sfa"><workspace name="Long sheet"><table><row><cell><string sfa:string="Item"/></cell><cell><string sfa:string="Total"/></cell></row>${rows}</table></workspace></document>`,
    );
    const bytes = await appleToPdf(file, "numbers");
    expect(await (await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it("renders merged Numbers cells across paginated output", async () => {
    const document: IworkDocument = {
      kind: "numbers",
      generation: "iwork-09",
      title: "Merged table",
      scenes: [{
        id: "sheet-1",
        name: "Merged sheet",
        width: 595.28,
        height: 841.89,
        blocks: [],
        tables: [{
          id: "table-1",
          x: 24,
          y: 120,
          width: 480,
          height: 2_000,
          rows: Array.from({ length: 80 }, (_, index) => [index === 0 ? "Merged heading" : `A${index}`, index === 0 ? "" : `B${index}`]),
          columnWidths: [240, 240],
          rowHeights: Array.from({ length: 80 }, () => 24),
          merges: [{ row: 0, col: 0, rowspan: 1, colspan: 2 }],
          headerRows: 1,
        }],
        objects: [],
        notes: [],
      }],
      diagnostics: [],
      limits: [],
      objectCount: 80,
      limitedPreview: false,
    };
    const bytes = await renderAppleDocumentToPdf(document);
    expect(await (await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it("fails closed for the renderer's limited generic preview", async () => {
    const zip = new JSZip();
    zip.file("Index/Document.iwa", "not a typed archive");
    zip.file("Metadata/Properties.plist", "synthetic Pages");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const file = new File([toArrayBuffer(bytes)], "limited.pages");
    await expect(parseAppleDocument(file, "pages")).rejects.toThrow(/limited preview|couldn’t read/i);
  });

  it("falls back after an iWork worker timeout and terminates the worker", async () => {
    const originalWorker = globalThis.Worker;
    let terminated = 0;
    class StalledWorker {
      addEventListener(): void {}
      removeEventListener(): void {}
      postMessage(): void {
        posted = true;
      }
      terminate(): void {
        terminated++;
      }
    }
    let posted = false;
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: StalledWorker });
    const file = await appleFile("timeout.pages", "<document><page name=\"One\"><p>Timeout fallback</p></page></document>");
    vi.useFakeTimers();
    try {
      const pending = parseAppleDocument(file, "pages");
      for (let attempt = 0; attempt < 20 && !posted; attempt++) await Promise.resolve();
      expect(posted).toBe(true);
      vi.advanceTimersByTime(60_000);
      vi.useRealTimers();
      const parsed = await pending;
      expect(parsed.scenes).toHaveLength(1);
      expect(terminated).toBe(1);
    } finally {
      vi.useRealTimers();
      Object.defineProperty(globalThis, "Worker", { configurable: true, value: originalWorker });
    }
  });
});
