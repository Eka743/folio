import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE_ORIGIN = "http://127.0.0.1:3001";
const PUBLIC_TOOLS = [
  "/tools/merge-pdf",
  "/tools/split-pdf",
  "/tools/images-to-pdf",
  "/tools/docx-to-pdf",
  "/tools/pdf-to-jpg",
  "/tools/rotate-pdf",
  "/tools/compress-pdf",
];

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let fixtureDir;
let fixtures;

test.beforeAll(async () => {
  fixtureDir = mkdtempSync(join(tmpdir(), "folio-browser-matrix-"));
  const onePage = await makePdf(1);
  const twoPage = await makePdf(2);
  const docx = await makeDocx();

  fixtures = {
    onePage: writeFixture("one-page.pdf", onePage),
    twoPage: writeFixture("two-page.pdf", twoPage),
    secondPage: writeFixture("second-page.pdf", onePage),
    image: writeFixture("pixel.png", ONE_PIXEL_PNG),
    docx: writeFixture("simple.docx", docx),
    corruptPdf: writeFixture("corrupt.pdf", Buffer.from("not a PDF")),
  };
});

test.afterAll(() => {
  if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
});

test("public surface and retired native routes stay web-only", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /everyday pdf tools/i })).toBeVisible();

  const discoveredTools = await page
    .locator('a[href^="/tools/"]')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")))].sort());
  expect(discoveredTools).toEqual([...PUBLIC_TOOLS].sort());
  await expect(page.locator("body")).not.toContainText(/Folio for Mac|native helper|localhost/i);

  for (const retiredRoute of ["/mac", "/tools/pages-to-pdf"]) {
    await page.goto(retiredRoute);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("body")).not.toContainText(/Folio for Mac|native helper|localhost/i);
  }
});

test("all seven browser-local tools produce valid results", async ({ page }) => {
  await page.goto("/tools/merge-pdf");
  await page.locator('input[type="file"]').setInputFiles([fixtures.onePage, fixtures.secondPage]);
  const merged = await downloadFromResult(page, "Merge PDFs", /^Download /);
  expectPdf(merged);

  await page.goto("/tools/split-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.twoPage);
  await page.locator("#folio-pages").fill("1,,2");
  await page.getByRole("button", { name: "Extract pages" }).click();
  await expect(page.locator('div[role="alert"]').filter({ hasText: "Empty page or range found" })).toBeVisible();
  await page.locator("#folio-pages").fill("1-2");
  const split = await downloadFromResult(page, "Extract pages", /^Download /);
  expectPdf(split);

  await page.goto("/tools/rotate-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.twoPage);
  const rotated = await downloadFromResult(page, "Rotate PDF", /^Download /);
  expectPdf(rotated);

  await page.goto("/tools/compress-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.twoPage);
  const compressed = await downloadFromResult(page, "Compress PDF", /^Download /);
  expectPdf(compressed);

  await page.goto("/tools/images-to-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.image);
  const imagePdf = await downloadFromResult(page, "Create PDF", /^Download /);
  expectPdf(imagePdf);

  await page.goto("/tools/pdf-to-jpg");
  await page.locator('input[type="file"]').setInputFiles(fixtures.twoPage);
  await page.getByRole("button", { name: "Convert to JPG" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Rendered 2 pages" })).toBeVisible();
  const jpgLink = page.getByRole("link", { name: "Download JPG" }).first();
  const jpg = await downloadFromLink(page, jpgLink);
  expectJpeg(jpg);
  const zipLink = page.getByRole("link", { name: /Download all as ZIP/ });
  const zipBytes = await downloadFromLink(page, zipLink);
  const zip = await JSZip.loadAsync(zipBytes);
  const zipNames = Object.keys(zip.files).sort();
  expect(zipNames).toHaveLength(2);
  expect(zipNames.every((name) => name.endsWith(".jpg"))).toBe(true);
  expectJpeg(await zip.file(zipNames[0]).async("nodebuffer"));

  await page.goto("/tools/docx-to-pdf");
  await expect(page.locator("body")).toContainText("Beta");
  await page.locator('input[type="file"]').setInputFiles(fixtures.docx);
  const docxPdf = await downloadFromResult(page, "Convert to PDF", /^Download /);
  expectPdf(docxPdf);
});

test("malformed input recovers, double-clicks stay single-result, and conversion stays private", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(request));

  await page.goto("/tools/split-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.corruptPdf);
  await page.getByRole("button", { name: "Extract pages" }).click();
  const error = page.locator('div[role="alert"]').filter({ hasText: "Could not read this PDF" });
  await expect(error).toContainText("Could not read this PDF");
  await expect(error).not.toContainText(/TypeError|stack|undefined/i);

  await page.getByRole("button", { name: "Start over" }).click();
  await page.locator('input[type="file"]').setInputFiles(fixtures.twoPage);
  await page.locator("#folio-pages").fill("1");
  const recovered = await downloadFromResult(page, "Extract pages", /^Download /);
  expectPdf(recovered);

  await page.goto("/tools/merge-pdf");
  await page.locator('input[type="file"]').setInputFiles([fixtures.onePage, fixtures.secondPage]);
  await page.getByRole("button", { name: "Merge PDFs" }).dblclick();
  const resultLinks = page.getByRole("link", { name: /^Download / });
  await expect(resultLinks).toHaveCount(1);
  const doubleClickResult = await downloadFromLink(page, resultLinks.first());
  expectPdf(doubleClickResult);

  const externalRequests = requests.filter((request) => {
    const url = new URL(request.url());
    return ["http:", "https:"].includes(url.protocol) && url.origin !== BASE_ORIGIN;
  });
  const documentRequests = requests.filter((request) => {
    const url = request.url().toLowerCase();
    return request.method() !== "GET" || /\/api\/|\.pdf(?:$|[?#])|\.docx(?:$|[?#])|upload|multipart/.test(url);
  });
  expect(externalRequests).toEqual([]);
  expect(documentRequests).toEqual([]);
});

function writeFixture(name, bytes) {
  const path = join(fixtureDir, name);
  writeFileSync(path, bytes);
  return path;
}

async function makePdf(pageCount) {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) pdf.addPage([320, 240]);
  return Buffer.from(await pdf.save());
}

async function makeDocx() {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Folio browser matrix fixture</w:t></w:r></w:p><w:sectPr/></w:body>
</w:document>`,
  );
  return await zip.generateAsync({ type: "nodebuffer" });
}

async function downloadFromResult(page, buttonName, linkName) {
  await page.getByRole("button", { name: buttonName }).click();
  const link = page.getByRole("link", { name: linkName }).first();
  await expect(link).toBeVisible();
  return downloadFromLink(page, link);
}

async function downloadFromLink(page, link) {
  const downloadPromise = page.waitForEvent("download");
  await link.click();
  const download = await downloadPromise;
  const path = await download.path();
  return readFileSync(path);
}

function expectPdf(bytes) {
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
}

function expectJpeg(bytes) {
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);
  expect(bytes[2]).toBe(0xff);
}
