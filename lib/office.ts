/**
 * Local Office conversion support.
 *
 * This module only accepts bounded OOXML packages. It reads the central
 * directory through safeArchive before touching XML, never follows external
 * relationships, never executes macros, and only renders embedded PNG/JPEG
 * media. Parsing is deliberately limited to a declared, useful subset.
 */

import JSZip from "jszip";
import type {
  IworkDocument,
  IworkScene,
  IworkTable,
  IworkTextBlock,
  IworkVisualObject,
} from "@file-viewer/renderer-iwork";
import { readFileBytes } from "./files";
import {
  inspectZip,
  readZipEntry,
  type SafeArchive,
} from "./safeArchive";
import {
  parseSafeXml,
  xmlAttr,
  xmlChild,
  xmlChildren,
  xmlDescendants,
  xmlText,
  type SafeXmlElement,
} from "./safeXml";

export type OfficeKind = "pptx" | "xlsx";

export const MAX_PPTX_BYTES = 50 * 1024 * 1024;
export const MAX_XLSX_BYTES = 50 * 1024 * 1024;
export const MAX_DOCX_OUTPUT_BYTES = 50 * 1024 * 1024;
export const MAX_PPTX_OUTPUT_BYTES = 50 * 1024 * 1024;
export const MAX_OFFICE_XML_BYTES = 16 * 1024 * 1024;
export const MAX_OFFICE_SLIDES = 200;
export const MAX_OFFICE_SHEETS = 100;
export const MAX_OFFICE_ROWS = 20_000;
export const MAX_OFFICE_COLUMNS = 500;
export const MAX_OFFICE_IMAGE_PIXELS = 40_000_000;

const EMU_PER_POINT = 12_700;
const PDF_SIGNATURE = "%PDF-";
const WORD_MAIN = "word/document.xml";
const PPT_MAIN = "ppt/presentation.xml";
const XLS_MAIN = "xl/workbook.xml";

async function loadCheckedPdf(bytes: Uint8Array): Promise<import("pdf-lib").PDFDocument> {
  const { loadPdfDocument } = await import("./pdfOps");
  return loadPdfDocument(bytes);
}

export class OfficeConversionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "OfficeConversionError";
  }
}

export interface OfficeRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: number;
}

export interface OfficeParagraph {
  runs: OfficeRun[];
  bullet?: boolean;
  align?: "left" | "center" | "right";
}

export interface OfficeTextBox {
  kind: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  paragraphs: OfficeParagraph[];
  fill?: string;
  line?: string;
}

export interface OfficeShape {
  kind: "shape";
  shape: "rect" | "ellipse" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  fill?: string;
  line?: string;
}

export interface OfficeImage {
  kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  mimeType: "image/png" | "image/jpeg";
  bytes: Uint8Array;
  crop?: { left: number; top: number; right: number; bottom: number };
}

export interface OfficeTableCell {
  value: string | number | boolean;
  formula?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fill?: string;
  align?: "left" | "center" | "right";
}

export interface OfficeTable {
  kind: "table";
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rows: OfficeTableCell[][];
  columnWidths?: number[];
  rowHeights?: number[];
  merges?: Array<{ row: number; col: number; rowspan: number; colspan: number }>;
}

export type OfficeSlideItem = OfficeTextBox | OfficeShape | OfficeImage | OfficeTable;

export interface OfficeSlide {
  name: string;
  width: number;
  height: number;
  background?: string;
  items: OfficeSlideItem[];
}

export interface ParsedPptx {
  kind: "pptx";
  title: string;
  slides: OfficeSlide[];
  diagnostics: string[];
}

export interface OfficeSheet {
  name: string;
  rows: OfficeTableCell[][];
  columnWidths: number[];
  rowHeights: number[];
  merges: Array<{ row: number; col: number; rowspan: number; colspan: number }>;
}

export interface ParsedXlsx {
  kind: "xlsx";
  title: string;
  sheets: OfficeSheet[];
  diagnostics: string[];
}

type OfficePackage = {
  bytes: Uint8Array;
  archive: SafeArchive;
  paths: Map<string, string>;
  sourceName: string;
};

type OfficeRelationship = {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
  external: boolean;
  resolved?: string;
};

class OfficeWorkerUnavailableError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "OfficeWorkerUnavailableError";
  }
}

let officeWorkerRequestId = 0;

function lowerPath(path: string): string {
  return path.toLowerCase();
}

function fileNameFor(kind: OfficeKind): string {
  return kind === "pptx" ? "PowerPoint" : "Excel";
}

function numeric(value: string | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "on";
}

function emu(value: string | undefined, fallback = 0): number {
  return Math.max(0, numeric(value, fallback * EMU_PER_POINT)) / EMU_PER_POINT;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function colorFromNode(node: SafeXmlElement | undefined): string | undefined {
  if (!node) return undefined;
  const direct = xmlAttr(node, "rgb")?.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(direct ?? "")) return `#${direct}`;
  const srgb = xmlDescendants(node, "srgbClr")[0];
  if (srgb) {
    const value = xmlAttr(srgb, "val")?.replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(value ?? "")) return `#${value}`;
  }
  const sys = xmlDescendants(node, "sysClr")[0];
  const last = xmlAttr(sys, "lastClr")?.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(last ?? "")) return `#${last}`;
  return undefined;
}

function firstDescendant(node: SafeXmlElement, name: string): SafeXmlElement | undefined {
  return xmlDescendants(node, name)[0];
}

function childText(node: SafeXmlElement | undefined, name: string): string {
  return xmlText(xmlChild(node as SafeXmlElement, name)).trim();
}

function extForPath(path: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match?.[1]?.toLowerCase() ?? "";
}

function mimeForImage(path: string): "image/png" | "image/jpeg" {
  const extension = extForPath(path);
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  throw new OfficeConversionError("This Office document contains an image format Folio cannot render safely.");
}

function imageDimensions(bytes: Uint8Array, mimeType: "image/png" | "image/jpeg"): { width: number; height: number } | undefined {
  if (mimeType === "image/png" && bytes.length >= 24 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType !== "image/jpeg" || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) return undefined;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return undefined;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      if (segmentLength < 7) return undefined;
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += segmentLength;
  }
  return undefined;
}

