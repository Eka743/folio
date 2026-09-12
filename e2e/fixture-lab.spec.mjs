import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateFixtureLab } from "../scripts/fixture-lab.mjs";

test.describe.configure({ mode: "serial" });

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let fixtureRoot;
let fixtureManifest;

test.beforeAll(async () => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "folio-fixture-lab-e2e-"));
  const generated = await generateFixtureLab(fixtureRoot);
  fixtureManifest = generated.manifest;
  expect(fixtureManifest.fixtures).toHaveLength(31);
  const appleFixtures = {
    "sample.pages": `<document><page name="Page 1"><p>Generated Pages privacy fixture</p></page></document>`,
    "sample.key": `<document><slide-list><slide name="Slide 1"><title><text-storage><p>Generated Keynote privacy fixture</p></text-storage></title></slide></slide-list></document>`,
    "sample.numbers": `<document xmlns:sfa="http://developer.apple.com/namespaces/sfa"><workspace name="Privacy"><table><row><cell><string sfa:string="Item"/></cell><cell><string sfa:string="Value"/></cell></row><row><cell><string sfa:string="Local"/></cell><cell><string sfa:string="1"/></cell></row></table></workspace></document>`,
  };
  for (const [name, source] of Object.entries(appleFixtures)) {
    const zip = new JSZip();
    zip.file(name.endsWith(".key") ? "index.apxl" : "index.xml", source);
    zip.file("Metadata/Properties.plist", `synthetic ${name}`);
    const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const path = fixturePath("apple", name);
    const directory = path.slice(0, path.lastIndexOf("/"));
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, bytes);
  }
});

test.afterAll(() => {
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
});

function fixturePath(kind, name) {
  return join(fixtureRoot, kind, name);
}

async function downloadResult(page, buttonName) {
  await page.getByRole("button", { name: buttonName }).click();
  const link = page.getByRole("link", { name: /^Download / }).first();
  await expect(link).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await link.click();
  const download = await downloadPromise;
  return readFileSync(await download.path());
}

async function parsePdf(bytes) {
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(200);
  const hasImageResource = /\/Subtype\s*\/Image/.test(bytes.toString("latin1"));
  const pdf = await getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    standardFontDataUrl: join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/"),
    verbosity: 0,
  }).promise;
  let text = "";
  const pageSizes = [];
  for (let index = 1; index <= pdf.numPages; index++) {
    const page = await pdf.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    pageSizes.push({ width: viewport.width, height: viewport.height });
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n";
  }
  const pageCount = pdf.numPages;
  await pdf.destroy();
  return { pageCount, text, hasImageResource, pageSizes };
}

function names(kind, extension) {
  return fixtureManifest.fixtures
    .filter((fixture) => fixture.kind === kind && fixture.name.endsWith(extension))
    .map((fixture) => fixture.name)
    .sort();
}

test("generated DOCX corpus produces useful reparsable PDFs", async ({ page }) => {
  for (const name of names("docx", ".docx")) {
    await page.goto("/tools/docx-to-pdf");
    await page.locator('input[type="file"]').setInputFiles(fixturePath("docx", name));
    const output = await downloadResult(page, "Convert to PDF");
    const parsed = await parsePdf(output);
    // Folio's DOCX renderer intentionally rasterizes the browser layout to
    // preserve CSS-compatible pagination, so validate its useful content as
    // rendered page imagery rather than expecting a text layer.
    expect(parsed.hasImageResource, name).toBe(true);
    expect(output.length, name).toBeGreaterThan(10_000);
    if (["multipage.docx", "mixed-complex.docx"].includes(name)) expect(parsed.pageCount, name).toBeGreaterThan(1);
    expect(parsed.text, name).not.toMatch(/undefined|TypeError|NaN/);
    if (name === "mixed-complex.docx") {
      expect(parsed.pageSizes[0].width).toBeCloseTo(595.28, 1);
      expect(parsed.pageSizes[0].height).toBeCloseTo(841.89, 1);
    }
  }
});

test("generated PPTX corpus preserves slide count and text in PDF output", async ({ page }) => {
  for (const name of names("pptx", ".pptx")) {
    await page.goto("/tools/powerpoint-to-pdf");
    await page.locator('input[type="file"]').setInputFiles(fixturePath("pptx", name));
    const output = await downloadResult(page, "Convert to PDF");
    const parsed = await parsePdf(output);
    const expectedSlides = name === "multipage.pptx" || name === "mixed.pptx" ? 4 : 1;
    expect(parsed.pageCount, name).toBe(expectedSlides);
    expect(parsed.text, name).toMatch(/Generated|Diapositiva/);
    expect(parsed.text, name).not.toMatch(/undefined|TypeError|NaN/);
    if (name === "mixed.pptx") {
      for (const size of parsed.pageSizes) {
        expect(size.width).toBeCloseTo(960, 0);
        expect(size.height).toBeCloseTo(540, 0);
      }
    }
  }
});

