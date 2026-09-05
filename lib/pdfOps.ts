/**
 * Client-side document operations.
 *
 * Everything here runs in the browser: files are read with File APIs and
 * processed with pdf-lib / pdf.js / mammoth / jsPDF. Nothing is uploaded.
 * Heavy libraries are dynamically imported so the homepage stays light.
 */

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
    const bytes = new Uint8Array(await file.arrayBuffer());
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
  const bytes = new Uint8Array(await file.arrayBuffer());
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
  const bytes = new Uint8Array(await file.arrayBuffer());
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
  const bytes = new Uint8Array(await file.arrayBuffer());
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
    const raw = new Uint8Array(await file.arrayBuffer());
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
        const buf = new Uint8Array(await blob.arrayBuffer());
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

  const data = new Uint8Array(await file.arrayBuffer());
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
  await pdf.destroy();
  return out;
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

  const buffer = await file.arrayBuffer();
  let html: string;
  try {
    const result = await convertToHtml({ arrayBuffer: buffer });
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
    `<div class="folio-docx" style="width:794px;background:#fff;color:#111;` +
    `font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;` +
    `padding:48px 56px;word-wrap:break-word;">${safeHtml}</div>` +
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
