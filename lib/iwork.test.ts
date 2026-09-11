import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { inspectZip, readZipEntry } from "./safeArchive";
import { appleToPdf, numbersToXlsx, parseAppleDocument } from "./iwork";

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

  it("exports saved Numbers tables to a valid XLSX archive", async () => {
    const file = await appleFile(
      "sample.numbers",
      `<document xmlns:sfa="http://developer.apple.com/namespaces/sfa"><workspace name="Budget"><table><row><cell><string sfa:string="Item"/></cell><cell><string sfa:string="Total"/></cell></row><row><cell><string sfa:string="Alpha"/></cell><cell><string sfa:string="30"/></cell></row></table></workspace></document>`,
    );
    const bytes = await numbersToXlsx(file);
    const archive = inspectZip(bytes);
    expect(archive.entries.map((entry) => entry.path)).toContain("xl/workbook.xml");
    const workbook = await readZipEntry(bytes, archive, "xl/workbook.xml");
    expect(new TextDecoder().decode(workbook)).toMatch(/Budget/);
  });

  it("fails closed for the renderer's limited generic preview", async () => {
    const zip = new JSZip();
    zip.file("Index/Document.iwa", "not a typed archive");
    zip.file("Metadata/Properties.plist", "synthetic Pages");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const file = new File([toArrayBuffer(bytes)], "limited.pages");
    await expect(parseAppleDocument(file, "pages")).rejects.toThrow(/limited preview|couldn’t read/i);
  });
});