test("generated XLSX corpus preserves sheets and readable cell content in PDF output", async ({ page }) => {
  for (const name of names("xlsx", ".xlsx")) {
    await page.goto("/tools/excel-to-pdf");
    await page.locator('input[type="file"]').setInputFiles(fixturePath("xlsx", name));
    const output = await downloadResult(page, "Convert to PDF");
    const parsed = await parsePdf(output);
    if (["multi-sheet.xlsx", "mixed.xlsx"].includes(name)) expect(parsed.pageCount, name).toBeGreaterThanOrEqual(2);
    expect(parsed.text, name).toMatch(/Item|Column|Generated|Resumen|Café|acción/);
    expect(parsed.text, name).not.toMatch(/undefined|TypeError|NaN/);
    if (name === "mixed.xlsx") {
      expect(parsed.text).toContain("2026-09-11");
      expect(parsed.text).not.toContain("46276");
      expect(parsed.pageSizes[0].width).toBeLessThan(parsed.pageSizes[0].height);
    }
  }
});

test("generated Markdown, PDF and mixed local conversion outputs are valid", async ({ page }) => {
  await page.goto("/tools/markdown-to-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixturePath("markdown", "mixed.md"));
  const markdownPdf = await downloadResult(page, "Convert to PDF");
  const markdownPdfParsed = await parsePdf(markdownPdf);
  expect(markdownPdfParsed.hasImageResource).toBe(true);
  expect(markdownPdf.length).toBeGreaterThan(10_000);

  await page.goto("/tools/pdf-to-markdown");
  await page.locator('input[type="file"]').setInputFiles(fixturePath("pdf", "multipage.pdf"));
  const markdown = await downloadResult(page, "Convert to Markdown");
  expect(markdown.toString("utf8")).toContain("Folio generated PDF page 1");
  expect(markdown.toString("utf8")).toContain("Folio generated PDF page 3");

  await page.goto("/tools/combine-to-pdf");
  await page.locator('input[type="file"]').setInputFiles([
    fixturePath("pdf", "multipage.pdf"),
    fixturePath("markdown", "mixed.md"),
  ]);
  const combined = await downloadResult(page, "Combine 2 documents into PDF");
  const combinedParsed = await parsePdf(combined);
  expect(combinedParsed.pageCount).toBeGreaterThanOrEqual(4);
  expect(combinedParsed.text).toContain("Folio generated PDF page 1");
});

test("Universal Drop detects the supported format matrix and enforces selection limits", async ({ page }) => {
  const pdfBytes = readFileSync(fixturePath("pdf", "multipage.pdf"));
  const jpegBytes = await (async () => {
    await page.goto("/tools/pdf-to-jpg");
    await page.locator('input[type="file"]').setInputFiles(fixturePath("pdf", "multipage.pdf"));
    await page.getByRole("button", { name: "Convert to JPG" }).click();
    const link = page.getByRole("link", { name: "Download JPG" }).first();
    await expect(link).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await link.click();
    const download = await downloadPromise;
    return readFileSync(await download.path());
  })();
  const cases = [
    ["UPPER.PDF", pdfBytes, "application/octet-stream", "PDF"],
    ["no-extension", pdfBytes, "", "PDF"],
    ["document.DOCX", readFileSync(fixturePath("docx", "mixed-complex.docx")), "text/plain", "Word document"],
    ["slides.PPTX", readFileSync(fixturePath("pptx", "mixed.pptx")), "", "PowerPoint presentation"],
    ["workbook.XLSX", readFileSync(fixturePath("xlsx", "mixed.xlsx")), "text/plain", "Excel workbook"],
    ["notes.MARKDOWN", readFileSync(fixturePath("markdown", "mixed.md")), "application/octet-stream", "Markdown document"],
    ["photo.PNG", ONE_PIXEL_PNG, "", "PNG image"],
    ["photo.JPEG", jpegBytes, "application/octet-stream", "JPEG image"],
    ["proposal.PAGES", readFileSync(fixturePath("apple", "sample.pages")), "application/octet-stream", "Apple Pages document"],
    ["slides.KEY", readFileSync(fixturePath("apple", "sample.key")), "", "Apple Keynote presentation"],
    ["budget.NUMBERS", readFileSync(fixturePath("apple", "sample.numbers")), "text/plain", "Apple Numbers spreadsheet"],
  ];

  for (const [name, buffer, mimeType, label] of cases) {
    await page.goto("/");
    const section = page.locator('section[aria-labelledby="universal-drop-heading"]');
    await section.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });
    await expect(section).toContainText(`Detected as ${label}`);
    await expect(section).not.toContainText(/Inspecting/);
  }

  await page.goto("/");
  const universal = page.locator('section[aria-labelledby="universal-drop-heading"]');
  await universal.locator('input[type="file"]').setInputFiles([
    { name: "malformed.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nnot finished") },
    { name: "empty.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) },
  ]);
  await expect(universal).toContainText("The PDF header or end marker is missing");
  await expect(universal).toContainText("This file is empty (0 bytes)");
  await expect(universal.getByRole("button", { name: /Merge/ })).toHaveCount(0);

  const sizeOverrides = {
    "under-a.pdf": 75 * 1024 * 1024,
    "under-b.pdf": 75 * 1024 * 1024 - 1,
    "at-a.pdf": 75 * 1024 * 1024,
    "at-b.pdf": 75 * 1024 * 1024,
    "over-a.pdf": 75 * 1024 * 1024,
    "over-b.pdf": 75 * 1024 * 1024 + 1,
    "pdf-under.pdf": 100 * 1024 * 1024 - 1,
    "pdf-at.pdf": 100 * 1024 * 1024,
    "pdf-over.pdf": 100 * 1024 * 1024 + 1,
    "docx-under.docx": 50 * 1024 * 1024 - 1,
    "docx-at.docx": 50 * 1024 * 1024,
    "docx-over.docx": 50 * 1024 * 1024 + 1,
    "image-under.png": 25 * 1024 * 1024 - 1,
    "image-at.png": 25 * 1024 * 1024,
    "image-over.png": 25 * 1024 * 1024 + 1,
    "markdown-under.md": 10 * 1024 * 1024 - 1,
    "markdown-at.md": 10 * 1024 * 1024,
    "markdown-over.md": 10 * 1024 * 1024 + 1,
    "apple-under.pages": 100 * 1024 * 1024 - 1,
    "apple-at.pages": 100 * 1024 * 1024,
    "apple-over.pages": 100 * 1024 * 1024 + 1,
  };
  await page.addInitScript((overrides) => {
    const owner = Object.getOwnPropertyDescriptor(File.prototype, "size")?.get
      ? File.prototype
      : Blob.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(owner, "size");
    if (!descriptor?.get) return;
    Object.defineProperty(owner, "size", {
      configurable: true,
      get() {
        return overrides[this.name] ?? descriptor.get.call(this);
      },
    });
  }, sizeOverrides);
  await page.goto("/");
  const limitedSection = page.locator('section[aria-labelledby="universal-drop-heading"]');
  const smallPdf = { name: "under-a.pdf", mimeType: "application/pdf", buffer: pdfBytes };
  await limitedSection.locator('input[type="file"]').setInputFiles(Array.from({ length: 19 }, (_, index) => ({
    ...smallPdf,
    name: `count-${index + 1}.pdf`,
  })));
  await expect(limitedSection.locator('[data-universal-file-count="19"]')).toBeVisible();
  await limitedSection.getByRole("button", { name: "Start over" }).click();
  await limitedSection.locator('input[type="file"]').setInputFiles(Array.from({ length: 20 }, (_, index) => ({
    ...smallPdf,
    name: `count-${index + 1}.pdf`,
  })));
  await expect(limitedSection.locator('[data-universal-file-count="20"]')).toBeVisible();
  await expect(limitedSection.getByRole("button", { name: "Merge 20 PDFs" })).toBeVisible();
  await limitedSection.getByRole("button", { name: "Start over" }).click();
  await limitedSection.locator('input[type="file"]').setInputFiles(Array.from({ length: 21 }, (_, index) => ({
    ...smallPdf,
    name: `count-${index + 1}.pdf`,
  })));
  await expect(limitedSection.locator('[data-universal-file-count="20"]')).toBeVisible();
  await expect(limitedSection).toContainText("Select no more than 20 documents");

  for (const [a, b, message] of [
    ["under-a.pdf", "under-b.pdf", null],
    ["at-a.pdf", "at-b.pdf", null],
    ["over-a.pdf", "over-b.pdf", "150 MB total local limit"],
  ]) {
    await limitedSection.getByRole("button", { name: "Start over" }).click();
    await limitedSection.locator('input[type="file"]').setInputFiles([
      { name: a, mimeType: "application/pdf", buffer: pdfBytes },
      { name: b, mimeType: "application/pdf", buffer: pdfBytes },
    ]);
    if (message) await expect(limitedSection).toContainText(message);
    else await expect(limitedSection.getByRole("button", { name: "Merge 2 PDFs" })).toBeVisible();
  }

  for (const [name, source, mimeType, limitMessage] of [
    ["pdf-under.pdf", pdfBytes, "application/pdf", null],
    ["pdf-at.pdf", pdfBytes, "application/pdf", null],
    ["pdf-over.pdf", pdfBytes, "application/pdf", "100 MB local limit"],
    ["docx-under.docx", readFileSync(fixturePath("docx", "simple.docx")), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", null],
    ["docx-at.docx", readFileSync(fixturePath("docx", "simple.docx")), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", null],
    ["docx-over.docx", readFileSync(fixturePath("docx", "simple.docx")), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "50 MB local limit"],
    ["image-under.png", ONE_PIXEL_PNG, "image/png", null],
    ["image-at.png", ONE_PIXEL_PNG, "image/png", null],
    ["image-over.png", ONE_PIXEL_PNG, "image/png", "25 MB local limit"],
    ["markdown-under.md", Buffer.from("# Local\n"), "text/markdown", null],
    ["markdown-at.md", Buffer.from("# Local\n"), "text/markdown", null],
    ["markdown-over.md", Buffer.from("# Local\n"), "text/markdown", "10 MB local limit"],
    ["apple-under.pages", readFileSync(fixturePath("apple", "sample.pages")), "application/vnd.apple.pages", null],
    ["apple-at.pages", readFileSync(fixturePath("apple", "sample.pages")), "application/vnd.apple.pages", null],
    ["apple-over.pages", readFileSync(fixturePath("apple", "sample.pages")), "application/vnd.apple.pages", "100 MB local limit"],
  ]) {
    await limitedSection.getByRole("button", { name: "Start over" }).click();
    await limitedSection.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer: source });
    if (limitMessage) await expect(limitedSection).toContainText(limitMessage);
    else await expect(limitedSection.locator('[data-universal-file-count="1"]')).toBeVisible();
  }
});

