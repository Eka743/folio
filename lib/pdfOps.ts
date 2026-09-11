/**
 * Client-side document operations.
 *
 * Everything here runs in the browser: files are read with File APIs and
 * processed with pdf-lib / pdf.js / mammoth / jsPDF. Nothing is uploaded.
 * Heavy libraries are dynamically imported so the homepage stays light.
 */

import { readFileBytes } from "./files";
import {
  decodeMarkdown,
  markdownToHtml,
  MAX_MARKDOWN_BYTES,
} from "./markdown";

export async function getPdfPageCount(data: Uint8Array): Promise<number> {
  const doc = await loadPdfDocument(data);
  return doc.getPageCount();
}

/**
 * Load a PDF with human-readable errors. pdf-lib throws low-level parser
 * messages ("Invalid PDF structure") for corrupt files; surface guidance
 * users can act on instead.
 */
export async function loadPdfDocument(
  data: Uint8Array,
): Promise<import("pdf-lib").PDFDocument> {
  const { PDFDocument } = await import("pdf-lib");
  try {
    return await PDFDocument.load(data, { ignoreEncryption: true });
  } catch {
    throw new Error(
      "Could not read this PDF — the file may be corrupted, password-protected, or not a valid PDF.",
    );
  }
}

/**
 * Strip dangerous constructs from mammoth HTML before injecting it into
 * the layout host. Content tags (p/h1-h6/ul/ol/table/img/a/strong/em)
 * are preserved; scripts, frames, forms, event handlers and
 * javascript:/data:text/html URLs are removed.
 */
export function sanitizeMammothHtml(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<\/?(iframe|frame|frameset|object|embed|form|input|button|select|textarea|meta|link|base)\b[^>]*>/gi, "");
  // Strip event-handler attributes (onclick=, onerror=, …).
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Neutralize javascript: and data:text/html URLs in href/src/action.
  out = out.replace(
    /\s(href|src|xlink:href|action)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (match, attr: string, _q: string, d: string, s: string, u: string) => {
      const raw = (d ?? s ?? u ?? "").trim().toLowerCase();
      if (
        raw.startsWith("javascript:") ||
        raw.startsWith("data:text/html") ||
        raw.startsWith("vbscript:")
      ) {
        return ` ${attr}="#"`;
      }
      return match;
    },
  );
  return out;
}

export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const file of files) {
    const bytes = await readFileBytes(file);
    const src = await loadPdfDocument(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return out.save({ useObjectStreams: true });
}

export async function splitPdf(
  file: File,
  keepPages1Based: number[],
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await readFileBytes(file);
  const src = await loadPdfDocument(bytes);
  const out = await PDFDocument.create();
  const indices = [...new Set(keepPages1Based.map((p) => p - 1))]
    .filter((i) => i >= 0 && i < src.getPageCount())
    .sort((a, b) => a - b);
  if (indices.length === 0) throw new Error("No valid pages selected.");
  const pages = await out.copyPages(src, indices);
  for (const p of pages) out.addPage(p);
  return out.save({ useObjectStreams: true });
}

export type RotationDegrees = 90 | 180 | 270;

/** Rotate `pages1Based` (or every page when null) clockwise. */
export async function rotatePdf(
  file: File,
  pages1Based: number[] | null,
  degrees: RotationDegrees,
): Promise<Uint8Array> {
  const { degrees: toDegrees } = await import("pdf-lib");
  const bytes = await readFileBytes(file);
  const doc = await loadPdfDocument(bytes);
  const count = doc.getPageCount();
  const targets =
    pages1Based === null
      ? Array.from({ length: count }, (_, i) => i)
      : [...new Set(pages1Based.map((p) => p - 1))].filter(
          (i) => i >= 0 && i < count,
        );
  if (targets.length === 0) throw new Error("No valid pages selected.");
  for (const i of targets) {
    const page = doc.getPage(i);
    const current = page.getRotation().angle;
    page.setRotation(toDegrees((current + degrees) % 360));
  }
  return doc.save({ useObjectStreams: true });
}

export interface OptimizeResult {
  bytes: Uint8Array;
  beforeBytes: number;
  afterBytes: number;
}

/**
 * Honest "compression": rewrite the PDF with object streams and drop
 * redundant metadata. This only helps files that were never optimized;
 * already-optimized PDFs may barely change, and the UI must say so.
 */
export async function optimizePdf(file: File): Promise<OptimizeResult> {
  const beforeBytes = file.size;
  const bytes = await readFileBytes(file);
  const doc = await loadPdfDocument(bytes);
  doc.setProducer("Folio");
  doc.setCreator("Folio (local processing)");
  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });
  return { bytes: out, beforeBytes, afterBytes: out.length };
}

