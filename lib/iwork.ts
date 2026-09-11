import { readFileBytes } from "./files";
import { loadPdfDocument } from "./pdfOps";
import { inspectZip, readZipEntry } from "./safeArchive";
import type {
  IworkDocument,
  IworkScene,
  IworkTable,
  IworkTextBlock,
  IworkVisualObject,
} from "@file-viewer/renderer-iwork";

export type AppleKind = "pages" | "keynote" | "numbers";

const APPLE_PARSE_LIMITS = {
  maxUncompressedBytes: 100 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxObjects: 250_000,
  maxImagePixels: 80_000_000,
  maxNestingDepth: 128,
};

const MAX_SCENES = 200;
const MAX_ROWS_PER_TABLE = 10_000;
const MAX_COLUMNS_PER_TABLE = 500;
const MAX_OUTPUT_DIMENSION = 4_000;
const MAX_XLSX_OUTPUT_BYTES = 50 * 1024 * 1024;
const PDF_SIGNATURE = "%PDF-";
const IWORK_WORKER_TIMEOUT_MS = 60_000;
let iworkWorkerRequestId = 0;

export class AppleConversionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "AppleConversionError";
  }
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function kindFromFile(file: File): AppleKind {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pages") return "pages";
  if (extension === "key" || extension === "keynote") return "keynote";
  if (extension === "numbers") return "numbers";
  throw new AppleConversionError("Choose a .pages, .key or .numbers file.");
}

function sceneContentCount(scene: IworkScene): number {
  return scene.blocks.length + scene.tables.length + scene.objects.length;
}

function unsupportedDiagnostics(document: IworkDocument): string[] {
  return document.diagnostics.filter((diagnostic) =>
    /failed|skipped|generic|limited|experimental/i.test(diagnostic),
  );
}

class IworkWorkerUnavailableError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "IworkWorkerUnavailableError";
  }
}

function parseIworkInWorker(
  bytes: Uint8Array,
  kind: AppleKind,
): Promise<IworkDocument> {
  if (typeof Worker !== "function") {
    return Promise.reject(new IworkWorkerUnavailableError("Web Workers are unavailable."));
  }

  let worker: Worker;
  try {
    worker = new Worker(
      new URL("@file-viewer/renderer-iwork/worker/iwork.worker.js", import.meta.url),
      { type: "module", name: "folio-iwork" },
    );
  } catch (cause) {
    return Promise.reject(new IworkWorkerUnavailableError("The iWork Worker could not start.", cause));
  }

  const id = ++iworkWorkerRequestId;
  const buffer = asArrayBuffer(bytes);
  return new Promise<IworkDocument>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      worker.terminate();
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.id !== id) return;
      if (event.data.ok && event.data.document) {
        finish(() => resolve(event.data.document as IworkDocument));
        return;
      }
      const details = event.data.error;
      finish(() => reject(new Error(details?.message || "The iWork Worker could not parse this file.")));
    };
    const onError = (event: ErrorEvent) => {
      finish(() => reject(new IworkWorkerUnavailableError("The iWork Worker could not load.", event.error ?? event.message)));
    };
    const timeout = setTimeout(() => {
      finish(() => reject(new IworkWorkerUnavailableError("The iWork Worker timed out.")));
    }, IWORK_WORKER_TIMEOUT_MS);
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    try {
      worker.postMessage({ id, buffer, type: kind, limits: APPLE_PARSE_LIMITS }, [buffer]);
    } catch (cause) {
      finish(() => reject(new IworkWorkerUnavailableError("The iWork Worker could not receive this file.", cause)));
    }
  });
}

async function parseIworkDocumentLocally(
  bytes: Uint8Array,
  kind: AppleKind,
): Promise<IworkDocument> {
  try {
    return await parseIworkInWorker(bytes, kind);
  } catch (cause) {
    if (!(cause instanceof IworkWorkerUnavailableError)) throw cause;
    const { parseIworkDocument } = await import("@file-viewer/renderer-iwork/parser");
    return parseIworkDocument(asArrayBuffer(bytes), kind, APPLE_PARSE_LIMITS);
  }
}

/**
 * Parse a native Apple container only when a user chooses an Apple action.
 * The import remains behind this function so the large parser never enters
 * the initial route or the ordinary PDF/image conversion chunks.
 */
