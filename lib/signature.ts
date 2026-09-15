import { readFileBytes } from "./files";
import { loadPdfDocument, validatePdfOutput } from "./pdfOps";

export interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualSignaturePlacement {
  id: string;
  assetId: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SignatureAsset {
  id: string;
  label: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface PdfImagePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
}

export const MAX_SIGNATURE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_SIGNATURE_IMAGE_DIMENSION = 4096;
export const MAX_SIGNATURE_IMAGE_PIXELS = 16_000_000;
export const MAX_SIGNED_PDF_BYTES = 125 * 1024 * 1024;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

/**
 * Map a screen-space rectangle, whose origin is the PDF.js viewport's
 * top-left corner, into pdf-lib's user space. The image rotation cancels the
 * page rotation so the signature remains upright in the user's view.
 */
export function visualRectToPdfImagePlacement(
  page: PageBox,
  visual: Pick<VisualSignaturePlacement, "x" | "y" | "width" | "height">,
  rotation: number,
): PdfImagePlacement {
  const turn = normalizeRotation(rotation);
  const { x: pageX, y: pageY, width, height } = page;
  switch (turn) {
    case 90:
      return {
        x: pageX + visual.y + visual.height,
        y: pageY + visual.x,
        width: visual.width,
        height: visual.height,
        rotation: 90,
      };
    case 180:
      return {
        x: pageX + width - visual.x,
        y: pageY + visual.y + visual.height,
        width: visual.width,
        height: visual.height,
        rotation: 180,
      };
    case 270:
      return {
        x: pageX + width - visual.y - visual.height,
        y: pageY + height - visual.x,
        width: visual.width,
        height: visual.height,
        rotation: 270,
      };
    default:
      return {
        x: pageX + visual.x,
        y: pageY + height - visual.y - visual.height,
        width: visual.width,
        height: visual.height,
        rotation: 0,
      };
  }
}

/** Keep a dragged signature entirely inside the visible page. */
export function moveVisualSignature(
  placement: Pick<VisualSignaturePlacement, "x" | "y" | "width" | "height">,
  deltaX: number,
  deltaY: number,
  page: Pick<PageBox, "width" | "height">,
): Pick<VisualSignaturePlacement, "x" | "y" | "width" | "height"> {
  return {
    ...placement,
    x: clamp(placement.x + deltaX, 0, Math.max(0, page.width - placement.width)),
    y: clamp(placement.y + deltaY, 0, Math.max(0, page.height - placement.height)),
  };
}

/** Resize from the bottom-right handle while preserving the asset ratio. */
export function resizeVisualSignature(
  placement: Pick<VisualSignaturePlacement, "x" | "y" | "width" | "height">,
  deltaX: number,
  page: Pick<PageBox, "width" | "height">,
  aspectRatio: number,
  minWidth = 48,
): Pick<VisualSignaturePlacement, "x" | "y" | "width" | "height"> {
  const ratio = aspectRatio > 0 ? aspectRatio : placement.width / placement.height;
  const availableWidth = Math.max(0, page.width - placement.x);
  const availableHeight = Math.max(0, page.height - placement.y);
  const widthFromHeight = availableHeight * ratio;
  const maxWidth = Math.min(availableWidth, widthFromHeight);
  if (maxWidth <= 0) return placement;
  const width = clamp(
    Math.min(placement.width + deltaX, maxWidth),
    Math.min(minWidth, maxWidth),
    maxWidth,
  );
  return {
    ...placement,
    width,
    height: width / ratio,
  };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("The signature image is not valid.");
  const encoded = dataUrl.slice(comma + 1);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function hasBytes(bytes: Uint8Array, expected: number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) || bytes.length < 24) {
    return null;
  }
  const width = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16);
  const height = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20);
  return { width, height };
}

function jpegSignature(bytes: Uint8Array): boolean {
  return hasBytes(bytes, [0xff, 0xd8, 0xff]) && bytes.length >= 10;
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!jpegSignature(bytes)) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined) break;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ].includes(marker);
    if (isStartOfFrame && segmentLength >= 7) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += segmentLength;
  }
  return null;
}

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}