function assertSafeImage(bytes: Uint8Array, mimeType: "image/png" | "image/jpeg"): void {
  const dimensions = imageDimensions(bytes, mimeType);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width * dimensions.height > MAX_OFFICE_IMAGE_PIXELS) {
    throw new OfficeConversionError("This Office document contains an image that is too large or cannot be decoded safely.");
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeAttr(value: string | number): string {
  return escapeXml(String(value));
}

function safeXmlText(bytes: Uint8Array, path: string): string {
  if (bytes.length > MAX_OFFICE_XML_BYTES) {
    throw new OfficeConversionError(`The Office document contains an XML part that is too large: ${path}.`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new OfficeConversionError(`The Office document contains invalid XML: ${path}.`, cause);
  }
}

function relationshipPartFor(sourcePart: string): string {
  const slash = sourcePart.lastIndexOf("/");
  const directory = slash >= 0 ? sourcePart.slice(0, slash + 1) : "";
  const base = slash >= 0 ? sourcePart.slice(slash + 1) : sourcePart;
  return `${directory}_rels/${base}.rels`;
}

function resolveInternalTarget(sourcePart: string, target: string): string {
  const sourceDir = sourcePart.includes("/") ? sourcePart.slice(0, sourcePart.lastIndexOf("/") + 1) : "";
  const parts = [...sourceDir.split("/"), ...target.split("/")].filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      if (resolved.length === 0) throw new OfficeConversionError("The Office document contains a relationship outside its package.");
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  return resolved.join("/");
}

function isExternalTarget(target: string, targetMode?: string): boolean {
  return targetMode?.toLowerCase() === "external" || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target);
}

function readPath(packageData: OfficePackage, path: string): string {
  const actual = packageData.paths.get(lowerPath(path));
  if (!actual) throw new OfficeConversionError(`The Office document is missing ${path}.`);
  return actual;
}

async function readEntry(packageData: OfficePackage, path: string): Promise<Uint8Array> {
  return readZipEntry(packageData.bytes, packageData.archive, readPath(packageData, path));
}

async function readXml(packageData: OfficePackage, path: string): Promise<SafeXmlElement> {
  const bytes = await readEntry(packageData, path);
  try {
    return parseSafeXml(safeXmlText(bytes, path));
  } catch (cause) {
    if (cause instanceof OfficeConversionError) throw cause;
    throw new OfficeConversionError(`The Office document contains malformed XML: ${path}.`, cause);
  }
}

async function loadOfficePackage(file: File, kind: OfficeKind): Promise<OfficePackage> {
  const maxBytes = kind === "pptx" ? MAX_PPTX_BYTES : MAX_XLSX_BYTES;
  if (file.size > maxBytes) {
    throw new OfficeConversionError(`${fileNameFor(kind)} files larger than ${Math.round(maxBytes / 1024 / 1024)} MB are not supported in this browser.`);
  }
  const bytes = await readFileBytes(file);
  let archive: SafeArchive;
  try {
    archive = inspectZip(bytes);
  } catch (cause) {
    throw new OfficeConversionError(`This ${fileNameFor(kind)} file is damaged or exceeds Folio’s safety limits.`, cause);
  }
  const paths = new Map(archive.entries.map((entry) => [lowerPath(entry.path), entry.path]));
  const contentTypes = paths.get("[content_types].xml");
  if (!contentTypes) throw new OfficeConversionError(`This ${fileNameFor(kind)} file is missing its content type manifest.`);
  const manifest = safeXmlText(await readZipEntry(bytes, archive, contentTypes), "[Content_Types].xml");
  if (/<Override\b[^>]*ContentType\s*=\s*["'][^"']*macroEnabled[^"']*["']/i.test(manifest) || /\.(?:docm|pptm|xlsm)$/i.test(file.name) || paths.has("word/vbaproject.bin") || paths.has("ppt/vbaproject.bin") || paths.has("xl/vbaproject.bin")) {
    throw new OfficeConversionError("Macro-enabled Office files are not supported. Save a copy without macros and try again.");
  }
  if (archive.entries.some((entry) => {
    const path = entry.path.toLowerCase();
    return path.includes("/embeddings/") || path.includes("/activex/") || path.endsWith(".bin") || path.endsWith(".exe") || path.endsWith(".js");
  })) {
    throw new OfficeConversionError("This Office document contains embedded executable content that Folio will not run or export.");
  }
  const packageData = { bytes, archive, paths, sourceName: file.name };
  const main = kind === "pptx" ? PPT_MAIN : XLS_MAIN;
  if (!paths.has(lowerPath(main))) throw new OfficeConversionError(`This ${fileNameFor(kind)} file is missing ${main}.`);
  return packageData;
}

async function relationshipsFor(packageData: OfficePackage, sourcePart: string): Promise<Map<string, OfficeRelationship>> {
  const relationships = new Map<string, OfficeRelationship>();
  const relPath = relationshipPartFor(sourcePart);
  const actual = packageData.paths.get(lowerPath(relPath));
  if (!actual) return relationships;
  const root = parseSafeXml(safeXmlText(await readZipEntry(packageData.bytes, packageData.archive, actual), relPath));
  for (const relationship of xmlChildren(root, "Relationship")) {
    const id = xmlAttr(relationship, "Id");
    const target = xmlAttr(relationship, "Target");
    if (!id || !target) throw new OfficeConversionError(`The Office document contains an incomplete relationship in ${relPath}.`);
    const external = isExternalTarget(target, xmlAttr(relationship, "TargetMode"));
    relationships.set(id, {
      id,
      type: xmlAttr(relationship, "Type") ?? "",
      target,
      targetMode: xmlAttr(relationship, "TargetMode"),
      external,
      resolved: external ? undefined : resolveInternalTarget(sourcePart, target.split("#", 1)[0]),
    });
  }
  return relationships;
}

function assertEmbeddedRelationship(rel: OfficeRelationship | undefined, description: string): string {
  if (!rel) throw new OfficeConversionError(`The Office document references a missing ${description}.`);
  if (rel.external || !rel.resolved) {
    throw new OfficeConversionError(`This Office document references external ${description} that Folio will not fetch.`);
  }
  return rel.resolved;
}

function parseTransform(node: SafeXmlElement): { x: number; y: number; width: number; height: number } {
  const xfrm = firstDescendant(node, "xfrm");
  const off = xfrm ? firstDescendant(xfrm, "off") : undefined;
  const ext = xfrm ? firstDescendant(xfrm, "ext") : undefined;
  return {
    x: clamp(emu(xmlAttr(off, "x")), 0, 100_000, 0),
    y: clamp(emu(xmlAttr(off, "y")), 0, 100_000, 0),
    width: clamp(emu(xmlAttr(ext, "cx")), 1, 100_000, 100),
    height: clamp(emu(xmlAttr(ext, "cy")), 1, 100_000, 50),
  };
}

function parseFill(node: SafeXmlElement | undefined): string | undefined {
  return colorFromNode(firstDescendant(node as SafeXmlElement, "solidFill"));
}

function parseLine(node: SafeXmlElement | undefined): string | undefined {
  return colorFromNode(firstDescendant(node as SafeXmlElement, "ln"));
}

function parseRunProperties(node: SafeXmlElement | undefined): OfficeRun {
  const props = node ? firstDescendant(node, "rPr") : undefined;
  const size = xmlAttr(props, "sz");
  return {
    text: "",
    bold: bool(xmlAttr(props, "b")),
    italic: bool(xmlAttr(props, "i")),
    underline: Boolean(xmlAttr(props, "u") && xmlAttr(props, "u") !== "none"),
    color: colorFromNode(firstDescendant(props as SafeXmlElement, "solidFill")),
    fontSize: size ? clamp(numeric(size) / 100, 6, 96, 18) : undefined,
  };
}

function parseTextParagraphs(txBody: SafeXmlElement | undefined): OfficeParagraph[] {
  if (!txBody) return [];
  return xmlChildren(txBody, "p").map((paragraph) => {
    const pPr = xmlChild(paragraph, "pPr");
    const runs: OfficeRun[] = [];
    for (const child of paragraph.children) {
      if (child.localName !== "r" && child.localName !== "fld") continue;
      const run = parseRunProperties(child);
      run.text = xmlText(firstDescendant(child, "t"));
      if (run.text) runs.push(run);
    }
    if (runs.length === 0) {
      const text = xmlText(paragraph).trim();
      if (text) runs.push({ text });
    }
    const align = xmlAttr(pPr, "algn");
    const paragraphAlign: OfficeParagraph["align"] = align === "ctr" ? "center" : align === "r" ? "right" : "left";
    return {
      runs,
      bullet: Boolean(firstDescendant(pPr as SafeXmlElement, "buChar") || firstDescendant(pPr as SafeXmlElement, "buAutoNum")),
      align: paragraphAlign,
    };
  }).filter((paragraph) => paragraph.runs.length > 0);
}

function parseTableCell(cell: SafeXmlElement): OfficeTableCell {
  const paragraphs = parseTextParagraphs(firstDescendant(cell, "txBody"));
  const runs = paragraphs.flatMap((paragraph) => paragraph.runs);
  return {
    value: runs.map((run) => run.text).join("\n"),
    bold: runs.some((run) => run.bold),
    italic: runs.some((run) => run.italic),
    underline: runs.some((run) => run.underline),
    color: runs.find((run) => run.color)?.color,
    fill: parseFill(firstDescendant(cell, "tcPr")),
    align: paragraphs[0]?.align,
  };
}

function parsePptxTable(frame: SafeXmlElement, transform: ReturnType<typeof parseTransform>, zIndex: number): OfficeTable {
  const table = firstDescendant(frame, "tbl");
  if (!table) throw new OfficeConversionError("This PowerPoint table is incomplete.");
  const rows: OfficeTableCell[][] = [];
  const rowHeights: number[] = [];
  for (const row of xmlChildren(table, "tr")) {
    rowHeights.push(emu(xmlAttr(row, "h"), 20));
    rows.push(xmlChildren(row, "tc").map(parseTableCell));
  }
  const columnWidths = xmlChildren(firstDescendant(table, "tblGrid") as SafeXmlElement, "gridCol")
    .map((column) => emu(xmlAttr(column, "w"), transform.width / Math.max(1, rows[0]?.length ?? 1)));
  const merges: OfficeTable["merges"] = [];
  rows.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
    const tc = xmlChildren(xmlChildren(table, "tr")[rowIndex], "tc")[colIndex];
    const gridSpan = Math.max(1, Math.floor(numeric(xmlAttr(tc, "gridSpan"), 1)));
    const rowSpan = Math.max(1, Math.floor(numeric(xmlAttr(tc, "rowSpan"), 1)));
    if (gridSpan > 1 || rowSpan > 1) merges.push({ row: rowIndex, col: colIndex, rowspan: rowSpan, colspan: gridSpan });
  }));
  return { kind: "table", ...transform, zIndex, rows, columnWidths, rowHeights, merges };
}