export async function parseAppleDocument(file: File, expectedKind?: AppleKind): Promise<IworkDocument> {
  const kind = expectedKind ?? kindFromFile(file);
  const bytes = await readFileBytes(file);
  try {
    const document = await parseIworkDocumentLocally(bytes, kind);
    if (document.kind !== kind) {
      throw new AppleConversionError("This Apple document type does not match its filename.");
    }
    if (document.limitedPreview) {
      throw new AppleConversionError(
        "Folio could only recover a limited preview from this Apple document. No export was created.",
      );
    }
    if (document.scenes.length === 0 || document.scenes.length > MAX_SCENES) {
      throw new AppleConversionError("This Apple document does not contain a safe, exportable layout.");
    }
    if (document.scenes.every((scene) => sceneContentCount(scene) === 0)) {
      throw new AppleConversionError("This Apple document does not contain supported text, tables or visuals.");
    }
    const diagnostics = unsupportedDiagnostics(document);
    if (diagnostics.length > 0) {
      throw new AppleConversionError(
        "This Apple document contains unsupported or incomplete content. No partial export was created.",
      );
    }
    return document;
  } catch (cause) {
    if (cause instanceof AppleConversionError) throw cause;
    throw new AppleConversionError(
      `Folio couldn’t read this ${kind === "keynote" ? "Keynote" : kind === "numbers" ? "Numbers" : "Pages"} file. Make sure it opens in its Apple app and try again.`,
      cause,
    );
  }
}

function clampDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0
    ? Math.min(MAX_OUTPUT_DIMENSION, Math.max(72, value))
    : fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function color(value: string | undefined, fallback: [number, number, number] = [0.1, 0.12, 0.15]): [number, number, number] {
  if (!value) return fallback;
  const hex = value.trim().match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (hex) {
    const raw = hex[1].length === 3
      ? hex[1].split("").map((digit) => digit + digit).join("")
      : hex[1];
    return [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16) / 255) as [number, number, number];
  }
  const rgb = value.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  return fallback;
}

async function fontFor(pdf: import("pdf-lib").PDFDocument, block: IworkTextBlock) {
  const { StandardFonts } = await import("pdf-lib");
  const bold = block.bold === true;
  const italic = block.italic === true;
  const fontName = bold && italic
    ? StandardFonts.HelveticaBoldOblique
    : bold
      ? StandardFonts.HelveticaBold
      : italic
        ? StandardFonts.HelveticaOblique
        : StandardFonts.Helvetica;
  return pdf.embedFont(fontName);
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

async function drawTextBlock(
  pdf: import("pdf-lib").PDFDocument,
  page: import("pdf-lib").PDFPage,
  sceneHeight: number,
  block: IworkTextBlock,
): Promise<void> {
  const font = await fontFor(pdf, block);
  const size = Math.min(96, Math.max(6, number(block.fontSize, 12)));
  const padding = block.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const x = number(block.x) + number(padding.left);
  const width = Math.max(20, number(block.width, 400) - number(padding.left) - number(padding.right));
  const lineHeight = number(block.lineHeight, size * 1.25);
  const lines = wrapText(block.text, font, size, width);
  const top = sceneHeight - number(block.y) - number(padding.top);
  const [r, g, b] = color(block.color);
  for (const [index, line] of lines.entries()) {
    const lineWidth = font.widthOfTextAtSize(line, size);
    let lineX = x;
    if (block.align === "center") lineX += Math.max(0, (width - lineWidth) / 2);
    if (block.align === "right") lineX += Math.max(0, width - lineWidth);
    const y = top - size - index * lineHeight;
    if (y < -lineHeight || y > sceneHeight + size) continue;
    page.drawText(line, { x: lineX, y, size, font, color: (await import("pdf-lib")).rgb(r, g, b) });
  }
}

function imageData(bytes: Uint8Array, mimeType: string | undefined): { data: Uint8Array; kind: "jpg" | "png" } {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("png")) return { data: bytes, kind: "png" };
  if (mime.includes("jpeg") || mime.includes("jpg")) return { data: bytes, kind: "jpg" };
  throw new AppleConversionError("This Apple document contains an image format Folio cannot export safely.");
}

