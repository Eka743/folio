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

async function expectNoUserHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    let rightmost = window.innerWidth;
    for (const element of document.querySelectorAll("body *")) {
      // Next's development overlay is outside Folio's page layout and can
      // report a false overflow on narrow CI viewports.
      if (element.closest("nextjs-portal")) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.right > rightmost) {
        rightmost = rect.right;
      }
    }
    return Math.max(0, rightmost - window.innerWidth);
  });
  // Linux browser scroll metrics can round the viewport edge by a few CSS px;
  // reject meaningful overflow without making this a platform-specific test.
  expect(overflow).toBeLessThanOrEqual(4);
}

let fixtureDir;
let fixtures;

test.beforeAll(async () => {
  fixtureDir = mkdtempSync(join(tmpdir(), "folio-browser-matrix-"));
  const onePage = await makePdf(1);
  const twoPage = await makePdf(2);
  const docx = await makeDocx();
  const pages = await makePages(onePage);
  const keynote = await makeAppleContainer("com.apple.iWork.Keynote", onePage);
  const numbers = await makeAppleContainer("com.apple.iWork.Numbers", onePage);

  fixtures = {
    onePage: writeFixture("one-page.pdf", onePage),
    twoPage: writeFixture("two-page.pdf", twoPage),
    secondPage: writeFixture("second-page.pdf", onePage),
    image: writeFixture("pixel.png", ONE_PIXEL_PNG),
    docx: writeFixture("simple.docx", docx),
    pages: writeFixture("proposal.pages", pages),
    keynote: writeFixture("presentation.key", keynote),
    numbers: writeFixture("budget.numbers", numbers),
    fakeApple: writeFixture("not-really.pages", await makeZip({ "notes.txt": "not an iWork document" })),
    corruptPdf: writeFixture("corrupt.pdf", Buffer.from("not a PDF")),
    corruptImage: writeFixture("corrupt.png", Buffer.from("not an image")),
    corruptDocx: writeFixture("corrupt.docx", Buffer.from("not a DOCX")),
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

test("public routes render successfully", async ({ page }) => {
  const routes = [
    "/",
    "/privacy",
    "/cookies",
    "/terms",
    "/legal",
    "/security",
    "/open-source",
    ...PUBLIC_TOOLS,
  ];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main")).toBeVisible();
  }
});

test("all seven browser-local tools produce valid results", async ({ page }) => {
  await page.goto("/tools/merge-pdf");
  await page.locator('input[type="file"]').setInputFiles([fixtures.onePage, fixtures.secondPage]);
  const merged = await downloadFromResult(page, "Merge PDFs", /^Download /);
  await expectPdf(merged, 2);

  await page.goto("/tools/split-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.twoPage);
  await page.locator("#folio-pages").fill("1,,2");
  await page.getByRole("button", { name: "Extract pages" }).click();
  await expect(page.locator('div[role="alert"]').filter({ hasText: "Empty page or range found" })).toBeVisible();
  await page.locator("#folio-pages").fill("1-2");
  const split = await downloadFromResult(page, "Extract pages", /^Download /);
  await expectPdf(split, 2);

  await page.goto("/tools/rotate-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.twoPage);
  const rotated = await downloadFromResult(page, "Rotate PDF", /^Download /);
  await expectPdf(rotated, 2);

  await page.goto("/tools/compress-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.twoPage);
  const compressed = await downloadFromResult(page, "Compress PDF", /^Download /);
  await expectPdf(compressed, 2);

  await page.goto("/tools/images-to-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.image);
  const imagePdf = await downloadFromResult(page, "Create PDF", /^Download /);
  await expectPdf(imagePdf, 1);

  await page.goto("/tools/pdf-to-jpg");
  await page.locator('input[type="file"]').setInputFiles(fixtures.twoPage);
  await page.getByRole("button", { name: "Convert to JPG" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Rendered 2 pages" })).toBeVisible();
  const jpgLink = page.getByRole("link", { name: "Download JPG" }).first();
  const jpg = await downloadFromLink(page, jpgLink);
  await expectJpeg(page, jpg);
  const zipLink = page.getByRole("link", { name: /Download all as ZIP/ });
  const zipBytes = await downloadFromLink(page, zipLink);
  const zip = await JSZip.loadAsync(zipBytes);
  const zipNames = Object.keys(zip.files).sort();
  expect(zipNames).toHaveLength(2);
  expect(zipNames.every((name) => name.endsWith(".jpg"))).toBe(true);
  await expectJpeg(page, await zip.file(zipNames[0]).async("nodebuffer"));

  await page.goto("/tools/docx-to-pdf");
  await expect(page.locator("body")).toContainText("Beta");
  await page.locator('input[type="file"]').setInputFiles(fixtures.docx);
  const docxPdf = await downloadFromResult(page, "Convert to PDF", /^Download /);
  await expectPdf(docxPdf, 1);
});

test("same PDF selected twice survives a WebKit-style read failure", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeArrayBuffer = File.prototype.arrayBuffer;
    let injected = false;
    File.prototype.arrayBuffer = function () {
      if (!injected) {
        injected = true;
        return Promise.reject(
          new DOMException("The I/O read operation failed.", "NotReadableError"),
        );
      }
      return nativeArrayBuffer.call(this);
    };
  });

  await page.goto("/tools/merge-pdf");
  await page.locator('input[type="file"]').setInputFiles([fixtures.onePage, fixtures.onePage]);
  const merged = await downloadFromResult(page, "Merge PDFs", /^Download /);
  await expectPdf(merged, 2);
  await expect(page.locator('[role="alert"]')).not.toContainText(/I\/O read operation failed/);
});

test("same File object can be dropped twice into Merge PDF", async ({ page }) => {
  await page.goto("/tools/merge-pdf");
  const bytes = readFileSync(fixtures.onePage).toString("base64");
  const dropzone = page.getByRole("button", { name: /Drop files here or press Enter/i });
  await dropzone.evaluate((element, base64) => {
    const binary = atob(base64);
    const file = new File(
      [Uint8Array.from(binary, (char) => char.charCodeAt(0))],
      "same-object.pdf",
      { type: "application/pdf" },
    );
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    dataTransfer.items.add(file);
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
  }, bytes);
  await expect(page.getByRole("list", { name: "Selected files" }).locator("li")).toHaveCount(2);
  const merged = await downloadFromResult(page, "Merge PDFs", /^Download /);
  await expectPdf(merged, 2);
});

test("long Unicode filenames remain usable through a conversion", async ({ page }) => {
  await page.goto("/tools/merge-pdf");
  const firstName = "résumé — revisión final — ".repeat(8) + "uno.pdf";
  const secondName = "合同書類 — versión 2.pdf";
  const bytes = readFileSync(fixtures.onePage);
  await page.locator('input[type="file"]').setInputFiles([
    { name: firstName, mimeType: "application/pdf", buffer: bytes },
    { name: secondName, mimeType: "application/pdf", buffer: bytes },
  ]);
  const selected = page.getByRole("list", { name: "Selected files" });
  await expect(selected).toContainText(firstName);
  await expect(selected).toContainText(secondName);
  const merged = await downloadFromResult(page, "Merge PDFs", /^Download /);
  await expectPdf(merged, 2);
});

test("Universal Drop detects content and hands off to the existing tools", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /drop a document/i })).toBeVisible();

  const drop = page.locator('section[aria-labelledby="universal-drop-heading"]');
  await drop.locator('input[type="file"]').setInputFiles(fixtures.onePage);
  await expect(drop).toContainText("Detected as PDF");
  await expect(drop.getByRole("button", { name: "Merge PDFs" })).toBeVisible();
  await drop.getByRole("button", { name: "Merge PDFs" }).click();
  await expect(page.getByRole("heading", { name: "Merge PDF" })).toBeVisible();
  const toolInput = page.locator('input[type="file"]');
  await toolInput.setInputFiles(fixtures.onePage);
  const merged = await downloadFromResult(page, "Merge PDFs", /^Download /);
  await expectPdf(merged, 2);

  await page.goto("/");
  const universalInput = page.locator('section[aria-labelledby="universal-drop-heading"] input[type="file"]');
  await universalInput.setInputFiles(fixtures.pages);
  await expect(page.locator('section[aria-labelledby="universal-drop-heading"]')).toContainText("Apple Pages document");
  await expect(page.getByText("Detected, but conversion is unavailable.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare embedded PDF preview", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Prepare embedded PDF preview", exact: true }).click();
  const previewHref = await page.getByRole("link", { name: "Open preview in a new tab", exact: true }).getAttribute("href");
  expect(previewHref).toMatch(/^blob:/);
  await expect(page.getByRole("button", { name: "Start over", exact: true })).toBeVisible();

  await page.goto("/");
  await page.locator('section[aria-labelledby="universal-drop-heading"] input[type="file"]').setInputFiles(fixtures.fakeApple);
  await expect(page.locator('section[aria-labelledby="universal-drop-heading"]')).toContainText("Unknown file");
  await expect(page.getByText("This ZIP container is not a supported document format.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Merge PDFs" })).toHaveCount(0);
});

test("Universal Drop detects a local PDF within the interaction budget", async ({ page }) => {
  await page.goto("/");
  const section = page.locator('section[aria-labelledby="universal-drop-heading"]');
  const input = section.locator('input[type="file"]');
  const startedAt = await page.evaluate(() => performance.now());
  await input.setInputFiles(fixtures.onePage);
  await expect(section).toContainText("Detected as PDF");
  const elapsedMs = await page.evaluate((start) => performance.now() - start, startedAt);
  console.log(`Universal Drop PDF detection: ${elapsedMs.toFixed(1)} ms`);
  expect(elapsedMs).toBeLessThanOrEqual(250);
});

test("Universal Drop identifies images, DOCX and Apple containers without overpromising support", async ({ page }) => {
  await page.goto("/");
  const section = page.locator('section[aria-labelledby="universal-drop-heading"]');
  const input = section.locator('input[type="file"]');

  await input.setInputFiles(fixtures.image);
  await expect(section).toContainText("Detected as PNG image");
  await expect(section.getByRole("button", { name: "Create a PDF" })).toBeVisible();
  await section.getByRole("button", { name: "Create a PDF" }).click();
  await expect(page.getByRole("heading", { name: "JPG / PNG to PDF" })).toBeVisible();

  await page.goto("/");
  await page.locator('section[aria-labelledby="universal-drop-heading"] input[type="file"]').setInputFiles(fixtures.docx);
  await expect(page.locator('section[aria-labelledby="universal-drop-heading"]')).toContainText("Detected as Word document");
  await page.getByRole("button", { name: "Convert to PDF" }).click();
  await expect(page.getByRole("heading", { name: "Word to PDF" })).toBeVisible();

  for (const [fixture, label] of [[fixtures.keynote, "Apple Keynote presentation"], [fixtures.numbers, "Apple Numbers spreadsheet"]]) {
    await page.goto("/");
    const universal = page.locator('section[aria-labelledby="universal-drop-heading"]');
    await universal.locator('input[type="file"]').setInputFiles(fixture);
    await expect(universal).toContainText(`Detected as ${label}`);
    await expect(universal).toContainText("Detected, but conversion is unavailable.");
    await expect(universal.getByRole("button", { name: "Prepare embedded PDF preview" })).toBeVisible();
  }
});

test("Universal Drop remains usable at release mobile and tablet viewports", async ({ page }) => {
  for (const [width, height] of [[375, 667], [390, 844], [430, 932], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const drop = page.getByRole("button", { name: /Drop files here or press Enter/i });
    await expect(page.getByRole("heading", { name: /drop a document/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Small tools for everyday documents." })).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await expectNoUserHorizontalOverflow(page);
    await drop.focus();
    await expect(drop).toBeFocused();
    await expect(drop).toHaveAttribute("aria-disabled", "false");

    await page.goto("/tools/merge-pdf");
    await expect(page.getByRole("heading", { name: "Merge PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Drop files here or press Enter/i })).toBeVisible();
  }
});

test("selection, errors and success states move focus to useful content", async ({ page }) => {
  await page.goto("/tools/merge-pdf");
  const input = page.locator('input[type="file"]');
  await input.setInputFiles([fixtures.onePage, fixtures.onePage]);
  await expect(page.getByRole("list", { name: "Selected files" })).toBeFocused();
  await page.getByRole("button", { name: "Merge PDFs" }).click();
  await expect(page.locator('div[role="status"]').filter({ hasText: "Done" })).toBeFocused();

  await page.goto("/tools/split-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.corruptPdf);
  await page.locator("#folio-pages").fill("1");
  await page.getByRole("button", { name: "Extract pages" }).click();
  await expect(page.locator('div[role="alert"]').filter({ hasText: "Could not read this PDF" })).toBeFocused();
});

test("Universal Drop rejects multi-file and keeps the viewport stable on tablet", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  const section = page.locator('section[aria-labelledby="universal-drop-heading"]');
  const dropzone = section.getByRole("button", { name: /Drop files here or press Enter/i });
  const first = readFileSync(fixtures.onePage).toString("base64");
  await dropzone.evaluate((element, payload) => {
    const dataTransfer = new DataTransfer();
    for (const item of payload) {
      const binary = atob(item.base64);
      dataTransfer.items.add(new File([Uint8Array.from(binary, (char) => char.charCodeAt(0))], item.name, { type: "application/pdf" }));
    }
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
  }, [{ base64: first, name: "one.pdf" }, { base64: first, name: "two.pdf" }]);
  await expect(section.getByRole("alert")).toContainText("Select one file at a time here");
  await expect(section).not.toContainText("Detected as PDF");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
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

  await page.goto("/tools/merge-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "wrong.png",
    mimeType: "image/png",
    buffer: readFileSync(fixtures.onePage),
  });
  await expect(page.getByRole("alert").filter({ hasText: "accepts .pdf" })).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "accepts .pdf" })).toHaveCount(0);

  await page.goto("/tools/split-pdf");
  await page.locator('input[type="file"]').setInputFiles(fixtures.twoPage);
  await page.locator("#folio-pages").fill("1");
  const recovered = await downloadFromResult(page, "Extract pages", /^Download /);
  await expectPdf(recovered, 1);

  await page.goto("/tools/merge-pdf");
  await page.locator('input[type="file"]').setInputFiles([fixtures.onePage, fixtures.secondPage]);
  await page.getByRole("button", { name: "Merge PDFs" }).dblclick();
  const resultLinks = page.getByRole("link", { name: /^Download / });
  await expect(resultLinks).toHaveCount(1);
  const doubleClickResult = await downloadFromLink(page, resultLinks.first());
  await expectPdf(doubleClickResult, 2);

  await page.goto("/");
  await page.locator('section[aria-labelledby="universal-drop-heading"] input[type="file"]').setInputFiles(fixtures.pages);
  await expect(page.locator('section[aria-labelledby="universal-drop-heading"]')).toContainText("Apple Pages document");

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

test("all seven tools recover from empty, wrong-extension and malformed files", async ({ page }) => {
  const cases = [
    { route: "merge-pdf", action: "Merge PDFs", malformed: [fixtures.corruptPdf, fixtures.corruptPdf], wrongSource: fixtures.corruptPdf, valid: [fixtures.onePage, fixtures.secondPage] },
    { route: "split-pdf", action: "Extract pages", malformed: fixtures.corruptPdf, wrongSource: fixtures.corruptPdf, valid: fixtures.twoPage },
    { route: "rotate-pdf", action: "Rotate PDF", malformed: fixtures.corruptPdf, wrongSource: fixtures.corruptPdf, valid: fixtures.twoPage },
    { route: "compress-pdf", action: "Compress PDF", malformed: fixtures.corruptPdf, wrongSource: fixtures.corruptPdf, valid: fixtures.twoPage },
    { route: "pdf-to-jpg", action: "Convert to JPG", malformed: fixtures.corruptPdf, wrongSource: fixtures.corruptPdf, valid: fixtures.twoPage },
    { route: "images-to-pdf", action: "Create PDF", malformed: fixtures.corruptImage, wrongSource: fixtures.corruptImage, valid: fixtures.image },
    { route: "docx-to-pdf", action: "Convert to PDF", malformed: fixtures.corruptDocx, wrongSource: fixtures.corruptDocx, valid: fixtures.docx },
  ];

  for (const item of cases) {
    await page.goto(`/tools/${item.route}`);
    const input = page.locator('input[type="file"]');
    const emptyExtension = item.route === "images-to-pdf" ? "png" : item.route === "docx-to-pdf" ? "docx" : "pdf";
    await input.setInputFiles({ name: `empty.${emptyExtension}`, mimeType: "application/octet-stream", buffer: Buffer.alloc(0) });
    await expect(page.locator('div[role="alert"]').filter({ hasText: "0 bytes" })).toBeVisible();
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(page.locator('div[role="alert"]').filter({ hasText: "0 bytes" })).toHaveCount(0);

    await input.setInputFiles({ name: "wrong-extension.bin", mimeType: "application/octet-stream", buffer: readFileSync(item.wrongSource) });
    await expect(page.locator('div[role="alert"]').filter({ hasText: "accepts" })).toBeVisible();
    await page.getByRole("button", { name: "Start over" }).click();

    await input.setInputFiles(item.malformed);
    if (item.route === "split-pdf") await page.locator("#folio-pages").fill("1");
    await page.getByRole("button", { name: item.action }).click();
    await expect(page.locator('div[role="alert"]').filter({ hasText: /Could not read|image|DOCX|file/i })).toBeVisible();
    await page.getByRole("button", { name: "Start over" }).click();
    await input.setInputFiles(item.valid);
    if (item.route === "split-pdf") await page.locator("#folio-pages").fill("1-2");
    if (item.route === "pdf-to-jpg") {
      await page.getByRole("button", { name: item.action }).click();
      await expect(page.getByRole("status").filter({ hasText: "Rendered 2 pages" })).toBeVisible();
    } else {
      const output = await downloadFromResult(page, item.action, /^Download /);
      const expectedPages = ["merge-pdf", "split-pdf", "rotate-pdf", "compress-pdf"].includes(item.route) ? 2 : 1;
      await expectPdf(output, expectedPages);
    }
  }
});

test("merge keeps drag-and-drop order and survives a retry", async ({ page }) => {
  const first = readFileSync(fixtures.onePage).toString("base64");
  const second = readFileSync(fixtures.secondPage).toString("base64");
  await page.goto("/tools/merge-pdf");
  const dropzone = page.getByRole("button", { name: /Drop files here or press Enter/i });
  await dropzone.evaluate((element, payload) => {
    const dataTransfer = new DataTransfer();
    for (const file of payload) {
      const binary = atob(file.base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      dataTransfer.items.add(new File([bytes.buffer], file.name, { type: "application/pdf" }));
    }
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
  }, [
    { base64: first, name: "drag-first.pdf" },
    { base64: second, name: "drag-second.pdf" },
  ]);
  await expect(page.getByRole("list", { name: "Selected files" }).locator("li").nth(0)).toContainText("drag-first.pdf");
  await page.getByRole("button", { name: "Move drag-second.pdf up" }).click();
  await expect(page.getByRole("list", { name: "Selected files" }).locator("li").nth(0)).toContainText("drag-second.pdf");
  await page.getByRole("button", { name: "Merge PDFs" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Done" })).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await page.locator('input[type="file"]').setInputFiles([fixtures.onePage, fixtures.onePage]);
  const retried = await downloadFromResult(page, "Merge PDFs", /^Download /);
  await expectPdf(retried, 2);
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

async function makePages(previewBytes) {
  return await makeAppleContainer("com.apple.iWork.Pages", previewBytes);
}

async function makeAppleContainer(marker, previewBytes) {
  return await makeZip({
    "Index/Document.iwa": "binary iWork fixture",
    "Metadata/Properties.plist": marker,
    "QuickLook/Preview.pdf": previewBytes,
  });
}

async function makeZip(entries) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
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

async function expectPdf(bytes, expectedPages) {
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(100);
  const pdf = await PDFDocument.load(bytes);
  if (expectedPages !== undefined) expect(pdf.getPageCount()).toBe(expectedPages);
}

async function expectJpeg(page, bytes) {
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1]).toBe(0xd8);
  expect(bytes[2]).toBe(0xff);
  const dimensions = await page.evaluate((base64) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Generated JPEG could not be decoded."));
    image.src = `data:image/jpeg;base64,${base64}`;
  }), bytes.toString("base64"));
  expect(dimensions.width).toBeGreaterThan(0);
  expect(dimensions.height).toBeGreaterThan(0);
}