function parseShapeItem(shape: SafeXmlElement, zIndex: number): OfficeTextBox | OfficeShape {
  const transform = parseTransform(shape);
  const shapeProperties = firstDescendant(shape, "spPr");
  const geometry = firstDescendant(shapeProperties as SafeXmlElement, "prstGeom");
  const preset = xmlAttr(geometry, "prst");
  const shapeKind = preset === "ellipse" || preset === "oval" ? "ellipse" : preset === "line" ? "line" : "rect";
  if (preset && !["rect", "roundRect", "ellipse", "oval", "line"].includes(preset)) {
    throw new OfficeConversionError(`This PowerPoint shape (${preset}) is outside Folio’s supported subset.`);
  }
  const fill = parseFill(shapeProperties);
  const line = parseLine(shapeProperties);
  const paragraphs = parseTextParagraphs(firstDescendant(shape, "txBody"));
  if (paragraphs.length > 0) return { kind: "text", ...transform, zIndex, paragraphs, fill, line };
  return { kind: "shape", shape: shapeKind, ...transform, zIndex, fill, line };
}

async function parsePptxSlide(
  packageData: OfficePackage,
  slidePath: string,
  slideName: string,
  width: number,
  height: number,
  slideIndex: number,
): Promise<OfficeSlide> {
  const root = await readXml(packageData, slidePath);
  const relationships = await relationshipsFor(packageData, slidePath);
  const background = parseFill(firstDescendant(root, "bgPr"));
  const tree = firstDescendant(root, "spTree");
  if (!tree) throw new OfficeConversionError(`PowerPoint slide ${slideIndex + 1} has no shape tree.`);
  const items: OfficeSlideItem[] = [];
  let zIndex = 0;
  for (const child of tree.children) {
    if (child.localName === "nvGrpSpPr" || child.localName === "grpSpPr") continue;
    if (child.localName === "sp") {
      items.push(parseShapeItem(child, zIndex++));
      continue;
    }
    if (child.localName === "pic") {
      const blip = firstDescendant(child, "blip");
      const relId = xmlAttr(blip, "r:embed") ?? xmlAttr(blip, "embed");
      const imagePath = assertEmbeddedRelationship(relId ? relationships.get(relId) : undefined, "embedded image");
      const mimeType = mimeForImage(imagePath);
      const imageBytes = await readEntry(packageData, imagePath);
      assertSafeImage(imageBytes, mimeType);
      const srcRect = firstDescendant(child, "srcRect");
      const crop = srcRect ? {
        left: clamp(numeric(xmlAttr(srcRect, "l")) / 100_000, 0, 1, 0),
        top: clamp(numeric(xmlAttr(srcRect, "t")) / 100_000, 0, 1, 0),
        right: clamp(numeric(xmlAttr(srcRect, "r")) / 100_000, 0, 1, 0),
        bottom: clamp(numeric(xmlAttr(srcRect, "b")) / 100_000, 0, 1, 0),
      } : undefined;
      items.push({ kind: "image", ...parseTransform(child), zIndex: zIndex++, mimeType, bytes: imageBytes, crop });
      continue;
    }
    if (child.localName === "graphicFrame") {
      const data = firstDescendant(child, "graphicData");
      const table = firstDescendant(data as SafeXmlElement, "tbl");
      if (!table) throw new OfficeConversionError(`PowerPoint slide ${slideIndex + 1} contains an unsupported graphic object.`);
      items.push(parsePptxTable(child, parseTransform(child), zIndex++));
      continue;
    }
    if (["grpSp", "cxnSp", "oleObj", "media", "video", "audio"].includes(child.localName)) {
      throw new OfficeConversionError(`PowerPoint slide ${slideIndex + 1} contains an unsupported ${child.localName} object.`);
    }
  }
  if (items.length === 0) throw new OfficeConversionError(`PowerPoint slide ${slideIndex + 1} has no supported content.`);
  return { name: slideName, width, height, background, items };
}

export async function parsePptxDirect(file: File): Promise<ParsedPptx> {
  const packageData = await loadOfficePackage(file, "pptx");
  const presentation = await readXml(packageData, PPT_MAIN);
  const relationships = await relationshipsFor(packageData, PPT_MAIN);
  const size = firstDescendant(presentation, "sldSz");
  const width = clamp(emu(xmlAttr(size, "cx"), 960), 72, 4_000, 960);
  const height = clamp(emu(xmlAttr(size, "cy"), 540), 72, 4_000, 540);
  const slideIds = xmlChildren(firstDescendant(presentation, "sldIdLst") as SafeXmlElement, "sldId");
  if (slideIds.length === 0 || slideIds.length > MAX_OFFICE_SLIDES) {
    throw new OfficeConversionError("This PowerPoint file has no safe, exportable slides.");
  }
  const slides: OfficeSlide[] = [];
  for (const [index, slideId] of slideIds.entries()) {
    const relId = xmlAttr(slideId, "r:id") ?? xmlAttr(slideId, "id");
    const slidePath = assertEmbeddedRelationship(relId ? relationships.get(relId) : undefined, "slide");
    const slideName = `Slide ${index + 1}`;
    slides.push(await parsePptxSlide(packageData, slidePath, slideName, width, height, index));
  }
  return { kind: "pptx", title: file.name, slides, diagnostics: [] };
}

function parseA1(reference: string): { row: number; col: number } | null {
  const match = /^\$?([A-Z]+)\$?(\d+)$/i.exec(reference.trim());
  if (!match) return null;
  let col = 0;
  for (const char of match[1].toUpperCase()) col = col * 26 + char.charCodeAt(0) - 64;
  return { row: Math.max(0, Number(match[2]) - 1), col: col - 1 };
}

function parseRange(reference: string): { row: number; col: number; rowspan: number; colspan: number } | null {
  const [start, end = start] = reference.split(":");
  const from = parseA1(start);
  const to = parseA1(end);
  if (!from || !to) return null;
  return {
    row: Math.min(from.row, to.row),
    col: Math.min(from.col, to.col),
    rowspan: Math.abs(to.row - from.row) + 1,
    colspan: Math.abs(to.col - from.col) + 1,
  };
}

function parseOfficeCellValue(cell: SafeXmlElement, sharedStrings: string[]): OfficeTableCell {
  const type = xmlAttr(cell, "t");
  const formula = childText(cell, "f");
  const raw = childText(cell, type === "inlineStr" ? "is" : "v");
  let value: string | number | boolean = raw;
  if (type === "s") value = sharedStrings[numeric(raw)] ?? "";
  else if (type === "b") value = raw === "1";
  else if (!type && raw !== "" && Number.isFinite(Number(raw))) value = Number(raw);
  else if (type === "str" && raw === "") value = "";
  if (formula && /(?:\[[^\]]+\]|(?:https?|file):|\\\\)/i.test(formula)) {
    throw new OfficeConversionError("This workbook contains a formula with an external reference. It was not converted.");
  }
  return { value, formula: formula || undefined };
}

function parseStyleTable(styles: SafeXmlElement | undefined): Array<Pick<OfficeTableCell, "bold" | "italic" | "underline" | "color" | "fill"> & { numFmtId?: number }> {
  if (!styles) return [];
  const fonts = xmlChildren(firstDescendant(styles, "fonts") as SafeXmlElement, "font").map((font) => ({
    bold: Boolean(xmlChild(font, "b")),
    italic: Boolean(xmlChild(font, "i")),
    underline: Boolean(xmlChild(font, "u")),
    color: colorFromNode(xmlChild(font, "color")),
  }));
  const fills = xmlChildren(firstDescendant(styles, "fills") as SafeXmlElement, "fill").map((fill) => colorFromNode(firstDescendant(fill, "fgColor")));
  const xfs = xmlChildren(firstDescendant(styles, "cellXfs") as SafeXmlElement, "xf");
  return xfs.map((xf) => ({
    ...fonts[numeric(xmlAttr(xf, "fontId"))],
    fill: fills[numeric(xmlAttr(xf, "fillId"))],
    numFmtId: numeric(xmlAttr(xf, "numFmtId")),
  }));
}

function applyStyle(cell: OfficeTableCell, styles: ReturnType<typeof parseStyleTable>, styleIndex: number): OfficeTableCell {
  const style = styles[styleIndex];
  return style ? { ...cell, ...style } : cell;
}

async function parseSharedStrings(packageData: OfficePackage): Promise<string[]> {
  const path = packageData.paths.get("xl/sharedstrings.xml");
  if (!path) return [];
  const root = parseSafeXml(safeXmlText(await readZipEntry(packageData.bytes, packageData.archive, path), path));
  return xmlChildren(root, "si").map((item) => xmlText(item));
}