async function drawTable(
  pdf: import("pdf-lib").PDFDocument,
  page: import("pdf-lib").PDFPage,
  sceneHeight: number,
  table: IworkTable,
): Promise<void> {
  if (table.merges?.length) {
    throw new AppleConversionError("Merged Apple table cells are not in Folio’s supported export subset.");
  }
  const rows = table.rows.slice(0, MAX_ROWS_PER_TABLE);
  const columns = Math.max(0, Math.min(MAX_COLUMNS_PER_TABLE, ...rows.map((row) => row.length)));
  if (!rows.length || !columns) return;
  const totalWidth = number(table.width, columns * 96);
  const widths = table.columnWidths?.length === columns
    ? table.columnWidths
    : Array.from({ length: columns }, () => totalWidth / columns);
  const heights = table.rowHeights?.length === rows.length
    ? table.rowHeights
    : Array.from({ length: rows.length }, () => Math.max(20, number(table.fontSize, 11) * 1.8));
  const font = await pdf.embedFont((await import("pdf-lib")).StandardFonts.Helvetica);
  const size = Math.min(24, Math.max(7, number(table.fontSize, 11)));
  let y = sceneHeight - number(table.y);
  const border = color(table.borderColor, [0.75, 0.77, 0.8]);
  const { rgb } = await import("pdf-lib");
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    let x = number(table.x);
    const rowHeight = Math.max(12, heights[rowIndex] ?? 20);
    for (let columnIndex = 0; columnIndex < columns; columnIndex++) {
      const cellWidth = Math.max(12, widths[columnIndex] ?? 96);
      const header = rowIndex < (table.headerRows ?? 0) || columnIndex < (table.headerColumns ?? 0);
      const fill = header
        ? color(columnIndex < (table.headerColumns ?? 0) ? table.headerColumnBackground : table.headerRowBackground, [0.92, 0.92, 0.92])
        : [1, 1, 1] as [number, number, number];
      page.drawRectangle({ x, y: y - rowHeight, width: cellWidth, height: rowHeight, color: rgb(...fill), borderColor: rgb(...border), borderWidth: 0.5 });
      const cell = String(rows[rowIndex]?.[columnIndex] ?? "");
      const lines = wrapText(cell, font, size, Math.max(8, cellWidth - 8)).slice(0, 4);
      for (const [lineIndex, line] of lines.entries()) {
        page.drawText(line, { x: x + 4, y: y - size - 4 - lineIndex * size * 1.15, size, font, color: rgb(0.1, 0.12, 0.15) });
      }
      x += cellWidth;
    }
    y -= rowHeight;
  }
}

async function drawChart(
  page: import("pdf-lib").PDFPage,
  sceneHeight: number,
  object: IworkVisualObject,
): Promise<void> {
  if (!object.chart || object.chart.series.length === 0) {
    throw new AppleConversionError("This Apple chart has no saved data to export.");
  }
  const { rgb } = await import("pdf-lib");
  const x = number(object.x);
  const y = sceneHeight - number(object.y) - number(object.height, 220);
  const width = Math.max(100, number(object.width, 360));
  const height = Math.max(80, number(object.height, 220));
  page.drawRectangle({ x, y, width, height, borderColor: rgb(0.7, 0.72, 0.76), borderWidth: 0.6 });
  const values = object.chart.series.flatMap((series) => series.values).filter(Number.isFinite);
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));
  const categories = Math.max(1, object.chart.categories.length);
  const step = (width - 24) / categories;
  if (object.chart.type === "line") {
    for (const [seriesIndex, series] of object.chart.series.entries()) {
      for (let index = 1; index < series.values.length; index++) {
        const previous = series.values[index - 1] ?? 0;
        const current = series.values[index] ?? 0;
        page.drawLine({
          start: { x: x + 12 + (index - 1) * step, y: y + 12 + (previous / max) * (height - 28) },
          end: { x: x + 12 + index * step, y: y + 12 + (current / max) * (height - 28) },
          thickness: 1.5,
          color: [rgb(0.1, 0.38, 0.66), rgb(0.15, 0.55, 0.35)][seriesIndex % 2],
        });
      }
    }
  } else {
    const seriesWidth = Math.max(4, (step - 6) / Math.max(1, object.chart.series.length));
    object.chart.series.forEach((series, seriesIndex) => {
      series.values.forEach((value, index) => {
        const barHeight = Math.max(0, (value / max) * (height - 28));
        page.drawRectangle({
          x: x + 12 + index * step + seriesIndex * seriesWidth,
          y: y + 12,
          width: seriesWidth - 1,
          height: barHeight,
          color: [rgb(0.1, 0.38, 0.66), rgb(0.15, 0.55, 0.35)][seriesIndex % 2],
        });
      });
    });
  }
}

