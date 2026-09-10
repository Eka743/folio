#!/usr/bin/env node

/**
 * Generate small, deterministic, synthetic iWork-like containers for the
 * isolated renderer evaluation. These are parser-contract fixtures only, not
 * Apple reference documents, and should stay outside the public app bundle.
 */

import JSZip from "jszip";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outputArgument = process.argv.indexOf("--output-dir");
const outputDir = outputArgument >= 0
  ? process.argv[outputArgument + 1]
  : mkdtempSync(join(tmpdir(), "folio-iwork-synthetic-"));
mkdirSync(outputDir, { recursive: true });

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const paragraphXml = (values) => values.map((value) => `<p>${escapeXml(value)}</p>`).join("");
const tableXml = (rows) => `<table>${rows.map((row) => `<row>${row.map((value) => `<cell><string sfa:string="${escapeXml(value)}"/></cell>`).join("")}</row>`).join("")}</table>`;

const pagesXml = ({ values, pages = [values], table, extra = "" }) => `<?xml version="1.0" encoding="UTF-8"?>
<document xmlns:sfa="http://developer.apple.com/namespaces/sfa">
  ${pages.map((page, index) => `<page name="Page ${index + 1}">${paragraphXml(page)}${index === 0 && table ? tableXml(table) : ""}${index === 0 ? extra : ""}</page>`).join("")}
</document>`;

const keynoteXml = ({ slides }) => `<?xml version="1.0" encoding="UTF-8"?>
<document xmlns:sfa="http://developer.apple.com/namespaces/sfa">
  <slide-list>${slides.map((slide, index) => `<slide name="${escapeXml(slide.name || `Slide ${index + 1}`)}"><title><text-storage>${paragraphXml(slide.title ? [slide.title] : [])}</text-storage></title><body><text-storage>${paragraphXml(slide.values || [])}</text-storage></body>${slide.table ? tableXml(slide.table) : ""}${slide.notes ? `<notes><p>${escapeXml(slide.notes)}</p></notes>` : ""}${slide.extra || ""}</slide>`).join("")}</slide-list>
</document>`;

const numbersXml = ({ name = "Sheet 1", rows, extra = "" }) => `<?xml version="1.0" encoding="UTF-8"?>
<document xmlns:sfa="http://developer.apple.com/namespaces/sfa">
  <workspace name="${escapeXml(name)}">${tableXml(rows)}${extra}</workspace>
</document>`;

const pagesCases = [
  ["P01-text", "Plain text", ["A short paragraph for parser coverage."]],
  ["P02-paragraphs", "Paragraphs", ["First paragraph.", "Second paragraph.", "Third paragraph."]],
  ["P03-headings", "Headings", ["Heading one", "Heading two", "Body copy under a heading."]],
  ["P04-emphasis", "Emphasis", ["Bold and italic text markers remain text in this contract fixture."]],
  ["P05-unicode", "Unicode", ["Árvíztűrő tükörfúrógép · 日本語 · العربية · 👋"]],
  ["P06-multiple-pages", "Multiple pages", ["Page one marker"], [["Page one marker"], ["Page two marker"]]],
  ["P07-page-break", "Page break", ["Before the explicit break"], [["Before the explicit break"], ["After the explicit break"]]],
  ["P08-inline-image", "Inline image", ["Inline image marker"], undefined, "<inline-image src=\"Data/inline.png\"/>"],
  ["P09-floating-image", "Floating image", ["Floating image marker"], undefined, "<floating-image src=\"Data/float.png\"/>"],
  ["P10-table", "Table", ["Table marker"], undefined, undefined, [["Name", "Value"], ["Alpha", "10"], ["Beta", "20"]]],
  ["P11-header-footer", "Header and footer", ["Header marker", "Body marker", "Footer marker"], undefined, "<header><p>Header marker</p></header><footer><p>Footer marker</p></footer>"],
  ["P12-textbox", "Text box", ["Text box marker"], undefined, "<textbox><p>Text box content</p></textbox>"],
  ["P13-shape", "Shape", ["Shape marker"], undefined, "<shape><p>Shape label</p></shape>"],
  ["P14-sections", "Sections", ["Section one", "Section two"], undefined, "<section name=\"Section B\"><p>Section B content</p></section>"],
  ["P15-page-size", "Page size", ["Page size marker"], undefined, "<geometry><position sfa:x=\"0\" sfa:y=\"0\"/><size sfa:w=\"612\" sfa:h=\"792\"/></geometry>"],
  ["P16-complex", "Complex", ["Complex document marker", "Paragraph with a table and object references."], undefined, "<shape><p>Shape label</p></shape><inline-image src=\"Data/complex.png\"/>", [["Item", "Status"], ["One", "Ready"]]],
];