async function parseXlsxSheet(
  packageData: OfficePackage,
  sheetPath: string,
  name: string,
  sharedStrings: string[],
  styles: ReturnType<typeof parseStyleTable>,
): Promise<OfficeSheet> {
  const root = await readXml(packageData, sheetPath);
  const rows = Array.from({ length: 0 }, () => []) as OfficeTableCell[][];
  const rowHeights: number[] = [];
  const columnWidths: number[] = [];
  const cols = firstDescendant(root, "cols");
  for (const col of xmlChildren(cols as SafeXmlElement, "col")) {
    const from = Math.max(1, Math.floor(numeric(xmlAttr(col, "min"), 1))) - 1;
    const to = Math.min(MAX_OFFICE_COLUMNS, Math.floor(numeric(xmlAttr(col, "max"), from + 1)));
    for (let index = from; index < to; index++) columnWidths[index] = clamp(numeric(xmlAttr(col, "width"), 10), 3, 80, 10);
  }
  const sheetData = firstDescendant(root, "sheetData");
  for (const row of xmlChildren(sheetData as SafeXmlElement, "row")) {
    const rowIndex = Math.max(0, Math.min(MAX_OFFICE_ROWS - 1, Math.floor(numeric(xmlAttr(row, "r"), rows.length + 1)) - 1));
    if (!rows[rowIndex]) rows[rowIndex] = [];
    rowHeights[rowIndex] = clamp(numeric(xmlAttr(row, "ht"), 20), 10, 120, 20);
    for (const cell of xmlChildren(row, "c")) {
      const address = parseA1(xmlAttr(cell, "r") ?? "");
      if (!address || address.row >= MAX_OFFICE_ROWS || address.col >= MAX_OFFICE_COLUMNS) continue;
      rows[address.row][address.col] = applyStyle(parseOfficeCellValue(cell, sharedStrings), styles, Math.floor(numeric(xmlAttr(cell, "s"))));
    }
  }
  const merges = xmlChildren(firstDescendant(root, "mergeCells") as SafeXmlElement, "mergeCell")
    .map((merge) => parseRange(xmlAttr(merge, "ref") ?? ""))
    .filter((merge): merge is NonNullable<typeof merge> => Boolean(merge));
  const maxRow = Math.min(MAX_OFFICE_ROWS, Math.max(1, rows.length));
  const maxCol = Math.min(MAX_OFFICE_COLUMNS, Math.max(1, ...rows.map((row) => row.length)));
  const normalizedRows = Array.from({ length: maxRow }, (_, row) =>
    Array.from({ length: maxCol }, (_, col) => rows[row]?.[col] ?? { value: "" }),
  );
  if (normalizedRows.every((row) => row.every((cell) => String(cell.value) === ""))) {
    throw new OfficeConversionError(`Excel sheet “${name}” has no readable cell content.`);
  }
  return { name: name || "Sheet", rows: normalizedRows, columnWidths, rowHeights, merges };
}

export async function parseXlsxDirect(file: File): Promise<ParsedXlsx> {
  const packageData = await loadOfficePackage(file, "xlsx");
  const workbook = await readXml(packageData, XLS_MAIN);
  const workbookRelationships = await relationshipsFor(packageData, XLS_MAIN);
  for (const relationship of workbookRelationships.values()) {
    if (relationship.external) throw new OfficeConversionError("This workbook references external content that Folio will not fetch.");
  }
  if (firstDescendant(workbook, "externalReferences")) {
    throw new OfficeConversionError("This workbook references external workbooks. No external content was fetched.");
  }
  const sharedStrings = await parseSharedStrings(packageData);
  const stylesPath = packageData.paths.get("xl/styles.xml");
  const styles = stylesPath
    ? parseStyleTable(parseSafeXml(safeXmlText(await readZipEntry(packageData.bytes, packageData.archive, stylesPath), stylesPath)))
    : [];
  const sheetNodes = xmlChildren(firstDescendant(workbook, "sheets") as SafeXmlElement, "sheet");
  if (sheetNodes.length === 0 || sheetNodes.length > MAX_OFFICE_SHEETS) throw new OfficeConversionError("This Excel workbook has no safe, exportable worksheets.");
  const sheets: OfficeSheet[] = [];
  for (const sheet of sheetNodes) {
    const relId = xmlAttr(sheet, "r:id") ?? xmlAttr(sheet, "id");
    const rel = relId ? workbookRelationships.get(relId) : undefined;
    const sheetPath = assertEmbeddedRelationship(rel, "worksheet");
    sheets.push(await parseXlsxSheet(packageData, sheetPath, xmlAttr(sheet, "name") ?? "Sheet", sharedStrings, styles));
  }
  return { kind: "xlsx", title: file.name, sheets, diagnostics: [] };
}

function copyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

async function parseOfficeInWorker(file: File, kind: OfficeKind): Promise<ParsedPptx | ParsedXlsx> {
  if (typeof Worker !== "function") throw new OfficeWorkerUnavailableError("Web Workers are unavailable.");
  let worker: Worker;
  try {
    worker = new Worker(new URL("./office.worker.ts", import.meta.url), { type: "module", name: "folio-office" });
  } catch (cause) {
    throw new OfficeWorkerUnavailableError("The Office Worker could not start.", cause);
  }
  const id = ++officeWorkerRequestId;
  const buffer = copyArrayBuffer(await readFileBytes(file));
  return new Promise<ParsedPptx | ParsedXlsx>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => finish(() => reject(new OfficeWorkerUnavailableError("The Office Worker timed out."))), 60_000);
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
        finish(() => resolve(event.data.document as ParsedPptx | ParsedXlsx));
      } else {
        finish(() => reject(new OfficeConversionError(event.data.error?.message ?? "The Office document could not be read.")));
      }
    };
    const onError = (event: ErrorEvent) => finish(() => reject(new OfficeWorkerUnavailableError("The Office Worker could not load.", event.error ?? event.message)));
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    try {
      worker.postMessage({ id, kind, name: file.name, type: file.type, buffer }, [buffer]);
    } catch (cause) {
      finish(() => reject(new OfficeWorkerUnavailableError("The Office Worker could not receive this file.", cause)));
    }
  });
}

async function parseOffice(file: File, kind: OfficeKind): Promise<ParsedPptx | ParsedXlsx> {
  try {
    return await parseOfficeInWorker(file, kind);
  } catch (cause) {
    if (!(cause instanceof OfficeWorkerUnavailableError)) throw cause;
    return kind === "pptx" ? parsePptxDirect(file) : parseXlsxDirect(file);
  }
}

export async function parsePptx(file: File): Promise<ParsedPptx> {
  return (await parseOffice(file, "pptx")) as ParsedPptx;
}

export async function parseXlsx(file: File): Promise<ParsedXlsx> {
  return (await parseOffice(file, "xlsx")) as ParsedXlsx;
}

