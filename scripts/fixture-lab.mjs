#!/usr/bin/env node

/**
 * Generate deterministic, legally safe document fixtures for conversion QA.
 * All text, vector shapes and the embedded pixel image are generated here.
 * Binary fixtures are written to a caller-selected temporary directory and
 * are never bundled with the public application.
 */

import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const xml = (body) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`;
const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

async function zipBuffer(entries) {
  const zip = new JSZip();
  for (const [path, value] of Object.entries(entries)) zip.file(path, value);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

function wordParagraph(text, { style, bold, italic, pageBreak, listId } = {}) {
  const paragraphProperties = style || listId
    ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${listId ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${listId}"/></w:numPr>` : ""}</w:pPr>`
    : "";
  const runProperties = bold || italic ? `<w:rPr>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}</w:rPr>` : "";
  return `<w:p>${paragraphProperties}<w:r>${runProperties}${pageBreak ? '<w:br w:type="page"/>' : ""}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function wordImage() {
  return `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Generated pixel"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="pixel.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function wordTable() {
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tr><w:tc>${wordParagraph("Item", { bold: true })}</w:tc><w:tc>${wordParagraph("Estado", { bold: true })}</w:tc></w:tr><w:tr><w:tc>${wordParagraph("Folio")}</w:tc><w:tc>${wordParagraph("Listo")}</w:tc></w:tr></w:tbl>`;
}

