"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  PrimaryButton,
  SecondaryButton,
  StatusBox,
} from "@/components/tool-ui";
import { describeError } from "@/lib/errors";
import { readFileBytes } from "@/lib/files";
import {
  loadSignatureImage,
  moveVisualSignature,
  resizeVisualSignature,
  signPdf,
  type PageBox,
  type SignatureAsset,
  type VisualSignaturePlacement,
} from "@/lib/signature";

type CreatorMode = "draw" | "type" | "upload";
type InteractionMode = "move" | "resize";

interface PageInfo {
  pageNumber: number;
  box: PageBox;
  rotation: 0 | 90 | 180 | 270;
  visualWidth: number;
  visualHeight: number;
}

interface Interaction {
  mode: InteractionMode;
  placementId: string;
  pointerX: number;
  pointerY: number;
  placement: VisualSignaturePlacement;
}

const PDF_WORKER_SRC = "/pdf.worker.min.mjs";
const DRAW_CANVAS_WIDTH = 900;
const DRAW_CANVAS_HEIGHT = 320;
const MIN_SIGNATURE_WIDTH = 48;

const SIGNATURE_STYLES = [
  {
    id: "classic",
    label: "Classic",
    family: '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',
    weight: "400",
  },
  {
    id: "formal",
    label: "Formal",
    family: '"Apple Chancery", "URW Chancery L", cursive',
    weight: "400",
  },
  {
    id: "clean",
    label: "Clean",
    family: '"Segoe Script", "Comic Sans MS", cursive',
    weight: "500",
  },
] as const;

let signatureId = 0;
function nextSignatureId(prefix: string): string {
  signatureId += 1;
  return `${prefix}-${Date.now().toString(36)}-${signatureId}`;
}

function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}

function pageBoxFromView(view: readonly number[]): PageBox {
  return {
    x: Math.min(view[0] ?? 0, view[2] ?? 0),
    y: Math.min(view[1] ?? 0, view[3] ?? 0),
    width: Math.abs((view[2] ?? 0) - (view[0] ?? 0)),
    height: Math.abs((view[3] ?? 0) - (view[1] ?? 0)),
  };
}