export async function assertSafeDocx(file: File): Promise<void> {
  if (file.size > MAX_DOCX_OUTPUT_BYTES) throw new OfficeConversionError("Word files larger than 50 MB are not supported in this browser.");
  const bytes = await readFileBytes(file);
  let archive: SafeArchive;
  try {
    archive = inspectZip(bytes);
  } catch (cause) {
    throw new OfficeConversionError("This Word file is damaged or exceeds Folio’s safety limits.", cause);
  }
  const paths = new Map(archive.entries.map((entry) => [lowerPath(entry.path), entry.path]));
  if (!paths.has("[content_types].xml") || !paths.has(WORD_MAIN)) throw new OfficeConversionError("This Word file is missing its required document parts.");
  const manifest = safeXmlText(await readZipEntry(bytes, archive, paths.get("[content_types].xml")!), "[Content_Types].xml");
  if (/<Override\b[^>]*ContentType\s*=\s*["'][^"']*macroEnabled[^"']*["']/i.test(manifest) || /\.docm$/i.test(file.name) || paths.has("word/vbaproject.bin")) {
    throw new OfficeConversionError("Macro-enabled Word files are not supported. Save a copy without macros and try again.");
  }
  if (archive.entries.some((entry) => {
    const path = entry.path.toLowerCase();
    return path.startsWith("word/embeddings/") || path.startsWith("word/activeX/") || path.endsWith(".svg") || path.endsWith(".bin");
  })) {
    throw new OfficeConversionError("This Word document contains embedded content that Folio cannot process safely.");
  }
  for (const entry of archive.entries.filter((candidate) => candidate.path.toLowerCase().endsWith(".rels"))) {
    const text = safeXmlText(await readZipEntry(bytes, archive, entry.path), entry.path);
    const root = parseSafeXml(text);
    for (const relationship of xmlChildren(root, "Relationship")) {
      const target = xmlAttr(relationship, "Target") ?? "";
      const type = xmlAttr(relationship, "Type") ?? "";
      if (!isExternalTarget(target, xmlAttr(relationship, "TargetMode"))) continue;
      // Hyperlinks are preserved as inert text by Mammoth and are never fetched.
      // External media, OLE, and package relationships are rejected instead.
      if (!/hyperlink/i.test(type)) {
        throw new OfficeConversionError("This Word document references external content that Folio will not fetch.");
      }
    }
  }
}

function hexRgb(value: string | undefined, fallback = "#111827"): [number, number, number] {
  const raw = (value ?? fallback).replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return hexRgb(fallback);
  return [0, 2, 4].map((offset) => Number.parseInt(raw.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

function officeFontName(run: OfficeRun): string {
  if (run.bold && run.italic) return "HelveticaBoldOblique";
  if (run.bold) return "HelveticaBold";
  if (run.italic) return "HelveticaOblique";
  return "Helvetica";
}

async function officeFont(pdf: import("pdf-lib").PDFDocument, run: OfficeRun) {
  const { StandardFonts } = await import("pdf-lib");
  return pdf.embedFont(StandardFonts[officeFontName(run) as keyof typeof StandardFonts]);
}

async function drawOfficeParagraphs(
  pdf: import("pdf-lib").PDFDocument,
  page: import("pdf-lib").PDFPage,
  box: Pick<OfficeTextBox, "x" | "y" | "width" | "height">,
  pageHeight: number,
  paragraphs: OfficeParagraph[],
): Promise<void> {
  let cursor = box.height;
  for (const paragraph of paragraphs) {
    const runs = paragraph.runs.length > 0 ? paragraph.runs : [{ text: "" }];
    const size = Math.max(6, Math.min(72, Math.max(...runs.map((run) => run.fontSize ?? 18))));
    const lineHeight = Math.max(9, size * 1.2);
    cursor -= lineHeight;
    if (cursor < -lineHeight) break;
    let x = box.x + (paragraph.bullet ? 12 : 0);
    const prefix = paragraph.bullet ? "• " : "";
    if (prefix) {
      const bulletFont = await officeFont(pdf, { text: prefix, fontSize: size });
      page.drawText(prefix, { x: box.x, y: pageHeight - box.y - box.height + cursor, size, font: bulletFont });
      x += bulletFont.widthOfTextAtSize(prefix, size);
    }
    const totalWidth = runs.reduce((sum, run) => sum + run.text.length, 0);
    const alignmentOffset = paragraph.align === "center" ? box.width / 2 : paragraph.align === "right" ? box.width : 0;
    let lineWidth = 0;
    const measured: Array<{ run: OfficeRun; font: import("pdf-lib").PDFFont; width: number }> = [];
    for (const run of runs) {
      const font = await officeFont(pdf, run);
      const width = font.widthOfTextAtSize(run.text, size);
      measured.push({ run, font, width });
      lineWidth += width;
    }
    if (paragraph.align === "center") x = box.x + alignmentOffset - lineWidth / 2;
    if (paragraph.align === "right") x = box.x + alignmentOffset - lineWidth;
    for (const { run, font, width } of measured) {
      const [r, g, b] = hexRgb(run.color);
      page.drawText(run.text, { x, y: pageHeight - box.y - box.height + cursor, size, font, color: (await import("pdf-lib")).rgb(r, g, b) });
        if (run.underline) {
          page.drawLine({
          start: { x, y: pageHeight - box.y - box.height + cursor - 2 },
          end: { x: x + width, y: pageHeight - box.y - box.height + cursor - 2 },
          thickness: 0.6,
          color: (await import("pdf-lib")).rgb(r, g, b),
        });
      }
      x += width;
    }
    // Keep the unused value explicit. It documents that an empty paragraph is
    // still laid out and prevents future changes from treating it as absent.
    void totalWidth;
  }
}

function mergeAt(
  table: OfficeTable,
  row: number,
  col: number,
): { row: number; col: number; rowspan: number; colspan: number } | undefined {
  return table.merges?.find((merge) => merge.row === row && merge.col === col);
}

function coveredByMerge(table: OfficeTable, row: number, col: number): boolean {
  return table.merges?.some((merge) =>
    row >= merge.row && row < merge.row + merge.rowspan &&
    col >= merge.col && col < merge.col + merge.colspan &&
    (row !== merge.row || col !== merge.col),
  ) ?? false;
}

async function drawOfficeTable(
  pdf: import("pdf-lib").PDFDocument,
  page: import("pdf-lib").PDFPage,
  table: OfficeTable,
): Promise<void> {
  const { rgb } = await import("pdf-lib");
  const columns = Math.max(1, Math.min(MAX_OFFICE_COLUMNS, ...table.rows.map((row) => row.length)));
  const widths = table.columnWidths?.length === columns
    ? table.columnWidths
    : Array.from({ length: columns }, () => table.width / columns);
  const rowHeights = table.rowHeights?.length === table.rows.length
    ? table.rowHeights
    : table.rows.map(() => Math.max(22, table.height / Math.max(1, table.rows.length)));
  let y = table.y + table.height;
  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
    const rowHeight = Math.max(12, rowHeights[rowIndex] ?? 22);
    y -= rowHeight;
    let x = table.x;
    for (let colIndex = 0; colIndex < columns; colIndex++) {
      if (coveredByMerge(table, rowIndex, colIndex)) {
        x += widths[colIndex] ?? 80;
        continue;
      }
      const merge = mergeAt(table, rowIndex, colIndex);
      const colspan = merge?.colspan ?? 1;
      const rowspan = merge?.rowspan ?? 1;
      const cellWidth = widths.slice(colIndex, colIndex + colspan).reduce((sum, width) => sum + (width ?? 80), 0);
      const cellHeight = rowHeights.slice(rowIndex, rowIndex + rowspan).reduce((sum, height) => sum + (height ?? 22), 0);
      const cell = table.rows[rowIndex]?.[colIndex] ?? { value: "" };
      const fill = hexRgb(cell.fill, "#ffffff");
      const border = hexRgb("#cbd5e1");
      page.drawRectangle({ x, y: y - (cellHeight - rowHeight), width: cellWidth, height: cellHeight, color: rgb(...fill), borderColor: rgb(...border), borderWidth: 0.5 });
      const value = String(cell.value ?? "");
      if (value) {
        const run: OfficeRun = { text: value, bold: cell.bold, italic: cell.italic, underline: cell.underline, color: cell.color, fontSize: 10 };
        const font = await officeFont(pdf, run);
        const lines = value.split(/\r?\n/).slice(0, 4);
        for (const [lineIndex, line] of lines.entries()) {
          const text = line.length > 160 ? `${line.slice(0, 157)}…` : line;
          page.drawText(text, { x: x + 4, y: y + cellHeight - 13 - lineIndex * 11, size: 10, font, color: rgb(...hexRgb(cell.color)) });
        }
      }
      x += widths[colIndex] ?? 80;
      for (let skip = 1; skip < colspan; skip++) x += widths[colIndex + skip] ?? 80;
    }
  }
}

async function renderPptxToPdf(document: ParsedPptx): Promise<Uint8Array> {
  const { PDFDocument, rgb, degrees } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const slide of document.slides) {
    const page = pdf.addPage([slide.width, slide.height]);
    page.drawRectangle({ x: 0, y: 0, width: slide.width, height: slide.height, color: rgb(...hexRgb(slide.background, "#ffffff")) });
    for (const item of [...slide.items].sort((left, right) => left.zIndex - right.zIndex)) {
      if (item.kind === "text") {
        await drawOfficeParagraphs(pdf, page, item, slide.height, item.paragraphs);
      } else if (item.kind === "shape") {
        const fill = rgb(...hexRgb(item.fill, "#eef2f7"));
        const line = rgb(...hexRgb(item.line, "#94a3b8"));
        if (item.shape === "ellipse") page.drawEllipse({ x: item.x + item.width / 2, y: slide.height - item.y - item.height / 2, xScale: item.width / 2, yScale: item.height / 2, color: fill, borderColor: line, borderWidth: 0.8 });
        else if (item.shape === "line") page.drawLine({ start: { x: item.x, y: slide.height - item.y }, end: { x: item.x + item.width, y: slide.height - item.y - item.height }, color: line, thickness: 1 });
        else page.drawRectangle({ x: item.x, y: slide.height - item.y - item.height, width: item.width, height: item.height, color: fill, borderColor: line, borderWidth: 0.8 });
      } else if (item.kind === "image") {
        const image = item.mimeType === "image/png" ? await pdf.embedPng(item.bytes) : await pdf.embedJpg(item.bytes);
        page.drawImage(image, { x: item.x, y: slide.height - item.y - item.height, width: item.width, height: item.height, rotate: degrees(0) });
      } else {
        await drawOfficeTable(pdf, page, { ...item, y: slide.height - item.y - item.height });
      }
    }
  }
  const bytes = await pdf.save({ useObjectStreams: true });
  if (new TextDecoder().decode(bytes.subarray(0, PDF_SIGNATURE.length)) !== PDF_SIGNATURE) throw new OfficeConversionError("Folio could not validate the PowerPoint PDF.");
  const checked = await loadCheckedPdf(bytes);
  if (checked.getPageCount() !== document.slides.length) throw new OfficeConversionError("Folio could not validate the PowerPoint slide count.");
  return bytes;
}

export async function powerpointToPdf(file: File): Promise<Uint8Array> {
  const document = await parsePptx(file);
  return renderPptxToPdf(document);
}

async function renderXlsxToPdf(document: ParsedXlsx): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 28;
  const { StandardFonts } = await import("pdf-lib");
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const sheet of document.sheets) {
    const columns = Math.max(1, Math.min(MAX_OFFICE_COLUMNS, ...sheet.rows.map((row) => row.length)));
    const sourceWidths = Array.from({ length: columns }, (_, index) => clamp(sheet.columnWidths[index] ?? 12, 3, 28, 12) * 5.5);
    const scale = Math.min(1, (pageWidth - margin * 2) / sourceWidths.reduce((sum, width) => sum + width, 0));
    const widths = sourceWidths.map((width) => width * scale);
    const rowHeights = sheet.rowHeights.map((height) => clamp(height * 1.2 * Math.max(0.7, scale), 12, 72, 24));
    let rowIndex = 0;
    while (rowIndex < sheet.rows.length) {
      const page = pdf.addPage([pageWidth, pageHeight]);
      page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });
      page.drawText(sheet.name, { x: margin, y: pageHeight - margin - 2, size: 14, font: titleFont, color: rgb(0.08, 0.1, 0.14) });
      const availableHeight = pageHeight - 2 * margin - 28;
      let consumedHeight = 0;
      let rowEnd = rowIndex;
      while (rowEnd < sheet.rows.length) {
        const nextHeight = rowHeights[rowEnd] ?? 24;
        if (rowEnd > rowIndex && consumedHeight + nextHeight > availableHeight) break;
        consumedHeight += nextHeight;
        rowEnd++;
      }
      const rows = sheet.rows.slice(rowIndex, rowEnd);
      const table: OfficeTable = {
        kind: "table",
        x: margin,
        y: margin,
        width: widths.reduce((sum, width) => sum + width, 0),
        height: consumedHeight,
        zIndex: 0,
        rows,
        columnWidths: widths,
        rowHeights: rowHeights.slice(rowIndex, rowEnd),
        merges: sheet.merges
          .filter((merge) => merge.row >= rowIndex && merge.row < rowIndex + rows.length)
          .map((merge) => ({ ...merge, row: merge.row - rowIndex })),
      };
      await drawOfficeTable(pdf, page, table);
      rowIndex += rows.length;
    }
  }
  const bytes = await pdf.save({ useObjectStreams: true });
  if (new TextDecoder().decode(bytes.subarray(0, PDF_SIGNATURE.length)) !== PDF_SIGNATURE) throw new OfficeConversionError("Folio could not validate the Excel PDF.");
  const checked = await loadCheckedPdf(bytes);
  if (checked.getPageCount() < 1) throw new OfficeConversionError("Folio could not validate the Excel PDF pages.");
  return bytes;
}