test("every local converter sends no document bytes, names or metadata over the network", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(request));
  const cases = [
    ["/tools/docx-to-pdf", "docx", "simple.docx", "Convert to PDF", "docx"],
    ["/tools/powerpoint-to-pdf", "pptx", "simple.pptx", "Convert to PDF", "pptx"],
    ["/tools/excel-to-pdf", "xlsx", "simple.xlsx", "Convert to PDF", "xlsx"],
    ["/tools/pages-to-pdf", "apple", "sample.pages", "Convert to PDF", "pages"],
    ["/tools/pages-to-word", "apple", "sample.pages", "Convert to DOCX", "pages"],
    ["/tools/keynote-to-pdf", "apple", "sample.key", "Convert to PDF", "keynote"],
    ["/tools/keynote-to-powerpoint", "apple", "sample.key", "Convert to PPTX", "keynote"],
    ["/tools/numbers-to-pdf", "apple", "sample.numbers", "Convert to PDF", "numbers"],
    ["/tools/numbers-to-xlsx", "apple", "sample.numbers", "Convert to XLSX", "numbers"],
    ["/tools/markdown-to-pdf", "markdown", "mixed.md", "Convert to PDF", "markdown"],
    ["/tools/pdf-to-markdown", "pdf", "multipage.pdf", "Convert to Markdown", "pdf"],
  ];
  for (const [route, kind, name, button, _label] of cases) {
    await page.goto(route);
    requests.length = 0;
    await page.locator('input[type="file"]').setInputFiles(fixturePath(kind, name));
    await downloadResult(page, button);
    const suspicious = requests.filter((request) => {
      const url = request.url().toLowerCase();
      const postData = request.postData() ?? "";
      return request.method() !== "GET" || new URL(request.url()).origin !== new URL(page.url()).origin ||
        /\/api\/|upload|multipart|simple\.docx|simple\.pptx|simple\.xlsx|sample\.pages|sample\.key|sample\.numbers|mixed\.md|multipage\.pdf/.test(url) ||
        postData.length > 0;
    });
    expect(suspicious, `${route} must stay local`).toEqual([]);
  }

  await page.goto("/tools/combine-to-pdf");
  requests.length = 0;
  await page.locator('input[type="file"]').setInputFiles([
    fixturePath("pdf", "multipage.pdf"),
    fixturePath("markdown", "mixed.md"),
  ]);
  await downloadResult(page, "Combine 2 documents into PDF");
  const suspicious = requests.filter((request) => request.method() !== "GET" || new URL(request.url()).origin !== new URL(page.url()).origin || request.postData());
  expect(suspicious).toEqual([]);
});

test("independent ZIP readers can reopen the generated Office fixture corpus", async () => {
  for (const kind of ["docx", "pptx", "xlsx"]) {
    for (const name of names(kind, `.${kind}`)) {
      const archive = await JSZip.loadAsync(readFileSync(fixturePath(kind, name)));
      const fileEntries = Object.values(archive.files).filter((entry) => !entry.dir);
      expect(fileEntries.length, `${kind}/${name}`).toBeGreaterThan(4);
    }
  }
});