function canvasToAsset(canvas: HTMLCanvasElement, label: string): SignatureAsset {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not read the drawn signature.");
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (image.data[(y * canvas.width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left || bottom < top) {
    throw new Error("Draw a signature before using it.");
  }
  const padding = Math.min(28, Math.max(8, Math.round(Math.min(canvas.width, canvas.height) * 0.03)));
  const cropLeft = Math.max(0, left - padding);
  const cropTop = Math.max(0, top - padding);
  const cropRight = Math.min(canvas.width, right + padding + 1);
  const cropBottom = Math.min(canvas.height, bottom + padding + 1);
  const output = document.createElement("canvas");
  output.width = cropRight - cropLeft;
  output.height = cropBottom - cropTop;
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("This browser could not prepare the signature.");
  outputContext.putImageData(
    context.getImageData(cropLeft, cropTop, output.width, output.height),
    0,
    0,
  );
  return {
    id: "",
    label,
    dataUrl: output.toDataURL("image/png"),
    width: output.width,
    height: output.height,
  };
}

function typedSignatureAsset(name: string, styleId: string): SignatureAsset {
  const style = SIGNATURE_STYLES.find((candidate) => candidate.id === styleId) ?? SIGNATURE_STYLES[0];
  const canvas = document.createElement("canvas");
  const measureContext = canvas.getContext("2d");
  if (!measureContext) throw new Error("This browser could not prepare the typed signature.");
  measureContext.font = `italic ${style.weight} 116px ${style.family}`;
  const textWidth = Math.ceil(measureContext.measureText(name).width);
  canvas.width = Math.min(1600, Math.max(440, textWidth + 72));
  canvas.height = 190;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the typed signature.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#101418";
  context.font = `italic ${style.weight} 116px ${style.family}`;
  context.textBaseline = "middle";
  context.fillText(name, 32, canvas.height / 2 + 4);
  return canvasToAsset(canvas, name);
}

function visualPageSize(page: PageInfo): Pick<PageBox, "width" | "height"> {
  return { width: page.visualWidth, height: page.visualHeight };
}

export function SignPdfWorkspace({
  file,
  onStartOver,
}: {
  file: File;
  onStartOver: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const sourceBytesRef = useRef<Uint8Array | null>(null);
  const pageInfoCacheRef = useRef<Map<number, PageInfo>>(new Map());
  const interactionRef = useRef<Interaction | null>(null);
  const drawingRef = useRef(false);
  const drawPointRef = useRef<{ x: number; y: number } | null>(null);
  const mountedRef = useRef(true);

  const [pdfStatus, setPdfStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [assets, setAssets] = useState<SignatureAsset[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<VisualSignaturePlacement[]>([]);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [creatorMode, setCreatorMode] = useState<CreatorMode>("draw");
  const [drawHasInk, setDrawHasInk] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [typedStyle, setTypedStyle] = useState<string>(SIGNATURE_STYLES[0].id);
  const [creatorBusy, setCreatorBusy] = useState(false);
  const [creatorError, setCreatorError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const displayScale = Math.min(1.6, Math.max(0.35, fitScale * zoomFactor));
  const currentPlacements = useMemo(
    () => placements.filter((placement) => placement.pageIndex === currentPage - 1),
    [currentPage, placements],
  );
  const activeAsset = assets.find((asset) => asset.id === activeAssetId) ?? assets[0] ?? null;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pageCache = pageInfoCacheRef.current;
    let loadingTask: import("pdfjs-dist").PDFDocumentLoadingTask | null = null;

    async function openPdf() {
      try {
        setPdfStatus("loading");
        setPageLoading(true);
        setPdfError(null);
        const bytes = await readFileBytes(file);
        if (cancelled) return;
        const sourceCopy = new Uint8Array(bytes.length);
        sourceCopy.set(bytes);
        const pdfjs = await import("pdfjs-dist");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
        const renderCopy = new Uint8Array(sourceCopy.length);
        renderCopy.set(sourceCopy);
        loadingTask = pdfjs.getDocument({ data: renderCopy });
        const document = await loadingTask.promise;
        if (cancelled) {
          await document.destroy();
          return;
        }
        pdfRef.current = document;
        sourceBytesRef.current = sourceCopy;
        pageCache.clear();
        setPageCount(document.numPages);
        setCurrentPage(1);
        setPdfStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        console.error("Sign PDF preview failed", cause);
        const described = describeError(cause, "We couldn't open this PDF for signing. Choose another PDF and try again.");
        setPdfError(described.message);
        setPdfStatus("error");
      }
    }

    void openPdf();
    return () => {
      cancelled = true;
      sourceBytesRef.current = null;
      pageCache.clear();
      const document = pdfRef.current;
      pdfRef.current = null;
      if (document) void document.destroy();
      if (loadingTask) void loadingTask.destroy();
    };
  }, [file]);

  const loadPageInfo = useCallback(async (pageNumber: number): Promise<PageInfo> => {
    const cached = pageInfoCacheRef.current.get(pageNumber);
    if (cached) return cached;
    const document = pdfRef.current;
    if (!document) throw new Error("The PDF preview is not ready.");
    const page = await document.getPage(pageNumber);
    try {
      const box = pageBoxFromView(page.view);
      const rotation = normalizeRotation(page.rotate);
      const viewport = page.getViewport({ scale: 1, rotation });
      const info: PageInfo = {
        pageNumber,
        box,
        rotation,
        visualWidth: viewport.width,
        visualHeight: viewport.height,
      };
      pageInfoCacheRef.current.set(pageNumber, info);
      return info;
    } finally {
      page.cleanup();
    }
  }, []);

  useEffect(() => {
    if (pdfStatus !== "ready") return;
    let active = true;
    void loadPageInfo(currentPage)
      .then((info) => {
        if (!active) return;
        setPdfError(null);
        setPageInfo(info);
        setPageLoading(false);
      })
      .catch((cause) => {
        if (!active) return;
        console.error("Sign PDF page preview failed", cause);
        setPdfError("We couldn't render this PDF page. Try another page or choose a different PDF.");
        setPageLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentPage, loadPageInfo, pdfStatus]);

  useEffect(() => {
    if (!viewportRef.current || !pageInfo) return;
    const updateFit = () => {
      const available = Math.max(240, viewportRef.current!.clientWidth - 32);
      setFitScale(Math.min(1, available / Math.max(1, pageInfo.visualWidth)));
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [pageInfo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const document = pdfRef.current;
    if (!canvas || !document || !pageInfo) return;
    let active = true;
    let renderTask: ReturnType<import("pdfjs-dist").PDFPageProxy["render"]> | null = null;
    setPageLoading(true);

    void document.getPage(pageInfo.pageNumber).then((page) => {
      if (!active) {
        page.cleanup();
        return;
      }
      const viewport = page.getViewport({ scale: displayScale, rotation: pageInfo.rotation });
      const deviceScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      canvas.width = Math.max(1, Math.ceil(viewport.width * deviceScale));
      canvas.height = Math.max(1, Math.ceil(viewport.height * deviceScale));
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("This browser could not render the PDF page.");
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, viewport.width, viewport.height);
      renderTask = page.render({ canvasContext: context, viewport });
      return renderTask.promise.finally(() => page.cleanup());
    }).then(() => {
      if (active) setPageLoading(false);
    }).catch((cause) => {
      if (!active || (cause instanceof Error && cause.name === "RenderingCancelledException")) return;
      console.error("Sign PDF page render failed", cause);
      setPdfError("We couldn't render this PDF page. Try another page or choose a different PDF.");
      setPageLoading(false);
    });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [displayScale, pageInfo]);

  const addAssetAndPlace = useCallback((asset: SignatureAsset) => {
    if (!pageInfo) return;
    const id = nextSignatureId("signature");
    const stored = { ...asset, id };
    const width = Math.min(190, Math.max(100, pageInfo.visualWidth * 0.32));
    const height = width * (stored.height / Math.max(1, stored.width));
    const placement: VisualSignaturePlacement = {
      id: nextSignatureId("placement"),
      assetId: id,
      pageIndex: pageInfo.pageNumber - 1,
      x: Math.max(12, pageInfo.visualWidth - width - 36),
      y: Math.max(12, pageInfo.visualHeight - height - 36),
      width,
      height,
    };
    setAssets((previous) => [...previous, stored]);
    setActiveAssetId(id);
    setPlacements((previous) => [...previous, placement]);
    setSelectedPlacementId(placement.id);
    setCreatorError(null);
  }, [pageInfo]);

  const placeAsset = useCallback((asset: SignatureAsset) => {
    if (!pageInfo) return;
    const width = Math.min(190, Math.max(100, pageInfo.visualWidth * 0.32));
    const height = width * (asset.height / Math.max(1, asset.width));
    const placement: VisualSignaturePlacement = {
      id: nextSignatureId("placement"),
      assetId: asset.id,
      pageIndex: pageInfo.pageNumber - 1,
      x: Math.max(12, pageInfo.visualWidth - width - 36),
      y: Math.max(12, pageInfo.visualHeight - height - 36),
      width,
      height,
    };
    setActiveAssetId(asset.id);
    setPlacements((previous) => [...previous, placement]);
    setSelectedPlacementId(placement.id);
  }, [pageInfo]);

  const clearDrawing = useCallback(() => {
    const canvas = drawCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setDrawHasInk(false);
    setCreatorError(null);
  }, []);

  const useDrawing = useCallback(() => {
    try {
      if (!drawCanvasRef.current) throw new Error("The drawing canvas is not ready.");
      addAssetAndPlace(canvasToAsset(drawCanvasRef.current, "Drawn signature"));
    } catch (cause) {
      setCreatorError(describeError(cause, "Draw your signature before using it.").message);
    }
  }, [addAssetAndPlace]);

  const useTyped = useCallback(() => {
    const name = typedName.trim();
    if (!name) {
      setCreatorError("Enter a name before using the typed signature.");
      return;
    }
    try {
      addAssetAndPlace(typedSignatureAsset(name, typedStyle));
    } catch (cause) {
      setCreatorError(describeError(cause, "We couldn't prepare that signature.").message);
    }
  }, [addAssetAndPlace, typedName, typedStyle]);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadSignature = useCallback(async (fileToRead: File | undefined) => {
    if (!fileToRead) return;
    setCreatorBusy(true);
    setCreatorError(null);
    try {
      const asset = await loadSignatureImage(fileToRead);
      addAssetAndPlace(asset);
    } catch (cause) {
      console.error("Sign PDF image signature failed", cause);
      setCreatorError(describeError(cause, "We couldn't use that image. Choose a valid PNG or JPG and try again.").message);
    } finally {
      setCreatorBusy(false);
    }
  }, [addAssetAndPlace]);

  const removePlacement = useCallback((placementId: string) => {
    setPlacements((previous) => previous.filter((placement) => placement.id !== placementId));
    setSelectedPlacementId((selected) => selected === placementId ? null : selected);
  }, []);

  const removeAsset = useCallback((assetId: string) => {
    setAssets((previous) => previous.filter((asset) => asset.id !== assetId));
    setPlacements((previous) => previous.filter((placement) => placement.assetId !== assetId));
    setActiveAssetId((active) => active === assetId ? null : active);
    setSelectedPlacementId(null);
  }, []);

  const placeExistingAsset = useCallback((asset: SignatureAsset) => {
    placeAsset(asset);
  }, [placeAsset]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>, placement: VisualSignaturePlacement, mode: InteractionMode) => {
    if (!pageInfo || exportBusy) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedPlacementId(placement.id);
    interactionRef.current = {
      mode,
      placementId: placement.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      placement,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [exportBusy, pageInfo]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || !pageInfo) return;
    event.preventDefault();
    const deltaX = (event.clientX - interaction.pointerX) / displayScale;
    const deltaY = (event.clientY - interaction.pointerY) / displayScale;
    const bounds = visualPageSize(pageInfo);
    setPlacements((previous) => previous.map((placement) => {
      if (placement.id !== interaction.placementId) return placement;
      if (interaction.mode === "resize") {
        const asset = assets.find((candidate) => candidate.id === placement.assetId);
        const ratio = asset ? asset.width / Math.max(1, asset.height) : placement.width / Math.max(1, placement.height);
        return {
          ...placement,
          ...resizeVisualSignature(interaction.placement, deltaX, bounds, ratio, MIN_SIGNATURE_WIDTH),
        };
      }
      return {
        ...placement,
        ...moveVisualSignature(interaction.placement, deltaX, deltaY, bounds),
      };
    }));
  }, [assets, displayScale, pageInfo]);

  const endPointerInteraction = useCallback(() => {
    interactionRef.current = null;
  }, []);

  const handlePlacementKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>, placement: VisualSignaturePlacement) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removePlacement(placement.id);
      return;
    }
    const step = event.shiftKey ? 10 : 2;
    const delta = event.key === "ArrowLeft"
      ? { x: -step, y: 0 }
      : event.key === "ArrowRight"
        ? { x: step, y: 0 }
        : event.key === "ArrowUp"
          ? { x: 0, y: -step }
          : event.key === "ArrowDown"
            ? { x: 0, y: step }
            : null;
    if (!delta || !pageInfo) return;
    event.preventDefault();
    setPlacements((previous) => previous.map((candidate) => candidate.id === placement.id
      ? { ...candidate, ...moveVisualSignature(candidate, delta.x, delta.y, visualPageSize(pageInfo)) }
      : candidate));
  }, [pageInfo, removePlacement]);

  const beginDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    const bounds = canvas.getBoundingClientRect();
    const point = {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
    context.strokeStyle = "#101418";
    context.lineWidth = 7;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawingRef.current = true;
    drawPointRef.current = point;
    setDrawHasInk(true);
  }, []);

  const continueDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !drawingRef.current) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const point = {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
    const previous = drawPointRef.current;
    if (previous) {
      const midpoint = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };
      context.quadraticCurveTo(previous.x, previous.y, midpoint.x, midpoint.y);
      context.stroke();
      context.beginPath();
      context.moveTo(midpoint.x, midpoint.y);
    }
    drawPointRef.current = point;
  }, []);

  const endDrawing = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    drawPointRef.current = null;
    drawCanvasRef.current?.getContext("2d")?.closePath();
  }, []);

  const cancelDraft = useCallback(() => {
    clearDrawing();
    setTypedName("");
    setCreatorError(null);
  }, [clearDrawing]);

  const exportSignedPdf = useCallback(async () => {
    if (!sourceBytesRef.current || placements.length === 0 || exportBusy) return;
    setExportBusy(true);
    setExportError(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
    try {
      const bytes = await signPdf(sourceBytesRef.current, assets, placements);
      if (!mountedRef.current) return;
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      const url = URL.createObjectURL(new Blob([copy], { type: "application/pdf" }));
      setDownloadUrl(url);
    } catch (cause) {
      console.error("Sign PDF export failed", cause);
      setExportError(describeError(cause, "We couldn't prepare the signed PDF. Check the file and try again.").message);
    } finally {
      setExportBusy(false);
    }
  }, [assets, downloadUrl, exportBusy, placements]);

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  const signedFileName = `${file.name.replace(/\.pdf$/i, "") || "folio-document"}-signed.pdf`;

  if (pdfStatus === "error") {
    return (
      <div className="mt-8 space-y-4" data-sign-pdf-workspace="true">
        <StatusBox kind="error">{pdfError ?? "We couldn't open this PDF for signing."}</StatusBox>
        <SecondaryButton onClick={onStartOver}>Start over</SecondaryButton>
      </div>
    );
  }

  return (
    <section className="mt-8 space-y-5" data-sign-pdf-workspace="true" aria-busy={pdfStatus === "loading" || exportBusy}>
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight text-ink-950 focus-visible:outline-none">
            Sign your PDF
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-500">
            Add your signature visually to the document. Everything stays in your browser.
          </p>
        </div>
        <SecondaryButton onClick={onStartOver} disabled={exportBusy}>Start over</SecondaryButton>
      </div>

      {pdfError && <StatusBox kind="error">{pdfError}</StatusBox>}

      {pdfStatus === "loading" && (
        <StatusBox kind="info">Opening the PDF locally…</StatusBox>
      )}

      {pdfStatus === "ready" && pageInfo && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-paper shadow-[0_1px_2px_rgba(16,20,24,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2" role="group" aria-label="Page navigation">
                <SecondaryButton
                  onClick={() => { setPageLoading(true); setCurrentPage((page) => Math.max(1, page - 1)); setSelectedPlacementId(null); }}
                  disabled={currentPage <= 1 || pageLoading || exportBusy}
                  aria-label="Previous page"
                  className="min-h-10 px-3"
                >
                  ←
                </SecondaryButton>
                <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
                  <span className="sr-only">Page number</span>
                  <select
                    value={currentPage}
                    onChange={(event) => { setPageLoading(true); setCurrentPage(Number(event.target.value)); setSelectedPlacementId(null); }}
                    disabled={pageLoading || exportBusy}
                    aria-label="Page number"
                    className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-ink-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600"
                  >
                    {Array.from({ length: pageCount }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                  </select>
                  <span>of {pageCount}</span>
                </label>
                <SecondaryButton
                  onClick={() => { setPageLoading(true); setCurrentPage((page) => Math.min(pageCount, page + 1)); setSelectedPlacementId(null); }}
                  disabled={currentPage >= pageCount || pageLoading || exportBusy}
                  aria-label="Next page"
                  className="min-h-10 px-3"
                >
                  →
                </SecondaryButton>
              </div>
              <div className="flex items-center gap-2" role="group" aria-label="Zoom controls">
                <SecondaryButton onClick={() => setZoomFactor((zoom) => Math.max(0.65, zoom - 0.15))} disabled={exportBusy} aria-label="Zoom out" className="min-h-10 min-w-10 px-2">−</SecondaryButton>
                <button type="button" onClick={() => setZoomFactor(1)} className="min-w-16 rounded-lg px-2 py-2 text-sm font-medium text-ink-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600" aria-label="Fit page to viewer">
                  {Math.round(displayScale * 100)}%
                </button>
                <SecondaryButton onClick={() => setZoomFactor((zoom) => Math.min(2, zoom + 0.15))} disabled={exportBusy} aria-label="Zoom in" className="min-h-10 min-w-10 px-2">+</SecondaryButton>
              </div>
            </div>

            <div ref={viewportRef} className="max-h-[min(72vh,52rem)] overflow-auto bg-slate-100 p-4 sm:p-6" data-sign-pdf-viewer>
              <div
                ref={pageShellRef}
                className="relative mx-auto bg-white shadow-[0_8px_30px_rgba(16,20,24,0.16)]"
                style={{ width: pageInfo.visualWidth * displayScale, height: pageInfo.visualHeight * displayScale }}
                onPointerMove={handlePointerMove}
                onPointerUp={endPointerInteraction}
                onPointerCancel={endPointerInteraction}
              >
                <canvas ref={canvasRef} className="pointer-events-none block" aria-hidden="true" />
                {currentPlacements.map((placement) => {
                  const asset = assets.find((candidate) => candidate.id === placement.assetId);
                  if (!asset) return null;
                  const selected = selectedPlacementId === placement.id;
                  return (
                    <div
                      key={placement.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={`Signature on page ${currentPage}. Use arrow keys to move it, or Delete to remove it.`}
                      data-signature-placement="true"
                      className={`absolute touch-none select-none border-2 ${selected ? "border-accent-600 bg-accent-50/10" : "border-transparent hover:border-accent-300"}`}
                      style={{
                        left: placement.x * displayScale,
                        top: placement.y * displayScale,
                        width: placement.width * displayScale,
                        height: placement.height * displayScale,
                      }}
                      onPointerDown={(event) => handlePointerDown(event, placement, "move")}
                      onClick={(event) => { event.stopPropagation(); setSelectedPlacementId(placement.id); }}
                      onKeyDown={(event) => handlePlacementKeyDown(event, placement)}
                    >
                      <img src={asset.dataUrl} alt="" draggable={false} className="pointer-events-none h-full w-full object-contain" />
                      {selected && (
                        <>
                          <button
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => { event.stopPropagation(); removePlacement(placement.id); }}
                            aria-label={`Remove signature from page ${currentPage}`}
                            className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-base leading-none text-ink-900 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                          >
                            ×
                          </button>
                          <button
                            type="button"
                            onPointerDown={(event) => handlePointerDown(event, placement, "resize")}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Resize signature on page ${currentPage}`}
                            className="absolute -bottom-2 -right-2 h-5 w-5 cursor-se-resize rounded-sm border-2 border-accent-600 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                          />
                        </>
                      )}
                    </div>
                  );
                })}
                {pageLoading && <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-sm font-medium text-ink-700">Rendering page…</div>}
              </div>
            </div>
            <p className="border-t border-slate-200 px-4 py-3 text-xs leading-relaxed text-ink-500">
              Select a signature to move it. Drag the corner to resize. Arrow keys move a selected signature by small steps.
            </p>
          </div>

          <aside className="min-w-0 space-y-4" aria-label="Signature tools">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,20,24,0.04)]">
              <h3 className="text-base font-semibold text-ink-950">Add a signature</h3>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Signature creation method">
                {(["draw", "type", "upload"] as CreatorMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={creatorMode === mode}
                    onClick={() => { setCreatorMode(mode); setCreatorError(null); }}
                    className={`rounded-lg px-2 py-2 text-sm font-medium capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 ${creatorMode === mode ? "bg-white text-ink-950 shadow-sm" : "text-ink-500 hover:text-ink-900"}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {creatorMode === "draw" && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-ink-500">Draw with a mouse, trackpad, or touch.</p>
                  <canvas
                    ref={drawCanvasRef}
                    width={DRAW_CANVAS_WIDTH}
                    height={DRAW_CANVAS_HEIGHT}
                    aria-label="Draw your signature"
                    className="block aspect-[2.8] w-full touch-none rounded-xl border border-slate-300 bg-white"
                    onPointerDown={beginDrawing}
                    onPointerMove={continueDrawing}
                    onPointerUp={endDrawing}
                    onPointerCancel={endDrawing}
                    onPointerLeave={endDrawing}
                  />
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton onClick={clearDrawing} disabled={!drawHasInk || creatorBusy} className="min-h-10 px-3">Clear</SecondaryButton>
                    <SecondaryButton onClick={cancelDraft} disabled={creatorBusy} className="min-h-10 px-3">Cancel</SecondaryButton>
                    <PrimaryButton onClick={useDrawing} disabled={!drawHasInk || creatorBusy} className="min-h-10 px-3">Use signature</PrimaryButton>
                  </div>
                </div>
              )}

              {creatorMode === "type" && (
                <div className="mt-4 space-y-3">
                  <label htmlFor="sign-pdf-name" className="block text-sm font-medium text-ink-900">Your name</label>
                  <input id="sign-pdf-name" value={typedName} onChange={(event) => setTypedName(event.target.value)} maxLength={80} placeholder="Type your name" autoComplete="name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base text-ink-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600" />
                  <div className="grid gap-2" role="group" aria-label="Signature style">
                    {SIGNATURE_STYLES.map((style) => (
                      <button key={style.id} type="button" onClick={() => setTypedStyle(style.id)} aria-pressed={typedStyle === style.id} className={`rounded-xl border px-3 py-2 text-left text-2xl text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 ${typedStyle === style.id ? "border-accent-600 bg-accent-50" : "border-slate-200 hover:bg-slate-50"}`} style={{ fontFamily: style.family, fontWeight: style.weight, fontStyle: "italic" }}>
                        {typedName || "Your signature"}
                      </button>
                    ))}
                  </div>
                  <PrimaryButton onClick={useTyped} disabled={!typedName.trim() || creatorBusy} className="min-h-10 px-3">Use signature</PrimaryButton>
                </div>
              )}

              {creatorMode === "upload" && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm leading-relaxed text-ink-500">Use a PNG or JPG. Transparent PNG backgrounds are preserved.</p>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    aria-label="Upload signature image"
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      event.target.value = "";
                      void uploadSignature(selected);
                    }}
                  />
                  <SecondaryButton onClick={() => { if (uploadInputRef.current) { uploadInputRef.current.value = ""; uploadInputRef.current.click(); } }} disabled={creatorBusy} className="w-full">{creatorBusy ? "Preparing image…" : "Choose PNG or JPG"}</SecondaryButton>
                </div>
              )}

              {creatorError && <div className="mt-3"><StatusBox kind="error">{creatorError}</StatusBox></div>}
            </div>

            {assets.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,20,24,0.04)]">
                <h3 className="text-base font-semibold text-ink-950">Your signatures</h3>
                <p className="mt-1 text-sm text-ink-500">Keep using one across pages, or add another.</p>
                <div className="mt-3 space-y-2">
                  {assets.map((asset) => (
                    <div key={asset.id} className={`flex items-center gap-2 rounded-xl border p-2 ${activeAsset?.id === asset.id ? "border-accent-600 bg-accent-50/50" : "border-slate-200"}`}>
                      <img src={asset.dataUrl} alt="" className="h-10 min-w-0 flex-1 object-contain object-left" />
                      <button type="button" onClick={() => placeExistingAsset(asset)} aria-label={`Place ${asset.label} again`} disabled={pageLoading || exportBusy} className="min-h-10 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-ink-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 disabled:cursor-not-allowed disabled:opacity-50">Place again</button>
                      <button type="button" onClick={() => removeAsset(asset.id)} aria-label={`Remove ${asset.label}`} className="min-h-10 min-w-10 rounded-lg px-2 text-lg text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {pdfStatus === "ready" && (
        <div className="space-y-3 border-t border-slate-200 pt-5">
          {exportError && <StatusBox kind="error">{exportError}</StatusBox>}
          {downloadUrl && (
            <StatusBox kind="success">
              <p className="font-medium">Your signed PDF is ready.</p>
              <p className="mt-1">The original pages and content were preserved. This is a visual signature, not a certificate-based digital signature.</p>
              <a href={downloadUrl} download={signedFileName} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2">Download {signedFileName}</a>
            </StatusBox>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500">{placements.length === 0 ? "Place at least one signature to continue." : `${placements.length} signature${placements.length === 1 ? "" : "s"} placed`}</p>
            <PrimaryButton onClick={exportSignedPdf} disabled={placements.length === 0 || exportBusy || pageLoading}>
              {exportBusy ? "Preparing PDF…" : "Finish & download"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </section>
  );
}