export async function excelToPdf(file: File): Promise<Uint8Array> {
  const document = await parseXlsx(file);
  return renderXlsxToPdf(document);
}

async function parseAppleForOfficeExport(file: File, kind: "pages" | "keynote"): Promise<IworkDocument> {
  const { parseAppleDocument } = await import("./iwork");
  return parseAppleDocument(file, kind);
}

function officeParagraphsFromBlock(block: IworkTextBlock): OfficeParagraph[] {
  const paragraphs = block.paragraphs?.length ? block.paragraphs : [{ runs: [{ text: block.text }] }];
  return paragraphs
    .map((paragraph) => ({
      runs: paragraph.runs.map((run) => ({
        text: run.text,
        color: run.color ?? paragraph.color ?? block.color,
        bold: run.bold ?? paragraph.bold ?? block.bold,
        italic: run.italic ?? paragraph.italic ?? block.italic,
        fontSize: block.fontSize,
      })),
      bullet: paragraph.bullet,
      align: block.align,
    }))
    .filter((paragraph) => paragraph.runs.some((run) => run.text.length > 0));
}

function officeTableFromIwork(table: IworkTable, scene: IworkScene, zIndex: number): OfficeTable {
  const rows = table.rows.slice(0, MAX_OFFICE_ROWS).map((row) => row.slice(0, MAX_OFFICE_COLUMNS).map((value) => ({
    value,
    fontSize: table.fontSize,
    fill: table.headerRows && row === table.rows[0] ? table.headerRowBackground : undefined,
  })));
  const columns = Math.max(1, ...rows.map((row) => row.length));
  return {
    kind: "table",
    x: clamp(table.x, 0, scene.width, 0),
    y: clamp(table.y, 0, scene.height, 0),
    width: clamp(table.width ?? scene.width * 0.8, 48, scene.width, scene.width * 0.8),
    height: clamp(table.height ?? Math.max(24, rows.length * 24), 24, scene.height, Math.max(24, rows.length * 24)),
    zIndex,
    rows: rows.map((row) => Array.from({ length: columns }, (_, index) => row[index] ?? { value: "" })),
    columnWidths: table.columnWidths?.slice(0, columns),
    rowHeights: table.rowHeights?.slice(0, rows.length),
    merges: table.merges?.slice(0, MAX_OFFICE_ROWS),
  };
}

function officeItemFromIworkObject(object: IworkVisualObject, zIndex: number): OfficeSlideItem {
  const transform = {
    x: Math.max(0, object.x),
    y: Math.max(0, object.y),
    width: Math.max(1, object.width),
    height: Math.max(1, object.height),
  };
  if (object.kind === "image") {
    const mimeType = object.mimeType === "image/png" ? "image/png" : object.mimeType === "image/jpeg" ? "image/jpeg" : undefined;
    if (!mimeType || !object.bytes) throw new OfficeConversionError("This Apple document contains an image format that cannot be exported safely.");
    assertSafeImage(object.bytes, mimeType);
    return { kind: "image", ...transform, zIndex, mimeType, bytes: new Uint8Array(object.bytes) };
  }
  if (object.kind === "shape") {
    if (object.text) {
      return { kind: "text", ...transform, zIndex, paragraphs: [{ runs: [{ text: object.text }] }] };
    }
    return { kind: "shape", ...transform, zIndex, shape: "rect" };
  }
  if (object.kind === "chart") {
    throw new OfficeConversionError("This Apple document contains a chart that Folio cannot export to this Office format yet.");
  }
  throw new OfficeConversionError("This Apple document contains media or an embedded object that Folio cannot export safely.");
}

function officeItemsFromScene(scene: IworkScene): OfficeSlideItem[] {
  const items: OfficeSlideItem[] = [];
  for (const block of scene.blocks) {
    const paragraphs = officeParagraphsFromBlock(block);
    if (paragraphs.length > 0) {
      items.push({
        kind: "text",
        x: Math.max(0, block.x),
        y: Math.max(0, block.y),
        width: Math.max(1, block.width),
        height: Math.max(1, block.height),
        zIndex: block.zIndex ?? items.length,
        paragraphs,
        fill: undefined,
      });
    }
  }
  for (const table of scene.tables) items.push(officeTableFromIwork(table, scene, table.zIndex ?? items.length));
  for (const object of scene.objects) items.push(officeItemFromIworkObject(object, object.zIndex ?? items.length));
  return items.sort((left, right) => left.zIndex - right.zIndex);
}

function xmlDocument(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}

function twips(points: number): number {
  return Math.max(1_440, Math.min(31_680, Math.round(points * 20)));
}

function emus(points: number): number {
  return Math.max(1, Math.round(points * EMU_PER_POINT));
}

function officeHex(value: string | undefined, fallback = "111827"): string {
  const raw = (value ?? `#${fallback}`).replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : fallback;
}

function wordRunXml(run: OfficeRun): string {
  const properties = [
    run.bold ? "<w:b/>" : "",
    run.italic ? "<w:i/>" : "",
    run.underline ? '<w:u w:val="single"/>' : "",
    run.color ? `<w:color w:val="${officeHex(run.color)}"/>` : "",
    run.fontSize ? `<w:sz w:val="${Math.max(8, Math.min(192, Math.round(run.fontSize * 2)))}"/>` : "",
  ].join("");
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
}

function wordParagraphXml(paragraph: OfficeParagraph): string {
  const alignment = paragraph.align ? `<w:jc w:val="${paragraph.align}"/>` : "";
  const numbering = paragraph.bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : "";
  const properties = alignment || numbering ? `<w:pPr>${alignment}${numbering}</w:pPr>` : "";
  const runs = paragraph.runs.length > 0 ? paragraph.runs.map(wordRunXml).join("") : "<w:r><w:t/></w:r>";
  return `<w:p>${properties}${runs}</w:p>`;
}

