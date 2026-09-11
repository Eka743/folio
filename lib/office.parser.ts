/**
 * Worker-safe bounded OOXML parser entry point.
 *
 * This file deliberately does not import the worker launcher or PDF rendering
 * code, so the browser worker has no module cycle with the public converter.
 */

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
const PPT_MAIN = "ppt/presentation.xml";
const XLS_MAIN = "xl/workbook.xml";
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