async function decodeSignatureImage(file: File): Promise<{
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (context, width, height) => context.drawImage(bitmap, 0, 0, width, height),
        close: () => bitmap.close(),
      };
    } catch {
      // Some WebKit builds do not decode every supported image through the
      // bitmap API, so use the same-origin object URL fallback below.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The signature image could not be decoded."));
      element.src = url;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (context, width, height) => context.drawImage(image, 0, 0, width, height),
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Decode and normalize an uploaded PNG/JPEG into a bounded transparent PNG.
 * The source bytes never leave this browser.
 */
export async function loadSignatureImage(file: File): Promise<SignatureAsset> {
  if (file.size === 0 || file.size > MAX_SIGNATURE_IMAGE_BYTES) {
    throw new Error("Choose a non-empty PNG or JPG signature image up to 10 MB.");
  }
  const bytes = await readFileBytes(file);
  const extension = extensionOf(file.name);
  const mime = file.type.toLowerCase();
  const isPng = hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpeg = jpegSignature(bytes);
  const mimeAllowed = mime === "" || mime === "image/png" || mime === "image/jpeg" || mime === "image/jpg";
  const extensionAllowed = extension === "png" || extension === "jpg" || extension === "jpeg";
  if (!mimeAllowed || !extensionAllowed || (!isPng && !isJpeg)) {
    throw new Error("Choose a valid PNG or JPG signature image.");
  }
  if ((isPng && mime === "image/jpeg") || (isJpeg && mime === "image/png")) {
    throw new Error("The signature image type does not match its contents.");
  }

  const headerDimensions = isPng ? pngDimensions(bytes) : jpegDimensions(bytes);
  if (headerDimensions && (headerDimensions.width < 1 || headerDimensions.height < 1)) {
    throw new Error("The signature image has invalid dimensions.");
  }
  if (headerDimensions && (
    headerDimensions.width > MAX_SIGNATURE_IMAGE_DIMENSION ||
    headerDimensions.height > MAX_SIGNATURE_IMAGE_DIMENSION ||
    headerDimensions.width * headerDimensions.height > MAX_SIGNATURE_IMAGE_PIXELS
  )) {
    throw new Error("The signature image is too large to use safely.");
  }

  const decoded = await decodeSignatureImage(file);
  try {
    if (
      decoded.width < 1 ||
      decoded.height < 1 ||
      decoded.width > MAX_SIGNATURE_IMAGE_DIMENSION ||
      decoded.height > MAX_SIGNATURE_IMAGE_DIMENSION ||
      decoded.width * decoded.height > MAX_SIGNATURE_IMAGE_PIXELS
    ) {
      throw new Error("The signature image is too large to use safely.");
    }
    const scale = Math.min(1, 1600 / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the signature image.");
    context.clearRect(0, 0, width, height);
    decoded.draw(context, width, height);
    return {
      id: "",
      label: file.name || "Uploaded signature",
      dataUrl: canvas.toDataURL("image/png"),
      width,
      height,
    };
  } finally {
    decoded.close();
  }
}

async function countImageXObjects(document: import("pdf-lib").PDFDocument): Promise<number> {
  // These are stable pdf-lib core APIs. Counting resource entries after the
  // write proves the visual overlays were embedded, not merely that the PDF
  // parser accepted the output.
  const { PDFDict, PDFName } = await import("pdf-lib");
  return document.getPages().reduce((total, page) => {
    const resources = page.node.Resources();
    const xObjects = resources?.lookupMaybe(PDFName.XObject, PDFDict);
    return total + (xObjects?.keys().length ?? 0);
  }, 0);
}

/** Add visual signature images without rasterizing the original PDF pages. */
export async function signPdf(
  source: File | Uint8Array,
  assets: readonly SignatureAsset[],
  placements: readonly VisualSignaturePlacement[],
): Promise<Uint8Array> {
  if (placements.length === 0) throw new Error("Place at least one signature before downloading.");
  const sourceBytes = source instanceof Uint8Array
    ? new Uint8Array(source)
    : await readFileBytes(source);
  const document = await loadPdfDocument(sourceBytes);
  const pages = document.getPages();
  const baselineXObjects = await countImageXObjects(document);
  const embedded = new Map<string, import("pdf-lib").PDFImage>();
  const { degrees } = await import("pdf-lib");

  for (const placement of placements) {
    const page = pages[placement.pageIndex];
    const asset = assets.find((candidate) => candidate.id === placement.assetId);
    if (!page || !asset) throw new Error("A signature placement is no longer available.");
    if (
      !Number.isFinite(placement.x) ||
      !Number.isFinite(placement.y) ||
      !Number.isFinite(placement.width) ||
      !Number.isFinite(placement.height) ||
      placement.width <= 0 ||
      placement.height <= 0
    ) {
      throw new Error("A signature placement is invalid.");
    }
    let image = embedded.get(asset.id);
    if (!image) {
      image = await document.embedPng(dataUrlToBytes(asset.dataUrl));
      embedded.set(asset.id, image);
    }
    const cropBox = page.getCropBox();
    const pdfPlacement = visualRectToPdfImagePlacement(
      cropBox,
      placement,
      page.getRotation().angle,
    );
    page.drawImage(image, {
      x: pdfPlacement.x,
      y: pdfPlacement.y,
      width: pdfPlacement.width,
      height: pdfPlacement.height,
      rotate: degrees(pdfPlacement.rotation),
    });
  }

  const output = await document.save({ useObjectStreams: true });
  if (output.length > MAX_SIGNED_PDF_BYTES) {
    throw new Error("The signed PDF is too large to prepare safely in this browser.");
  }
  const validated = await validatePdfOutput(output, pages.length);
  const reopened = await loadPdfDocument(validated);
  if ((await countImageXObjects(reopened)) < baselineXObjects + placements.length) {
    throw new Error("Folio could not validate the embedded signatures.");
  }
  return validated;
}