const keynoteCases = [
  ["K01-one-slide", "One slide", [{ title: "Slide title", values: ["Slide body"] }]],
  ["K02-multiple-slides", "Multiple slides", [{ title: "Slide one", values: ["One"] }, { title: "Slide two", values: ["Two"] }]],
  ["K03-text", "Text", [{ values: ["Keynote text marker"] }]],
  ["K04-unicode", "Unicode", [{ values: ["日本語 · العربية · 👋"] }]],
  ["K05-image", "Image", [{ values: ["Image marker"], extra: "<image src=\"Data/image.png\"/>" }]],
  ["K06-crop", "Crop", [{ values: ["Crop marker"], extra: "<image crop=\"0,0,1,1\"/>" }]],
  ["K07-shape", "Shape", [{ values: ["Shape marker"], extra: "<shape><p>Shape label</p></shape>" }]],
  ["K08-background", "Background", [{ values: ["Background marker"], extra: "<background color=\"#eef2f6\"/>" }]],
  ["K09-table", "Table", [{ values: ["Table marker"], table: [["A", "B"], ["1", "2"]] }]],
  ["K10-chart", "Chart", [{ values: ["Chart marker"], extra: "<chart><series>1,2,3</series></chart>" }]],
  ["K11-theme", "Theme", [{ values: ["Theme marker"], extra: "<theme name=\"Synthetic\"/>" }]],
  ["K12-overlap", "Overlap", [{ values: ["Overlap marker"], extra: "<shape><p>Back</p></shape><shape><p>Front</p></shape>" }]],
  ["K13-hidden", "Hidden", [{ values: ["Visible marker"], extra: "<hidden-slide><p>Hidden marker</p></hidden-slide>" }]],
  ["K14-notes", "Notes", [{ values: ["Notes marker"], notes: "Presenter note marker" }]],
  ["K15-16-9", "16:9", [{ values: ["Widescreen marker"], extra: "<size width=\"1280\" height=\"720\"/>" }]],
  ["K16-4-3", "4:3", [{ values: ["Classic marker"], extra: "<size width=\"1024\" height=\"768\"/>" }]],
  ["K17-complex", "Complex", [{ title: "Complex presentation", values: ["Text", "Unicode 👋"], table: [["Metric", "Value"], ["A", "10"]], notes: "Complex notes", extra: "<shape><p>Shape</p></shape><chart/>" }]],
];

const numbersCases = [
  ["N01-one-table", "One table", [["Name", "Value"], ["Alpha", "10"]]],
  ["N02-multiple-sheets", "Multiple sheets", [["Name", "Value"], ["Alpha", "10"]], "<sheet name=\"Sheet 2\">" + tableXml([["Second", "20"]]) + "</sheet>"],
  ["N03-formulas", "Formulas", [["A", "B", "Total"], ["10", "20", "30"]], "<formula-cell>SUM(A2:B2)</formula-cell>"],
  ["N04-dates", "Dates", [["Date", "Value"], ["2026-09-10", "Today"]]],
  ["N05-merged", "Merged cells", [["Merged heading", "", "Value"], ["A", "B", "10"]], "<merge-cell range=\"A1:B1\"/>"],
  ["N06-hidden", "Hidden rows", [["Visible", "10"], ["Hidden", "20"]], "<hidden-row index=\"2\"/>"],
  ["N07-chart", "Chart", [["Category", "Value"], ["A", "10"], ["B", "20"]], "<chart><series>10,20</series></chart>"],
  ["N08-image", "Image", [["Image marker", "10"]], "<image src=\"Data/image.png\"/>"],
  ["N09-layout", "Layout", [["Layout marker", "10"]], "<geometry><position sfa:x=\"12\" sfa:y=\"18\"/><size sfa:w=\"400\" sfa:h=\"240\"/></geometry>"],
  ["N10-unicode", "Unicode", [["日本語", "👋"]]],
  ["N11-complex", "Complex", [["Item", "Value"], ["Alpha", "10"], ["Beta", "20"]], "<chart/><image src=\"Data/complex.png\"/><merge-cell range=\"A1:B1\"/>"],
];

const writeZip = async (relativePath, files) => {
  const zip = new JSZip();
  for (const [filePath, content] of Object.entries(files)) zip.file(filePath, content);
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const target = join(outputDir, relativePath);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, bytes);
  return { path: relativePath, bytes: bytes.length };
};

const manifest = { generated: "synthetic", license: "Apache-2.0", warning: "Synthetic parser-contract fixtures are not Apple reference outputs.", fixtures: [] };
for (const [id, feature, values, pages, extra, table] of pagesCases) {
  const file = `pages/${id}.pages`;
  manifest.fixtures.push({ id, kind: "pages", feature, path: file, generation: "iwork-09" });
  await writeZip(file, { "index.xml": pagesXml({ values, pages, extra, table }), "Metadata/Properties.plist": "synthetic Pages", ...(extra?.includes("image") ? { "Data/inline.png": onePixelPng } : {}) });
}
for (const [id, feature, slides] of keynoteCases) {
  const file = `keynote/${id}.key`;
  manifest.fixtures.push({ id, kind: "keynote", feature, path: file, generation: "iwork-09" });
  await writeZip(file, { "index.apxl": keynoteXml({ slides }), "Metadata/Properties.plist": "synthetic Keynote" });
}
for (const [id, feature, rows, extra] of numbersCases) {
  const file = `numbers/${id}.numbers`;
  manifest.fixtures.push({ id, kind: "numbers", feature, path: file, generation: "iwork-09" });
  await writeZip(file, { "index.xml": numbersXml({ rows, extra }), "Metadata/Properties.plist": "synthetic Numbers" });
}
writeFileSync(join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ outputDir, fixtureCount: manifest.fixtures.length, manifest: join(outputDir, "manifest.json") }, null, 2));