async function imageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      const dims = { width: bmp.width, height: bmp.height };
      bmp.close();
      if (dims.width > 0 && dims.height > 0) return dims;
    } catch {
      // fall through to <img> fallback
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const dims = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error(`Could not read ${file.name}.`));
        img.src = url;
      },
    );
    if (!dims.width || !dims.height)
      throw new Error(`Could not read ${file.name}.`);
    return dims;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** One image per page, fitted onto A4 without distortion. */
export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const A4 = { w: 595.28, h: 841.89 }; // points
  const margin = 24;

  for (const file of files) {
    const raw = await readFileBytes(file);
    const isPng =
      file.type === "image/png" || /\.png$/i.test(file.name);
    let embedded;
    try {
      embedded = isPng
        ? await doc.embedPng(raw)
        : await doc.embedJpg(raw);
    } catch {
      // Fall back: re-encode through canvas (also strips odd metadata).
      const url = URL.createObjectURL(file);
      try {
        const bmp = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable.");
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        const blob = await new Promise<Blob | null>((res) =>
          canvas.toBlob(res, "image/jpeg", 0.92),
        );
        if (!blob) throw new Error(`Could not read ${file.name}.`);
        const buf = await readFileBytes(blob);
        embedded = await doc.embedJpg(buf);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    const dims = await imageDimensions(file).catch(() => ({
      width: embedded.width,
      height: embedded.height,
    }));
    const landscape = dims.width > dims.height;
    const pageW = landscape ? A4.h : A4.w;
    const pageH = landscape ? A4.w : A4.h;
    const page = doc.addPage([pageW, pageH]);

    const scale = Math.min(
      (pageW - margin * 2) / embedded.width,
      (pageH - margin * 2) / embedded.height,
    );
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    page.drawImage(embedded, {
      x: (pageW - w) / 2,
      y: (pageH - h) / 2,
      width: w,
      height: h,
    });
  }

  if (doc.getPageCount() === 0) throw new Error("No images to convert.");
  return doc.save({ useObjectStreams: true });
}

export interface RenderedPage {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
}

const PDF_WORKER_SRC = "/pdf.worker.min.mjs";

export async function renderPdfPages(
  file: File,
  opts: { scale?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<RenderedPage[]> {
  const pdfjs = await import("pdfjs-dist");
  // Self-hosted worker: same-origin, no third-party CDN at runtime.
  // Document bytes never leave the browser.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  }

  const data = await readFileBytes(file);
  let pdf;
  try {
    const loading = pdfjs.getDocument({ data });
    pdf = await loading.promise;
  } catch {
    throw new Error(
      "Could not read this PDF — the file may be corrupted, password-protected, or not a valid PDF.",
    );
  }
  const out: RenderedPage[] = [];
  const scale = opts.scale ?? 2;
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable in this browser.");
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error(`Could not render page ${n}.`);
      out.push({ pageNumber: n, blob, width: canvas.width, height: canvas.height });
      opts.onProgress?.(n, pdf.numPages);
      page.cleanup();
    }
    return out;
  } finally {
    await pdf.destroy();
  }
}

const MAX_PDF_MARKDOWN_PAGES = 300;
const MAX_PDF_MARKDOWN_BYTES = 5 * 1024 * 1024;
const MAX_MARKDOWN_PDF_PAGES = 100;

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

type PdfTextLine = {
  text: string;
  y: number;
  fontSize: number;
  x: number;
  gapAbove: number;
};

function median(values: number[]): number {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return 12;
  return sorted[Math.floor(sorted.length / 2)];
}

function joinPdfItems(items: PdfTextItem[]): string {
  const positioned = items
    .map((item) => {
      const transform = item.transform ?? [];
      return {
        item,
        x: Number(transform[4] ?? 0),
        width: Number(item.width ?? 0),
      };
    })
    .sort((a, b) => a.x - b.x);
  let text = "";
  let previousEnd = 0;
  for (const { item, x, width } of positioned) {
    const value = (item.str ?? "").replace(/\s+/g, " ").trim();
    if (!value) continue;
    const gap = x - previousEnd;
    const needsSpace = text.length > 0 && gap > 1.5 && !/^[,.;:!?%)]/.test(value) && !/[([{/]$/.test(text);
    if (needsSpace) text += " ";
    text += value;
    previousEnd = Math.max(previousEnd, x + width);
  }
  return text.trim();
}

function pdfTextLines(items: PdfTextItem[]): PdfTextLine[] {
  const placed = items
    .filter((item) => (item.str ?? "").trim().length > 0)
    .map((item) => {
      const transform = item.transform ?? [];
      return {
        item,
        x: Number(transform[4] ?? 0),
        y: Number(transform[5] ?? 0),
        fontSize: Math.max(1, Math.abs(Number(transform[3] ?? transform[0] ?? item.height ?? 12))),
      };
    })
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: Array<{ y: number; items: PdfTextItem[]; x: number; fontSize: number }> = [];
  for (const item of placed) {
    const tolerance = Math.max(2, item.fontSize * 0.35);
    const group = groups.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (group) {
      group.items.push(item.item);
      group.x = Math.min(group.x, item.x);
      group.fontSize = Math.max(group.fontSize, item.fontSize);
    } else {
      groups.push({ y: item.y, items: [item.item], x: item.x, fontSize: item.fontSize });
    }
  }
  const lines = groups
    .map((group) => ({
      text: joinPdfItems(group.items),
      y: group.y,
      fontSize: group.fontSize,
      x: group.x,
      gapAbove: 0,
    }))
    .filter((line) => line.text.length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  for (let index = 1; index < lines.length; index++) {
    lines[index].gapAbove = Math.max(0, lines[index - 1].y - lines[index].y);
  }
  return lines;
}

function safeExtractedLink(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const value = url.trim();
  return /^(?:https?:|mailto:)/i.test(value) ? value : null;
}

function appendRecoveredLinks(
  text: string,
  y: number,
  annotations: Array<{ url?: unknown; rect?: number[] }>,
): string {
  const urls = annotations
    .filter((annotation) => {
      const rect = annotation.rect ?? [];
      return rect.length >= 4 && y >= Math.min(rect[1], rect[3]) - 4 && y <= Math.max(rect[1], rect[3]) + 4;
    })
    .map((annotation) => safeExtractedLink(annotation.url))
    .filter((url): url is string => Boolean(url));
  const unique = [...new Set(urls)];
  if (unique.length === 0) return text;
  return `${text} ${unique.map((url) => `[link](${url})`).join(" ")}`;
}

function pageTextToMarkdown(
  items: PdfTextItem[],
  annotations: Array<{ url?: unknown; rect?: number[] }>,
): string {
  const lines = pdfTextLines(items);
  const bodySize = median(lines.map((line) => line.fontSize));
  const output: string[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) output.push(paragraph.join(" ").trim());
    paragraph = [];
  };

  for (const line of lines) {
    const text = appendRecoveredLinks(line.text, line.y, annotations);
    const isHeading = line.text.length <= 120 &&
      line.fontSize >= Math.max(14, bodySize * 1.4) &&
      !/[.!?:;]$/.test(line.text) &&
      !/^(?:[-*+•●◦▪‣]|\d+[.)])\s+/.test(line.text);
    if (isHeading) {
      flushParagraph();
      const level = line.fontSize >= bodySize * 1.8 ? 1 : line.fontSize >= bodySize * 1.55 ? 2 : 3;
      output.push(`${"#".repeat(level)} ${text}`);
      continue;
    }

    const bullet = /^(?:[-*+]|[•●◦▪‣])\s+(.+)$/.exec(text);
    const ordered = /^(\d+)[.)]\s+(.+)$/.exec(text);
    if (bullet || ordered) {
      flushParagraph();
      output.push(ordered ? `${ordered[1]}. ${ordered[2]}` : `- ${bullet![1]}`);
      continue;
    }

    const paragraphGap = line.gapAbove > Math.max(bodySize * 1.9, 18);
    if (paragraphGap) flushParagraph();
    paragraph.push(text);
  }
  flushParagraph();
  return output.join("\n").trim();
}

/** Extract readable, conservative Markdown from a text-based PDF locally. */
export async function pdfToMarkdown(
  file: File,
  onProgress?: (stage: string) => void,
): Promise<string> {
  onProgress?.("Reading PDF text…");
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  const data = await readFileBytes(file);
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data }).promise;
  } catch {
    throw new Error("Could not read this PDF — the file may be corrupted, password-protected, or not a valid PDF.");
  }
  if (pdf.numPages > MAX_PDF_MARKDOWN_PAGES) {
    await pdf.destroy();
    throw new Error(`This PDF has more than ${MAX_PDF_MARKDOWN_PAGES} pages, so text extraction is stopped safely.`);
  }
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      onProgress?.(`Extracting page ${pageNumber} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: false });
      let annotations: Array<{ url?: unknown; rect?: number[] }> = [];
      try {
        annotations = await page.getAnnotations({ intent: "display" });
      } catch {
        // Annotation support varies by PDF. Text extraction remains useful.
      }
      const markdown = pageTextToMarkdown(content.items as PdfTextItem[], annotations);
      if (markdown) pages.push(markdown);
      page.cleanup();
      if (pages.join("\n\n").length > MAX_PDF_MARKDOWN_BYTES) {
        throw new Error("This PDF contains more extractable text than Folio can safely prepare in one download.");
      }
    }
  } finally {
    await pdf.destroy();
  }
  const result = pages.join("\n\n").trim();
  if (!result) {
    throw new Error("This PDF appears to contain scanned pages or images. Text extraction is not available for this file yet.");
  }
  return `${result}\n`;
}

function markdownPageStyles(): string {
  return `<style>
    .folio-markdown{box-sizing:border-box;width:100%;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#101418;font-size:15px;line-height:1.55;overflow-wrap:anywhere}
    .folio-markdown h1{font-size:30px;line-height:1.15;letter-spacing:-.025em;margin:0 0 18px;font-weight:750}
    .folio-markdown h2{font-size:23px;line-height:1.2;letter-spacing:-.02em;margin:22px 0 10px;font-weight:700}
    .folio-markdown h3{font-size:19px;line-height:1.25;margin:18px 0 8px;font-weight:700}
    .folio-markdown h4,.folio-markdown h5,.folio-markdown h6{font-size:16px;line-height:1.3;margin:15px 0 7px;font-weight:700}
    .folio-markdown p{margin:0 0 12px;white-space:pre-wrap}
    .folio-markdown strong{font-weight:750}.folio-markdown em{font-style:italic}
    .folio-markdown a{color:#1d4ed8;text-decoration:underline}.folio-markdown code{border-radius:5px;background:#eef2f7;padding:1px 4px;font-family:"SFMono-Regular",Menlo,monospace;font-size:.88em}
    .folio-markdown pre{box-sizing:border-box;margin:14px 0;padding:13px 15px;border-radius:10px;background:#17212b;color:#f5f7fa;white-space:pre-wrap;overflow-wrap:anywhere;font:12.5px/1.5 "SFMono-Regular",Menlo,monospace}
    .folio-markdown pre code{padding:0;background:transparent;color:inherit;font-size:inherit}
    .folio-markdown ul,.folio-markdown ol{margin:0 0 13px;padding-left:25px}.folio-markdown li{margin:4px 0}.folio-markdown li.folio-md-level-1{margin-left:18px}.folio-markdown li.folio-md-level-2{margin-left:36px}.folio-markdown li.folio-md-level-3{margin-left:54px}
    .folio-markdown blockquote{margin:14px 0;padding:9px 15px;border-left:4px solid #93c5fd;background:#eff6ff;color:#334155}
    .folio-markdown hr{border:0;border-top:1px solid #cbd5e1;margin:20px 0}.folio-markdown-table-wrap{width:100%;overflow:hidden}
    .folio-md-table-wrap{width:100%;overflow:hidden}.folio-markdown table{width:100%;table-layout:fixed;border-collapse:collapse;margin:14px 0;font-size:13px}.folio-markdown th,.folio-markdown td{border:1px solid #cbd5e1;padding:7px 8px;text-align:left;overflow-wrap:anywhere;vertical-align:top}.folio-markdown th{background:#f1f5f9;font-weight:700}
    .folio-md-image{display:block;max-width:100%;max-height:230px;margin:12px auto;object-fit:contain}.folio-md-image-note{display:inline-block;border:1px dashed #94a3b8;border-radius:7px;padding:5px 8px;color:#64748b;font-size:12px}
  </style>`;
}

async function renderMarkdownPagesToPdf(
  html: string,
  onProgress?: (stage: string) => void,
): Promise<Uint8Array> {
  const [{ jsPDF }, html2canvas] = await Promise.all([
    import("jspdf"),
    import("html2canvas").then((module) => module.default),
  ]);
  const source = document.createElement("div");
  source.style.cssText = "position:fixed;left:-20000px;top:0;width:794px;visibility:hidden;";
  source.innerHTML = `${markdownPageStyles()}<div class="folio-markdown">${html}</div>`;
  document.body.appendChild(source);
  const pages: HTMLDivElement[] = [];
  const content = source.querySelector<HTMLDivElement>(".folio-markdown");
  if (!content) {
    source.remove();
    throw new Error("Could not lay out this Markdown file.");
  }
  try {
    const blocks = [...content.children] as HTMLElement[];
    const newPage = () => {
      const page = document.createElement("div");
      page.style.cssText = "box-sizing:border-box;width:794px;height:1123px;padding:58px 64px;background:#fff;overflow:hidden;position:fixed;left:-10000px;top:0;visibility:visible;";
      page.className = "folio-markdown folio-markdown-page";
      return page;
    };
    let page = newPage();
    source.appendChild(page);
    for (const block of blocks) {
      if (block.tagName === "PRE" && (block.textContent?.split("\n").length ?? 0) > 200) {
        throw new Error("A Markdown block is too large to fit safely on a PDF page. Shorten it and try again.");
      }
      const copy = block.cloneNode(true) as HTMLElement;
      page.appendChild(copy);
      if (page.scrollHeight > page.clientHeight + 2 && page.children.length > 1) {
        page.removeChild(copy);
        pages.push(page);
        if (pages.length >= MAX_MARKDOWN_PDF_PAGES) {
          throw new Error(`This Markdown file would create more than ${MAX_MARKDOWN_PDF_PAGES} PDF pages.`);
        }
        page = newPage();
        source.appendChild(page);
        page.appendChild(copy);
      } else if (page.scrollHeight > page.clientHeight + 2) {
        throw new Error("A Markdown block is too large to fit safely on a PDF page. Shorten it and try again.");
      }
    }
    if (page.children.length > 0) {
      pages.push(page);
      if (pages.length > MAX_MARKDOWN_PDF_PAGES) {
        throw new Error(`This Markdown file would create more than ${MAX_MARKDOWN_PDF_PAGES} PDF pages.`);
      }
    }
    if (pages.length === 0) {
      throw new Error("No readable content found in this Markdown file.");
    }

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    for (let index = 0; index < pages.length; index++) {
      onProgress?.(`Rendering page ${index + 1} of ${pages.length}…`);
      const images = [...pages[index].querySelectorAll("img")];
      await Promise.all(images.map((image) => image.decode?.().catch(() => undefined)));
      const canvas = await html2canvas(pages[index], { scale: 2, backgroundColor: "#ffffff", useCORS: false, logging: false });
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`${index + 1} / ${pages.length}`, 195, 290, { align: "right" });
    }
    const output = new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer);
    const parsed = await loadPdfDocument(output);
    if (parsed.getPageCount() < 1) throw new Error("Folio could not create a readable PDF.");
    return output;
  } finally {
    source.remove();
  }
}

/** Render safe Markdown into a styled, multi-page A4 PDF in the browser. */
export async function markdownToPdf(
  file: File,
  onProgress?: (stage: string) => void,
): Promise<Uint8Array> {
  if (file.size > MAX_MARKDOWN_BYTES) {
    throw new Error("This Markdown file is larger than Folio’s 10 MB local limit.");
  }
  const markdown = decodeMarkdown(await readFileBytes(file));
  onProgress?.("Preparing Markdown layout…");
  const html = markdownToHtml(markdown);
  return renderMarkdownPagesToPdf(html, onProgress);
}

/**
 * DOCX -> PDF via formatted HTML rendering.
 *
 * Pipeline: mammoth converts .docx to semantic HTML (headings, bold/italic,
 * lists, tables, images as data URLs), which is rendered with print-like
 * CSS and rasterized per A4 page into a jsPDF document.
 *
 * Honest limits: pagination, fonts and advanced Word features (headers,
 * footers, footnotes, text boxes, change tracking) will differ from Word.
 */
export async function docxToPdf(
  file: File,
  onProgress?: (stage: string) => void,
): Promise<Uint8Array> {
  onProgress?.("Reading document…");
  const [{ convertToHtml }, { jsPDF }, html2canvas] = await Promise.all([
    import("mammoth"),
    import("jspdf"),
    import("html2canvas").then((m) => m.default),
  ]);

  const buffer = await readFileBytes(file);
  const arrayBuffer = buffer.buffer as ArrayBuffer;
  let html: string;
  try {
    const result = await convertToHtml({ arrayBuffer });
    html = result.value;
  } catch {
    throw new Error(
      "Could not read this Word document — the file may be corrupted or not a valid .docx file.",
    );
  }
  if (!html || html.trim().length === 0) {
    throw new Error("No readable content found in this document.");
  }
  const safeHtml = sanitizeMammothHtml(html);

  onProgress?.("Laying out pages…");
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;background:#fff;";
  host.innerHTML =
    `<div class="folio-docx" style="box-sizing:border-box;width:794px;background:#fff;color:#111;` +
    `font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;` +
    `padding:48px 56px;word-wrap:break-word;overflow-wrap:anywhere;">${safeHtml}</div>` +
    `<style>
      .folio-docx h1{font-size:28px;line-height:1.25;margin:0 0 12px;font-family:Inter,system-ui,sans-serif;font-weight:700}
      .folio-docx h2{font-size:22px;margin:22px 0 8px;font-family:Inter,system-ui,sans-serif;font-weight:700}
      .folio-docx h3{font-size:18px;margin:18px 0 8px;font-family:Inter,system-ui,sans-serif;font-weight:600}
      .folio-docx p{margin:0 0 10px}
      .folio-docx ul,.folio-docx ol{margin:0 0 12px;padding-left:28px}
      .folio-docx li{margin-bottom:4px}
      .folio-docx table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px}
      .folio-docx th,.folio-docx td{border:1px solid #999;padding:6px 8px;text-align:left}
      .folio-docx img{max-width:100%;height:auto}
      .folio-docx tr,.folio-docx img{break-inside:avoid}
      .folio-docx a{color:#1d4ed8;text-decoration:underline}
    </style>`;
  document.body.appendChild(host);

  try {
    const content = host.querySelector<HTMLElement>(".folio-docx");
    if (!content) throw new Error("Could not lay out this document.");
    // Let images finish decoding before rasterizing.
    const imgs = [...content.querySelectorAll("img")];
    await Promise.all(
      imgs.map((img) =>
        img.decode
          ? img.decode().catch(() => undefined)
          : new Promise<void>((res) => {
              if (img.complete) res();
              else {
                img.onload = () => res();
                img.onerror = () => res();
              }
            }),
      ),
    );

    onProgress?.("Rendering PDF…");
    const canvas = await html2canvas(content, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: false,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWmm = 210;
    const pageHmm = 297;
    const renderedWmm = pageWmm;
    const renderedHmm = (canvas.height / canvas.width) * renderedWmm;
    const totalPages = Math.max(1, Math.ceil(renderedHmm / pageHmm));

    for (let i = 0; i < totalPages; i++) {
      const srcY = Math.floor((i * canvas.height) / totalPages);
      const srcH = Math.floor(canvas.height / totalPages);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = srcH;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable in this browser.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      const url = slice.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage();
      // Last slice may be shorter; anchor slices to the page top.
      const sliceHmm = (srcH / canvas.width) * renderedWmm;
      pdf.addImage(url, "JPEG", 0, 0, renderedWmm, Math.min(sliceHmm, pageHmm));
      onProgress?.(`Rendering page ${i + 1} of ${totalPages}…`);
    }

    const buf = pdf.output("arraybuffer") as ArrayBuffer;
    return new Uint8Array(buf);
  } finally {
    host.remove();
  }
}