function wordTableCellXml(cell: OfficeTableCell, colspan = 1, verticalMerge?: "restart" | "continue"): string {
  const properties = [
    colspan > 1 ? `<w:gridSpan w:val="${colspan}"/>` : "",
    verticalMerge ? `<w:vMerge w:val="${verticalMerge}"/>` : "",
    cell.fill ? `<w:shd w:fill="${officeHex(cell.fill, "FFFFFF")}"/>` : "",
  ].join("");
  const run: OfficeRun = {
    text: String(cell.value ?? ""),
    bold: cell.bold,
    italic: cell.italic,
    underline: cell.underline,
    color: cell.color,
    fontSize: 10,
  };
  return `<w:tc><w:tcPr>${properties}</w:tcPr>${wordParagraphXml({ runs: [run], align: cell.align })}</w:tc>`;
}

function wordTableXml(table: OfficeTable): string {
  const columns = Math.max(1, Math.min(MAX_OFFICE_COLUMNS, ...table.rows.map((row) => row.length)));
  const widths = Array.from({ length: columns }, (_, index) => Math.max(240, Math.round((table.columnWidths?.[index] ?? table.width / columns) * 20)));
  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("");
  const rows = table.rows.map((row, rowIndex) => {
    let cells = "";
    for (let colIndex = 0; colIndex < columns; colIndex++) {
      const merge = mergeAt(table, rowIndex, colIndex);
      const covering = table.merges?.find((candidate) =>
        rowIndex >= candidate.row && rowIndex < candidate.row + candidate.rowspan &&
        colIndex >= candidate.col && colIndex < candidate.col + candidate.colspan,
      );
      if (covering && colIndex !== covering.col) continue;
      const cell = row[colIndex] ?? { value: "" };
      if (covering && rowIndex > covering.row) {
        cells += wordTableCellXml(cell, covering.colspan, "continue");
      } else {
        cells += wordTableCellXml(cell, merge?.colspan ?? 1, merge && merge.rowspan > 1 ? "restart" : undefined);
      }
      if (merge) colIndex += merge.colspan - 1;
    }
    return `<w:tr>${cells}</w:tr>`;
  }).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((sum, width) => sum + width, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
}

function docxPictureXml(relId: string, image: OfficeImage): string {
  const name = `Folio image ${relId}`;
  return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emus(image.width)}" cy="${emus(image.height)}"/><wp:docPr id="${escapeAttr(relId.replace(/\D/g, "") || "1")}" name="${escapeAttr(name)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="${escapeAttr(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${escapeAttr(relId)}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emus(image.width)}" cy="${emus(image.height)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

async function renderPagesDocumentToDocx(document: IworkDocument): Promise<Uint8Array> {
  const media: Array<{ path: string; relId: string; image: OfficeImage }> = [];
  const body: string[] = [];
  let imageIndex = 0;
  for (const [sceneIndex, scene] of document.scenes.entries()) {
    if (sceneIndex > 0) body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    for (const item of officeItemsFromScene(scene)) {
      if (item.kind === "text") body.push(item.paragraphs.map(wordParagraphXml).join(""));
      else if (item.kind === "table") body.push(wordTableXml(item));
      else if (item.kind === "image") {
        const extension = item.mimeType === "image/png" ? "png" : "jpg";
        const relId = `rIdImage${++imageIndex}`;
        const image = { path: `word/media/image${imageIndex}.${extension}`, relId, image: item };
        media.push(image);
        body.push(docxPictureXml(relId, item));
      } else if (item.kind === "shape") {
        body.push(wordParagraphXml({ runs: [{ text: item.shape === "line" ? "—" : "" }] }));
      }
    }
  }
  if (body.length === 0) throw new OfficeConversionError("This Pages document has no exportable content.");
  const firstScene = document.scenes[0];
  const pageWidth = twips(firstScene?.width ?? 612);
  const pageHeight = twips(firstScene?.height ?? 792);
  const documentXml = xmlDocument(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="${pageWidth}" w:h="${pageHeight}"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`);
  const zip = new JSZip();
  zip.file("[Content_Types].xml", xmlDocument(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`));
  zip.file("_rels/.rels", xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`));
  zip.file("word/document.xml", documentXml);
  zip.file("word/styles.xml", xmlDocument(`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val="en-US"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`));
  zip.file("word/numbering.xml", xmlDocument(`<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`));
  zip.file("word/_rels/document.xml.rels", xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${media.map(({ relId, path }) => `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${path.replace(/^word\//, "")}"/>`).join("")}</Relationships>`));
  zip.file("docProps/core.xml", xmlDocument(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(document.title)}</dc:title></cp:coreProperties>`));
  zip.file("docProps/app.xml", xmlDocument(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Folio local converter</Application></Properties>`));
  for (const { path, image } of media) zip.file(path, image.bytes);
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  await validateDocxOutput(bytes, document);
  return bytes;
}

async function validateDocxOutput(bytes: Uint8Array, source: IworkDocument): Promise<void> {
  if (bytes.length === 0 || bytes.length > MAX_DOCX_OUTPUT_BYTES) throw new OfficeConversionError("Folio could not validate the Pages DOCX output.");
  let archive: SafeArchive;
  try {
    archive = inspectZip(bytes);
  } catch (cause) {
    throw new OfficeConversionError("Folio could not validate the Pages DOCX output.", cause);
  }
  const paths = new Set(archive.entries.map((entry) => lowerPath(entry.path)));
  for (const required of ["[content_types].xml", WORD_MAIN, "word/_rels/document.xml.rels"]) {
    if (!paths.has(required)) throw new OfficeConversionError("Folio could not validate the Pages DOCX package parts.");
  }
  const documentXml = safeXmlText(await readZipEntry(bytes, archive, archive.entries.find((entry) => lowerPath(entry.path) === WORD_MAIN)!.path), WORD_MAIN);
  const root = parseSafeXml(documentXml);
  const text = xmlText(root);
  const expected = source.scenes.flatMap((scene) => scene.blocks.map((block) => block.text)).filter(Boolean).slice(0, 5);
  if (expected.length > 0 && expected.some((value) => !text.includes(value))) throw new OfficeConversionError("Folio could not validate the Pages text in the DOCX output.");
  for (const entry of archive.entries.filter((entry) => entry.path.toLowerCase().endsWith(".rels"))) {
    const rels = safeXmlText(await readZipEntry(bytes, archive, entry.path), entry.path);
    if (/TargetMode\s*=\s*["']External["']/i.test(rels)) throw new OfficeConversionError("Folio produced a DOCX with an external relationship.");
  }
}

export async function pagesToDocx(file: File): Promise<Uint8Array> {
  const document = await parseAppleForOfficeExport(file, "pages");
  return renderPagesDocumentToDocx(document);
}

function pptxTransform(item: Pick<OfficeTextBox, "x" | "y" | "width" | "height">): string {
  return `<a:xfrm><a:off x="${emus(item.x)}" y="${emus(item.y)}"/><a:ext cx="${emus(item.width)}" cy="${emus(item.height)}"/></a:xfrm>`;
}

function pptxFillXml(fill: string | undefined): string {
  return fill ? `<a:solidFill><a:srgbClr val="${officeHex(fill)}"/></a:solidFill>` : "<a:noFill/>";
}

function pptxLineXml(line: string | undefined): string {
  return line ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${officeHex(line, "94A3B8")}"/></a:solidFill></a:ln>` : "<a:ln><a:noFill/></a:ln>";
}

function pptxTextBodyXml(paragraphs: OfficeParagraph[]): string {
  const xml = paragraphs.map((paragraph) => {
    const alignment = paragraph.align ? ` algn="${paragraph.align === "center" ? "ctr" : paragraph.align === "right" ? "r" : "l"}"` : "";
    const pPr = paragraph.align || paragraph.bullet
      ? `<a:pPr${alignment}>${paragraph.bullet ? "<a:buChar char=\"•\"/>" : ""}</a:pPr>`
      : "";
    const runs = paragraph.runs.length > 0 ? paragraph.runs.map((run) => `<a:r><a:rPr lang="en-US" sz="${Math.max(600, Math.min(9600, Math.round((run.fontSize ?? 18) * 100)))}"${run.bold ? " b=\"1\"" : ""}${run.italic ? " i=\"1\"" : ""}${run.underline ? " u=\"sng\"" : ""}>${run.color ? `<a:solidFill><a:srgbClr val="${officeHex(run.color)}"/></a:solidFill>` : ""}</a:rPr><a:t>${escapeXml(run.text)}</a:t></a:r>`).join("") : "<a:endParaRPr lang=\"en-US\"/>";
    return `<a:p>${pPr}${runs}<a:endParaRPr lang="en-US"/></a:p>`;
  }).join("");
  return `<p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${xml || "<a:p><a:endParaRPr lang=\"en-US\"/></a:p>"}</p:txBody>`;
}

function pptxShapeXml(item: OfficeTextBox | OfficeShape, id: number): string {
  const isText = item.kind === "text";
  const preset = item.kind === "shape" ? item.shape : "rect";
  const textBody = isText ? pptxTextBodyXml(item.paragraphs) : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeAttr(isText ? "Text" : "Shape")}${id}"/><p:cNvSpPr${isText ? " txBox=\"1\"" : ""}/><p:nvPr/></p:nvSpPr><p:spPr>${pptxTransform(item)}<a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom>${pptxFillXml(item.fill)}${pptxLineXml(item.line)}</p:spPr>${textBody}</p:sp>`;
}

function pptxImageXml(item: OfficeImage, id: number, relId: string): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Image${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${escapeAttr(relId)}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${pptxTransform(item)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function pptxTableXml(item: OfficeTable, id: number): string {
  const columns = Math.max(1, Math.min(MAX_OFFICE_COLUMNS, ...item.rows.map((row) => row.length)));
  const widths = Array.from({ length: columns }, (_, index) => Math.max(1, Math.round((item.columnWidths?.[index] ?? item.width / columns) * EMU_PER_POINT)));
  const grid = widths.map((width) => `<a:gridCol w="${width}"/>`).join("");
  const rows = item.rows.map((row, rowIndex) => {
    const height = Math.max(1, Math.round((item.rowHeights?.[rowIndex] ?? item.height / Math.max(1, item.rows.length)) * EMU_PER_POINT));
    return `<a:tr h="${height}">${Array.from({ length: columns }, (_, colIndex) => {
      const cell = row[colIndex] ?? { value: "" };
      const merge = mergeAt(item, rowIndex, colIndex);
      const attrs = [merge && merge.colspan > 1 ? ` gridSpan="${merge.colspan}"` : "", merge && merge.rowspan > 1 ? ` rowSpan="${merge.rowspan}"` : ""].join("");
      return `<a:tc${attrs}>${pptxTextBodyXml([{ runs: [{ text: String(cell.value ?? ""), bold: cell.bold, italic: cell.italic, underline: cell.underline, color: cell.color, fontSize: 10 }], align: cell.align }])}<a:tcPr/></a:tc>`;
    }).join("")}</a:tr>`;
  }).join("");
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table${id}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm>${pptxTransform(item).replace(/^<a:xfrm>|<\/a:xfrm>$/g, "")}</p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId></a:tblPr><a:tblGrid>${grid}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

function pptxShapeTreeXml(slide: OfficeSlide): { tree: string; imageRels: Array<{ relId: string; path: string; mimeType: OfficeImage["mimeType"]; bytes: Uint8Array }> } {
  const imageRels: Array<{ relId: string; path: string; mimeType: OfficeImage["mimeType"]; bytes: Uint8Array }> = [];
  const items = [...slide.items].sort((left, right) => left.zIndex - right.zIndex);
  const shapes = items.map((item, index) => {
    const id = index + 2;
    if (item.kind === "text" || item.kind === "shape") return pptxShapeXml(item, id);
    if (item.kind === "table") return pptxTableXml(item, id);
    const imageNumber = imageRels.length + 1;
    const relId = `rIdImage${imageNumber}`;
    const extension = item.mimeType === "image/png" ? "png" : "jpg";
    imageRels.push({ relId, path: `../media/image${imageNumber}.${extension}`, mimeType: item.mimeType, bytes: item.bytes });
    return pptxImageXml(item, id, relId);
  }).join("");
  return {
    tree: `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emus(slide.width)}" cy="${emus(slide.height)}"/><a:chOff x="0" y="0"/><a:chExt cx="${emus(slide.width)}" cy="${emus(slide.height)}"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree>`,
    imageRels,
  };
}

function pptxSlideXml(slide: OfficeSlide, tree: string): string {
  const background = slide.background ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${officeHex(slide.background, "FFFFFF")}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` : "";
  return xmlDocument(`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="${escapeAttr(slide.name)}">${background}${tree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
}

function safePptxThemeXml(): string {
  return xmlDocument(`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Folio"><a:themeElements><a:clrScheme name="Folio"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="0F766E"/></a:accent2><a:accent3><a:srgbClr val="D97706"/></a:accent3><a:accent4><a:srgbClr val="7C3AED"/></a:accent4><a:accent5><a:srgbClr val="DB2777"/></a:accent5><a:accent6><a:srgbClr val="0891B2"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Folio"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Folio"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`);
}

async function renderKeynoteDocumentToPptx(document: IworkDocument): Promise<Uint8Array> {
  const slides: OfficeSlide[] = document.scenes.map((scene) => ({ name: scene.name, width: scene.width, height: scene.height, items: officeItemsFromScene(scene) }));
  if (slides.length === 0 || slides.length > MAX_OFFICE_SLIDES) throw new OfficeConversionError("This Keynote document has no safe, exportable slides.");
  const first = slides[0];
  const zip = new JSZip();
  let imagePartCount = 0;
  for (const [index, slide] of slides.entries()) {
    const part = pptxShapeTreeXml(slide);
    const slidePath = `ppt/slides/slide${index + 1}.xml`;
    const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${part.imageRels.map((image) => {
      imagePartCount++;
      const target = `../media/image${imagePartCount}.${image.mimeType === "image/png" ? "png" : "jpg"}`;
      zip.file(`ppt/media/image${imagePartCount}.${image.mimeType === "image/png" ? "png" : "jpg"}`, image.bytes);
      return `<Relationship Id="${image.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;
    }).join("")}</Relationships>`;
    zip.file(slidePath, pptxSlideXml(slide, part.tree));
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, xmlDocument(rels));
  }
  const slideIds = slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rIdSlide${index + 1}"/>`).join("");
  const slideRelationships = slides.map((_, index) => `<Relationship Id="rIdSlide${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  zip.file("[Content_Types].xml", xmlDocument(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`));
  zip.file("_rels/.rels", xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPresentation" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`));
  zip.file("ppt/presentation.xml", xmlDocument(`<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${emus(first.width)}" cy="${emus(first.height)}" type="custom"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr/></p:defaultTextStyle></p:presentation>`));
  zip.file("ppt/_rels/presentation.xml.rels", xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRelationships}</Relationships>`));
  const emptyTree = `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>`;
  zip.file("ppt/slideMasters/slideMaster1.xml", xmlDocument(`<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Master">${emptyTree}</p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rIdLayout"/></p:sldLayoutIdLst><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" tx1="dk1" tx2="dk2" hlink="hlink" folHlink="folHlink"/></p:sldMaster>`));
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`));
  zip.file("ppt/slideLayouts/slideLayout1.xml", xmlDocument(`<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank">${emptyTree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`));
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`));
  zip.file("ppt/theme/theme1.xml", safePptxThemeXml());
  zip.file("docProps/core.xml", xmlDocument(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(document.title)}</dc:title></cp:coreProperties>`));
  zip.file("docProps/app.xml", xmlDocument(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Folio local converter</Application></Properties>`));
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  await validatePptxOutput(bytes, document);
  return bytes;
}

async function validatePptxOutput(bytes: Uint8Array, source: IworkDocument): Promise<void> {
  if (bytes.length === 0 || bytes.length > MAX_PPTX_OUTPUT_BYTES) throw new OfficeConversionError("Folio could not validate the Keynote PPTX output.");
  const checkedBytes = new Uint8Array(bytes.length);
  checkedBytes.set(bytes);
  const parsed = await parsePptx(new File([checkedBytes.buffer], "converted.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }));
  if (parsed.slides.length !== source.scenes.length) throw new OfficeConversionError("Folio could not validate the Keynote slide count in the PPTX output.");
  const expected = source.scenes.flatMap((scene) => scene.blocks.map((block) => block.text)).filter(Boolean).slice(0, 5);
  const text = parsed.slides.flatMap((slide) => slide.items.filter((item): item is OfficeTextBox => item.kind === "text").flatMap((item) => item.paragraphs.flatMap((paragraph) => paragraph.runs.map((run) => run.text)))).join(" ");
  if (expected.length > 0 && expected.some((value) => !text.includes(value))) throw new OfficeConversionError("Folio could not validate the Keynote text in the PPTX output.");
}

export async function keynoteToPptx(file: File): Promise<Uint8Array> {
  const document = await parseAppleForOfficeExport(file, "keynote");
  return renderKeynoteDocumentToPptx(document);
}