async function drawObject(
  pdf: import("pdf-lib").PDFDocument,
  page: import("pdf-lib").PDFPage,
  sceneHeight: number,
  object: IworkVisualObject,
): Promise<void> {
  const { rgb, degrees } = await import("pdf-lib");
  const x = number(object.x);
  const y = sceneHeight - number(object.y) - number(object.height, 20);
  const width = Math.max(1, number(object.width, 40));
  const height = Math.max(1, number(object.height, 20));
  if (object.kind === "chart") {
    await drawChart(page, sceneHeight, object);
    return;
  }
  if (object.kind === "image" || object.kind === "media") {
    if (!object.bytes) throw new AppleConversionError("This Apple document contains media Folio cannot export safely.");
    const encoded = imageData(object.bytes, object.mimeType);
    const image = encoded.kind === "png" ? await pdf.embedPng(encoded.data) : await pdf.embedJpg(encoded.data);
    page.drawImage(image, { x, y, width, height, rotate: degrees(number(object.angle)) });
    return;
  }
  page.drawRectangle({ x, y, width, height, color: rgb(0.94, 0.96, 0.98), borderColor: rgb(0.62, 0.68, 0.74), borderWidth: 0.8, rotate: degrees(number(object.angle)) });
  if (object.text) {
    await drawTextBlock(pdf, page, sceneHeight, { id: object.id, text: object.text, x, y: number(object.y), width, height, fontSize: 12 });
  }
}

async function renderAppleDocumentToPdf(document: IworkDocument): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const scene of document.scenes) {
    const width = clampDimension(scene.width, 595.28);
    const height = clampDimension(scene.height, 841.89);
    const page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
    const items = [
      ...scene.objects.map((object) => ({ zIndex: number(object.zIndex), type: "object" as const, value: object })),
      ...scene.tables.map((table) => ({ zIndex: number(table.zIndex), type: "table" as const, value: table })),
      ...scene.blocks.map((block) => ({ zIndex: number(block.zIndex), type: "block" as const, value: block })),
    ].sort((left, right) => left.zIndex - right.zIndex);
    for (const item of items) {
      if (item.type === "object") {
        if (item.value.kind === "table") continue;
        await drawObject(pdf, page, height, item.value);
      } else if (item.type === "table") {
        await drawTable(pdf, page, height, item.value);
      } else {
        await drawTextBlock(pdf, page, height, item.value);
      }
    }
  }
  const bytes = await pdf.save({ useObjectStreams: true });
  if (bytes.length < PDF_SIGNATURE.length || new TextDecoder().decode(bytes.subarray(0, PDF_SIGNATURE.length)) !== PDF_SIGNATURE) {
    throw new AppleConversionError("Folio could not validate the generated Apple PDF.");
  }
  const checked = await loadPdfDocument(bytes);
  if (checked.getPageCount() !== document.scenes.length) {
    throw new AppleConversionError("Folio could not validate the generated Apple PDF page count.");
  }
  return bytes;
}

export async function appleToPdf(file: File, kind?: AppleKind): Promise<Uint8Array> {
  const document = await parseAppleDocument(file, kind);
  return renderAppleDocumentToPdf(document);
}

