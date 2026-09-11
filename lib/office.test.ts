import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { inspectFile } from "./fileIntelligence";
import {
  assertSafeDocx,
  excelToPdf,
  keynoteToPptx,
  pagesToDocx,
  parsePptx,
  parseXlsx,
  powerpointToPdf,
  renderPagesDocumentToDocx,
} from "./office";
import type { IworkDocument } from "@file-viewer/renderer-iwork";
import { inspectZip, readZipEntry } from "./safeArchive";
import { parseSafeXml } from "./safeXml";

function buffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

async function appleFile(name: string, xml: string): Promise<File> {
  const zip = new JSZip();
  zip.file(name.endsWith(".key") ? "index.apxl" : "index.xml", xml);
  zip.file("Metadata/Properties.plist", name.endsWith(".pages") ? "synthetic Pages" : "synthetic Keynote");
  return new File([buffer(await zip.generateAsync({ type: "uint8array" }))], name, { type: "application/zip" });
}

async function pptxFile(): Promise<File> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
  zip.file("ppt/presentation.xml", `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`);
  zip.file("ppt/slides/slide1.xml", `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr/><p:grpSpPr/><p:sp><p:nvSpPr/><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1800"/><a:t>Office fixture</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  return new File([buffer(await zip.generateAsync({ type: "uint8array" }))], "fixture.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

async function xlsxFile(): Promise<File> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file("xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Summary" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Revenue</t></is></c><c r="B1"><v>42</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Total</t></is></c><c r="B2"><f>SUM(B1)</f><v>42</v></c></row></sheetData><mergeCells count="1"><mergeCell ref="A1:A2"/></mergeCells></worksheet>`);
  return new File([buffer(await zip.generateAsync({ type: "uint8array" }))], "fixture.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

describe("bounded Office conversion", () => {
  it("rejects DTD/entity expansion before interpreting XML", () => {
    expect(() => parseSafeXml(`<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><root>&x;</root>`)).toThrow(/external entities|DTD/i);
  });

  it("parses PowerPoint and validates a loadable PDF with the expected page count", async () => {
    const file = await pptxFile();
    const parsed = await parsePptx(file);
    expect(parsed.slides).toHaveLength(1);
    expect(parsed.slides[0].items.some((item) => item.kind === "text")).toBe(true);
    const bytes = await powerpointToPdf(file);
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("parses Excel saved values and exports a loadable PDF", async () => {
    const file = await xlsxFile();
    const parsed = await parseXlsx(file);
    expect(parsed.sheets[0].rows[0][0].value).toBe("Revenue");
    expect(parsed.sheets[0].rows[0][1].value).toBe(42);
    expect(parsed.sheets[0].merges).toEqual([{ row: 0, col: 0, rowspan: 2, colspan: 1 }]);
    const bytes = await excelToPdf(file);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("rejects external workbook relationships before reading worksheet content", async () => {
    const file = await xlsxFile();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rIdExternal" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" Target="https://example.test/workbook.xlsx" TargetMode="External"/></Relationships>`);
    const unsafe = new File([buffer(await zip.generateAsync({ type: "uint8array" }))], "external.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    await expect(parseXlsx(unsafe)).rejects.toThrow(/external content/i);
  });

  it("rejects external non-hyperlink relationships in DOCX without fetching them", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types/>");
    zip.file("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>Safe text</w:t></w:r></w:p></w:body></w:document>");
    zip.file("word/_rels/document.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdExternal" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.test/image.png" TargetMode="External"/></Relationships>`);
    const file = new File([buffer(await zip.generateAsync({ type: "uint8array" }))], "external.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    await expect(assertSafeDocx(file)).rejects.toThrow(/external content/i);
  });

  it("writes a real DOCX from Pages and validates the package and text", async () => {
    const file = await appleFile("sample.pages", `<document><page name="Page 1"><p>Pages to Word marker</p><p>Unicode acción</p></page></document>`);
    const bytes = await pagesToDocx(file);
    const archive = inspectZip(bytes);
    expect(archive.entries.map((entry) => entry.path)).toEqual(expect.arrayContaining(["[Content_Types].xml", "word/document.xml", "word/_rels/document.xml.rels"]));
    const document = new TextDecoder().decode(await readZipEntry(bytes, archive, "word/document.xml"));
    expect(document).toContain("Pages to Word marker");
    expect(document).toContain("acción");
    expect(() => parseSafeXml(document)).not.toThrow();
  });

  it("embeds Pages image media in the DOCX package", async () => {
    const png = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
      0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 207, 192, 240,
      31, 0, 3, 3, 1, 0, 24, 221, 141, 181, 0, 0, 0, 0, 73, 69,
      78, 68, 174, 66, 96, 130,
    ]);
    const document: IworkDocument = {
      kind: "pages",
      generation: "iwork-09",
      title: "Pages image",
      scenes: [{
        id: "page-1",
        name: "Page 1",
        width: 612,
        height: 792,
        blocks: [],
        tables: [],
        objects: [{ id: "image-1", kind: "image", x: 24, y: 24, width: 96, height: 96, bytes: png, mimeType: "image/png" }],
        notes: [],
      }],
      diagnostics: [],
      limits: [],
      objectCount: 1,
      limitedPreview: false,
    };
    const bytes = await renderPagesDocumentToDocx(document);
    const archive = inspectZip(bytes);
    expect(archive.entries.map((entry) => entry.path)).toContain("word/media/image1.png");
    const rels = new TextDecoder().decode(await readZipEntry(bytes, archive, "word/_rels/document.xml.rels"));
    expect(rels).toContain('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"');
    expect(await readZipEntry(bytes, archive, "word/media/image1.png")).toEqual(png);
  });

  it("writes a real PPTX from Keynote and reopens it through the safe parser", async () => {
    const file = await appleFile("sample.key", `<document><slide-list><slide name="One"><title><text-storage><p>Keynote to PowerPoint marker</p></text-storage></title></slide><slide name="Two"><body><text-storage><p>Second slide</p></text-storage></body></slide></slide-list></document>`);
    const bytes = await keynoteToPptx(file);
    const output = await parsePptx(new File([buffer(bytes)], "converted.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }));
    expect(output.slides).toHaveLength(2);
    expect(output.slides.flatMap((slide) => slide.items).some((item) => item.kind === "text" && item.paragraphs.some((paragraph) => paragraph.runs.some((run) => run.text.includes("Keynote to PowerPoint marker"))))).toBe(true);
  });

  it("detects Office formats and advertises only validated public actions", async () => {
    const pptx = await inspectFile(await pptxFile());
    const xlsx = await inspectFile(await xlsxFile());
    expect(pptx.supportedActions).toEqual(["powerpoint-to-pdf"]);
    expect(xlsx.supportedActions).toEqual(["excel-to-pdf"]);
  });
});