async function makeDocxFixture(name) {
  const key = name.replace(".docx", "");
  const all = key === "mixed-complex";
  const body = [
    wordParagraph(all ? "Folio mixed document" : `Folio ${key} fixture`, { style: all ? "Title" : undefined }),
    ...(key === "headings" || all ? [wordParagraph("Generated heading one", { style: "Heading1" }), wordParagraph("Generated heading two", { style: "Heading2" })] : []),
    ...(key === "formatting" || all ? [wordParagraph("Bold generated text", { bold: true }), wordParagraph("Italic generated text", { italic: true })] : []),
    ...(key === "lists" || all ? [wordParagraph("Bullet one", { listId: 1 }), wordParagraph("Bullet two", { listId: 1 }), wordParagraph("Number one", { listId: 2 }), wordParagraph("Number two", { listId: 2 })] : []),
    ...(key === "table" || all ? [wordTable()] : []),
    ...(key === "image" || all ? [wordParagraph("Embedded image follows"), wordImage()] : []),
    ...(key === "hyperlinks" || all ? [`<w:p><w:r><w:t>Generated link: </w:t></w:r><w:hyperlink r:id="rIdLink"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t>Folio local fixture</w:t></w:r></w:hyperlink></w:p>`] : []),
    ...(key === "unicode-spanish" || all ? [wordParagraph("Español: acción, corazón, pingüino, niño, café. 日本語 👋")] : []),
    ...(key === "multipage" || all ? [
      ...Array.from({ length: 22 }, (_, index) => wordParagraph(`Generated first-page paragraph ${index + 1}. This line gives the renderer realistic wrapping and spacing.`)),
      wordParagraph("", { pageBreak: true }),
      wordParagraph("Generated second page", { style: "Heading1" }),
      ...Array.from({ length: 12 }, (_, index) => wordParagraph(`Generated second-page paragraph ${index + 1}.`)),
    ] : []),
    ...(key === "simple" ? [wordParagraph("A normal paragraph created for browser-local conversion validation.")] : []),
    `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>`,
  ].join("");

  return zipBuffer({
    "[Content_Types].xml": xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`),
    "_rels/.rels": xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDocument" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/pixel.png"/><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/generated-fixture" TargetMode="External"/></Relationships>`),
    "word/styles.xml": xml(`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>`),
    "word/numbering.xml": xml(`<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num></w:numbering>`),
    "word/document.xml": xml(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>`),
    "word/media/pixel.png": ONE_PIXEL_PNG,
  });
}

function presentationTheme() {
  const fills = Array.from({ length: 3 }, () => '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>').join("");
  const lines = Array.from({ length: 3 }, () => '<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>').join("");
  const effects = Array.from({ length: 3 }, () => "<a:effectStyle><a:effectLst/></a:effectStyle>").join("");
  return xml(`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Generated"><a:themeElements><a:clrScheme name="Generated"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="0F766E"/></a:accent2><a:accent3><a:srgbClr val="D97706"/></a:accent3><a:accent4><a:srgbClr val="7C3AED"/></a:accent4><a:accent5><a:srgbClr val="DB2777"/></a:accent5><a:accent6><a:srgbClr val="0891B2"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Generated"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Generated"><a:fillStyleLst>${fills}</a:fillStyleLst><a:lnStyleLst>${lines}</a:lnStyleLst><a:effectStyleLst>${effects}</a:effectStyleLst><a:bgFillStyleLst>${fills}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
}

function slideText(id, text, x = 457200, y = 457200, width = 8229600, height = 914400) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Generated text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="es-ES" sz="2400"/><a:t>${escapeXml(text)}</a:t></a:r><a:endParaRPr lang="es-ES"/></a:p></p:txBody></p:sp>`;
}

function slideShape(id, preset, color, x, y) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Generated ${preset}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="1828800" cy="1371600"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="1F2937"/></a:solidFill></a:ln></p:spPr></p:sp>`;
}

function slideImage(id, relId) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Generated image"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="914400" y="2286000"/><a:ext cx="1828800" cy="1828800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function slideTable(id) {
  const cell = (value) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="es-ES"/><a:t>${escapeXml(value)}</a:t></a:r><a:endParaRPr/></a:p></a:txBody><a:tcPr/></a:tc>`;
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Generated table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="3657600" y="2286000"/><a:ext cx="4572000" cy="1828800"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid><a:gridCol w="2286000"/><a:gridCol w="2286000"/></a:tblGrid><a:tr h="914400">${cell("Métrica")}${cell("Valor")}</a:tr><a:tr h="914400">${cell("Local")}${cell("100")}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

async function makePptxFixture(name) {
  const key = name.replace(".pptx", "");
  const all = key === "mixed";
  const slideCount = key === "multipage" || all ? 4 : 1;
  const widescreen = key === "widescreen" || all;
  const cx = widescreen ? 12192000 : 9144000;
  const cy = widescreen ? 6858000 : 6858000;
  const entries = {};
  const slideIds = [];
  const presentationRels = [];
  const overrides = [];

  for (let index = 0; index < slideCount; index++) {
    const number = index + 1;
    const featureText = key === "unicode" || all
      ? `Diapositiva ${number}: acción, niño, café, 日本語 👋`
      : `Generated ${key} slide ${number}`;
    const elements = [slideText(2, featureText)];
    if ((key === "text" || all) && index === 0) elements.push(slideText(3, "Second generated text box", 457200, 1371600, 7315200, 685800));
    if ((key === "shapes" || all) && index === 0) {
      elements.push(slideShape(4, "rect", "2563EB", 914400, 2743200));
      elements.push(slideShape(5, "ellipse", "D97706", 3200400, 2743200));
    }
    if ((key === "tables" || all) && index === 0) elements.push(slideTable(6));
    if ((key === "images" || all) && index === 0) elements.push(slideImage(7, "rIdImage"));
    const tree = `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="0" y="0"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm></p:grpSpPr>${elements.join("")}</p:spTree>`;
    entries[`ppt/slides/slide${number}.xml`] = xml(`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Generated slide ${number}">${tree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    entries[`ppt/slides/_rels/slide${number}.xml.rels`] = xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${(key === "images" || all) && index === 0 ? '<Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/pixel.png"/>' : ""}</Relationships>`);
    slideIds.push(`<p:sldId id="${255 + number}" r:id="rIdSlide${number}"/>`);
    presentationRels.push(`<Relationship Id="rIdSlide${number}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${number}.xml"/>`);
    overrides.push(`<Override PartName="/ppt/slides/slide${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
  }

  const emptyTree = `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>`;
  Object.assign(entries, {
    "[Content_Types].xml": xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${overrides.join("")}</Types>`),
    "_rels/.rels": xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPresentation" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`),
    "ppt/presentation.xml": xml(`<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst><p:sldIdLst>${slideIds.join("")}</p:sldIdLst><p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`),
    "ppt/_rels/presentation.xml.rels": xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${presentationRels.join("")}</Relationships>`),
    "ppt/slideMasters/slideMaster1.xml": xml(`<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${emptyTree}</p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" tx1="dk1" tx2="dk2" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rIdLayout"/></p:sldLayoutIdLst></p:sldMaster>`),
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`),
    "ppt/slideLayouts/slideLayout1.xml": xml(`<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld>${emptyTree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`),
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`),
    "ppt/theme/theme1.xml": presentationTheme(),
    "ppt/media/pixel.png": ONE_PIXEL_PNG,
  });
  return zipBuffer(entries);
}

async function makeXlsxFixture(name) {
  const key = name.replace(".xlsx", "");
  const { utils, write } = await import("styled-exceljs");
  const workbook = utils.book_new();
  const rows = key === "wide-table"
    ? [Array.from({ length: 25 }, (_, index) => `Column ${index + 1}`), Array.from({ length: 25 }, (_, index) => index + 1)]
    : key === "long-table"
      ? [["Row", "Value"], ...Array.from({ length: 120 }, (_, index) => [`Generated row ${index + 1}`, index + 1])]
      : [["Item", "Value", "Date"], ["Café", 42, "2026-09-11"], ["Niño", 84, "2026-09-12"]];
  const sheet = utils.aoa_to_sheet(rows);
  sheet["!cols"] = Array.from({ length: Math.max(3, rows[0].length) }, () => ({ wch: 18 }));
  sheet["!rows"] = [{ hpx: 28 }];
  if (key === "merged" || key === "mixed") sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  if (key === "formulas" || key === "mixed") {
    sheet.D1 = { t: "s", v: "Total" };
    sheet.D2 = { t: "n", v: 42, f: "B2" };
    sheet.D3 = { t: "n", v: 126, f: "SUM(B2:B3)" };
    sheet["!ref"] = "A1:D3";
  }
  if (key === "dates" || key === "mixed") {
    sheet.C2 = { t: "d", v: new Date("2026-09-11T00:00:00Z"), z: "yyyy-mm-dd" };
  }
  if (key === "formatting" || key === "mixed") {
    for (const reference of ["A1", "B1", "C1"]) {
      sheet[reference].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  }
  if (key === "unicode" || key === "mixed") sheet.A2 = { t: "s", v: "acción, niño, café, 日本語 👋" };
  utils.book_append_sheet(workbook, sheet, "Resumen");
  if (key === "multi-sheet" || key === "mixed") {
    const second = utils.aoa_to_sheet([["Generated detail", "Status"], ["Local", "Ready"]]);
    utils.book_append_sheet(workbook, second, "Detalles");
  }
  const output = write(workbook, { bookType: "xlsx", type: "array", compression: true, cellStyles: true, bookSST: true });
  return Buffer.from(output instanceof ArrayBuffer ? new Uint8Array(output) : output);
}

async function makePdfFixture() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 3; index++) {
    const page = pdf.addPage([612, 792]);
    page.drawText(`Folio generated PDF page ${index + 1}`, { x: 54, y: 720, size: 20, font, color: rgb(0.12, 0.16, 0.23) });
    page.drawText("Local, deterministic and legally safe fixture.", { x: 54, y: 684, size: 12, font });
  }
  return Buffer.from(await pdf.save());
}

const DOCX_NAMES = ["simple.docx", "headings.docx", "formatting.docx", "lists.docx", "table.docx", "image.docx", "hyperlinks.docx", "multipage.docx", "unicode-spanish.docx", "mixed-complex.docx"];
const PPTX_NAMES = ["simple.pptx", "text.pptx", "images.pptx", "shapes.pptx", "tables.pptx", "widescreen.pptx", "multipage.pptx", "unicode.pptx", "mixed.pptx"];
const XLSX_NAMES = ["simple.xlsx", "multi-sheet.xlsx", "formulas.xlsx", "merged.xlsx", "formatting.xlsx", "dates.xlsx", "wide-table.xlsx", "long-table.xlsx", "unicode.xlsx", "mixed.xlsx"];

export async function generateFixtureLab(outputDirectory) {
  const outputDir = outputDirectory ?? mkdtempSync(join(tmpdir(), "folio-fixture-lab-"));
  mkdirSync(outputDir, { recursive: true });
  const manifest = {
    generatedBy: "scripts/fixture-lab.mjs",
    source: "Deterministic original test content generated by Folio; no private or copyrighted user documents.",
    license: "CC0-1.0",
    fixtures: [],
  };
  const write = (kind, name, bytes, features) => {
    const path = join(outputDir, kind, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    manifest.fixtures.push({ kind, name, path, bytes: bytes.length, features });
  };
  for (const name of DOCX_NAMES) await write("docx", name, await makeDocxFixture(name), name.replace(".docx", "").split("-"));
  for (const name of PPTX_NAMES) await write("pptx", name, await makePptxFixture(name), name.replace(".pptx", "").split("-"));
  for (const name of XLSX_NAMES) await write("xlsx", name, await makeXlsxFixture(name), name.replace(".xlsx", "").split("-"));
  write("markdown", "mixed.md", Buffer.from("# Folio generated Markdown\n\nEspañol: acción, niño y café.\n\n- Local\n- Private\n\n| Estado | Valor |\n| --- | ---: |\n| Listo | 100 |\n", "utf8"), ["heading", "unicode", "list", "table"]);
  write("pdf", "multipage.pdf", await makePdfFixture(), ["text", "three-pages"]);
  writeFileSync(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { outputDir, manifest };
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const outputIndex = process.argv.indexOf("--output-dir");
  const outputDir = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  const result = await generateFixtureLab(outputDir);
  console.log(JSON.stringify({ outputDir: result.outputDir, fixtureCount: result.manifest.fixtures.length, manifest: join(result.outputDir, "manifest.json") }, null, 2));
}