function sheetName(name: string, index: number, used: Set<string>): string {
  const base = (name || `Sheet ${index + 1}`).replace(/[\\/*?:\[\]]/g, " ").trim().slice(0, 31) || `Sheet ${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    const ending = ` ${suffix++}`;
    candidate = `${base.slice(0, 31 - ending.length)}${ending}`;
  }
  used.add(candidate);
  return candidate;
}

function xlsxColor(value: string | undefined, fallback = "ECECEC"): { rgb: string } {
  const match = value?.match(/^#?([0-9a-f]{6})$/i);
  return { rgb: (match?.[1] ?? fallback).toUpperCase() };
}

function xlsxCellReference(row: number, column: number): string {
  let value = column + 1;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return `${letters}${row + 1}`;
}

function applyNumbersCellTypes(worksheet: Record<string, unknown>, table: IworkTable): void {
  for (const [rowIndex, row] of table.rows.entries()) {
    for (const [columnIndex, rawValue] of row.entries()) {
      const reference = xlsxCellReference(rowIndex, columnIndex);
      const cell = worksheet[reference] as { v?: unknown; t?: string; f?: string; s?: unknown } | undefined;
      if (!cell) continue;
      const value = String(rawValue ?? "");
      if (/^=/.test(value)) {
        cell.f = value.slice(1);
        cell.v = 0;
        cell.t = "n";
      } else if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
        cell.v = Number(value);
        cell.t = "n";
      }
      if (rowIndex < (table.headerRows ?? 0)) {
        cell.s = {
          font: { bold: true },
          fill: { patternType: "solid", fgColor: xlsxColor(table.headerRowBackground) },
          alignment: { vertical: "center" },
        };
      }
    }
  }
}

export async function numbersToXlsx(file: File): Promise<Uint8Array> {
  const document = await parseAppleDocument(file, "numbers");
  const { read, utils, write } = await import("styled-exceljs");
  const workbook = utils.book_new();
  const usedNames = new Set<string>();
  let tableCount = 0;
  for (const [sceneIndex, scene] of document.scenes.entries()) {
    for (const table of scene.tables) {
      if (!table.rows.length) continue;
      const worksheet = utils.aoa_to_sheet(table.rows.map((row) => row.map((cell) => String(cell ?? ""))));
      if (table.columnWidths?.length) {
        worksheet["!cols"] = table.columnWidths.map((width) => ({ wpx: Math.max(24, Math.min(640, Math.round(width))) }));
      }
      if (table.rowHeights?.length) {
        worksheet["!rows"] = table.rowHeights.map((height) => ({ hpx: Math.max(16, Math.min(240, Math.round(height))) }));
      }
      applyNumbersCellTypes(worksheet, table);
      if (table.merges?.length) {
        worksheet["!merges"] = table.merges.map((merge) => ({
          s: { r: merge.row, c: merge.col },
          e: { r: merge.row + merge.rowspan - 1, c: merge.col + merge.colspan - 1 },
        }));
      }
      const name = sheetName(scene.name, sceneIndex + tableCount, usedNames);
      utils.book_append_sheet(workbook, worksheet, name);
      tableCount++;
    }
  }
  if (tableCount === 0) throw new AppleConversionError("This Numbers file has no exportable tables.");
  const output = write(workbook, { bookType: "xlsx", type: "array", compression: true, cellStyles: true });
  const bytes = output instanceof ArrayBuffer
    ? new Uint8Array(output)
    : new Uint8Array(output as ArrayLike<number>);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  try {
    if (copy.length === 0 || copy.length > MAX_XLSX_OUTPUT_BYTES) throw new Error("XLSX output exceeds the supported safety limit.");
    const archive = inspectZip(copy);
    const paths = new Set(archive.entries.map((entry) => entry.path.toLowerCase()));
    if (!paths.has("[content_types].xml") || !paths.has("xl/workbook.xml")) {
      throw new Error("XLSX package entries are incomplete.");
    }
    await readZipEntry(copy, archive, "xl/workbook.xml");
    const checked = read(copy, { type: "array", cellStyles: true, validateMerges: true });
    if (checked.SheetNames.length !== tableCount || checked.SheetNames.some((name) => !checked.Sheets[name]?.["!ref"])) {
      throw new Error("XLSX output does not contain the expected worksheets and cells.");
    }
    const expectedValues = document.scenes
      .flatMap((scene) => scene.tables.flatMap((table) => table.rows.flatMap((row) => row)))
      .map((value) => String(value ?? ""))
      .filter(Boolean)
      .slice(0, 5);
    const outputText = checked.SheetNames
      .flatMap((name) => utils.sheet_to_json(checked.Sheets[name], { header: 1, raw: false, defval: "", blankrows: true }) as unknown[][])
      .flat()
      .map((value) => String(value ?? ""))
      .join(" ");
    if (expectedValues.some((value) => !outputText.includes(value))) throw new Error("XLSX output is missing source cell values.");
  } catch (cause) {
    throw new AppleConversionError("Folio could not validate the generated Numbers workbook.", cause);
  }
  return copy;
}
