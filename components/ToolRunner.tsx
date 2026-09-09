"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dropzone, FileList, type ListedFile } from "@/components/Dropzone";
import { EngineBadge, HelperBanner } from "@/components/HelperBanner";
import { useHelper } from "@/components/useHelper";
import {
  FieldLabel,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  StatusBox,
  ToolHeader,
} from "@/components/tool-ui";
import {
  formatBytes,
  formatPercentChange,
  safeFileName,
  validateFiles,
  withExtension,
} from "@/lib/files";
import {
  appMissingMessage,
  base64ToBytes,
  convertViaHelper,
  extensionOf,
  helperErrorMessage,
  isMacPlatform,
  resolveConversionRoute,
} from "@/lib/helper";
import { parsePageRanges, summarizePages } from "@/lib/pageRanges";
import type { RotationDegrees } from "@/lib/pdfOpsTypes";
import type { FolioTool, ToolSlug } from "@/lib/tools";
import { getConversion } from "@/lib/formatMatrix";

let idCounter = 0;
function nextId(): string {
  idCounter++;
  return `f-${Date.now().toString(36)}-${idCounter}`;
}

type Result =
  | { kind: "file"; fileName: string; sizeBytes: number; note?: string }
  | { kind: "compress"; fileName: string; before: number; after: number }
  | { kind: "images"; pages: Array<{ page: number; url: string; size: number }> }
  | null;

const HELPER_TOOLS: ToolSlug[] = [
  "word-to-pdf",
  "pages-to-pdf",
  "pages-to-word",
  "powerpoint-to-pdf",
  "keynote-to-pdf",
  "keynote-to-powerpoint",
  "excel-to-pdf",
  "numbers-to-pdf",
  "numbers-to-excel",
];

export function ToolRunner({ tool }: { tool: FolioTool }) {
  const [files, setFiles] = useState<ListedFile[]>([]);
  const [complaints, setComplaints] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<string | null>(null);

  // Per-tool options
  const [rangeText, setRangeText] = useState("1-3,5");
  const [rotateMode, setRotateMode] = useState<"all" | "pages">("all");
  const [degrees, setDegrees] = useState<RotationDegrees>(90);
  const [zipMeta, setZipMeta] = useState<{ name: string; size: number } | null>(null);
  // Hybrid DOCX tool: user picks engine when both are available.
  const [helperChoice, setHelperChoice] = useState<"auto" | "browser" | "mac">(
    "auto",
  );

  const { state: helperState, refresh: refreshHelper, isMac } = useHelper();
  const needsHelper =
    tool.processing === "mac-helper" || tool.processing === "hybrid";
  const matrixConversion = tool.conversionId
    ? getConversion(tool.conversionId)
    : undefined;

  const fileObjs = useMemo(() => files.map((f) => f.file), [files]);

  // Single registry for every object URL this component creates, so cleanup
  // never depends on stale state closures or double-revokes.
  const urlsRef = useRef<Set<string>>(new Set());
  const trackUrl = useCallback((url: string): string => {
    urlsRef.current.add(url);
    return url;
  }, []);
  const revokeAllUrls = useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current.clear();
  }, []);

  // Revoke any remaining object URLs on unmount only.
  useEffect(() => {
    const registry = urlsRef.current;
    return () => {
      for (const url of registry) URL.revokeObjectURL(url);
      registry.clear();
    };
  }, []);

  const resetResults = useCallback(() => {
    revokeAllUrls();
    setResultUrl(null);
    setResult(null);
    setError(null);
    setZipMeta(null);
    setEngineUsed(null);
  }, [revokeAllUrls]);

  function blobUrl(bytes: Uint8Array, mime: string): string {
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return trackUrl(URL.createObjectURL(new Blob([copy], { type: mime })));
  }

  const addFiles = useCallback(
    (incoming: File[]) => {
      setError(null);
      const { accepted, complaints: found } = validateFiles(
        tool,
        incoming,
        files.length,
      );
      if (accepted.length > 0) {
        const listed = accepted.map((file) => ({ file, id: nextId() }));
        setFiles((prev) =>
          tool.multiple ? [...prev, ...listed] : listed.slice(0, 1),
        );
        resetResults();
      }
      setComplaints(found.map((c) => `${c.fileName}: ${c.reason}`));
    },
    [tool, files.length, resetResults],
  );

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== id));
      resetResults();
    },
    [resetResults],
  );

  const moveFile = useCallback((id: string, dir: -1 | 1) => {
    setFiles((prev) => {
      const i = prev.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const startOver = useCallback(() => {
    resetResults();
    setFiles([]);
    setComplaints([]);
  }, [resetResults]);

  /** Run a conversion through Folio for Mac and materialize the download. */
  async function runHelperConversion(
    file: File,
    from: string,
    to: string,
    outExt: string,
    outMime: string,
  ): Promise<void> {
    const appName =
      from === "pages"
        ? "Pages"
        : from === "numbers"
          ? "Numbers"
          : null;
    setProgress(
      appName
        ? `Folio needs permission to ask ${appName} to export this document. The document stays on this Mac.`
        : "Connecting to Folio for Mac…",
    );
    let res: Awaited<ReturnType<typeof convertViaHelper>>;
    try {
      res = await convertViaHelper({
        from,
        to,
        file,
        permissionMessage: appName
          ? `Folio needs permission to ask ${appName} to export this document. The document stays on this Mac.`
          : undefined,
        onProgress: (stage) => setProgress(stage),
      });
    } catch (conversionError) {
      // A helper can become ready while this page is open, or it can restart
      // after a native app permission change. The hook's polling will recover;
      // this immediate refresh makes the next state actionable as well.
      refreshHelper();
      throw conversionError;
    }
    const bytes = base64ToBytes(res.contentBase64);
    if (bytes.length === 0) {
      throw new Error("The converted file could not be created.");
    }
    // Never trust the helper's filename for path purposes; sanitize again.
    const safeBase = safeFileName(file.name);
    const name = withExtension(
      res.outputFilename
        ? safeFileName(res.outputFilename)
        : `${safeBase}-converted`,
      outExt,
    );
    const url = blobUrl(bytes, outMime);
    setResultUrl(url);
    setEngineUsed(res.engine);
    setResult({
      kind: "file",
      fileName: name,
      sizeBytes: bytes.length,
      note:
        res.engine === "libreoffice"
          ? "Converted locally using LibreOffice — quality may differ from the native app."
          : `Converted locally with ${res.engine} — your document never left this Mac.`,
    });
  }

  async function run(): Promise<void> {
    setError(null);
    resetResults();
    setBusy(true);
    try {
      switch (tool.slug as ToolSlug) {
        case "merge-pdf": {
          if (fileObjs.length < 2)
            throw new Error("Add at least two PDFs to merge.");
          setProgress("Merging PDFs…");
          const { mergePdfs } = await import("@/lib/pdfOps");
          const bytes = await mergePdfs(fileObjs);
          const name = withExtension(
            `${safeFileName(fileObjs[0].name)}-merged`,
            "pdf",
          );
          const url = blobUrl(bytes, "application/pdf");
          setResultUrl(url);
          setEngineUsed("browser");
          setResult({ kind: "file", fileName: name, sizeBytes: bytes.length });
          break;
        }
        case "split-pdf": {
          const file = needSingle(fileObjs);
          setProgress("Reading PDF…");
          const { getPdfPageCount, splitPdf } = await import("@/lib/pdfOps");
          const count = await getPdfPageCount(
            new Uint8Array(await file.arrayBuffer()),
          );
          const parsed = parsePageRanges(rangeText, count);
          if (parsed.error) throw new Error(parsed.error);
          setProgress(`Extracting ${summarizePages(parsed.pages)}…`);
          const bytes = await splitPdf(file, parsed.pages);
          const name = withExtension(
            `${safeFileName(file.name)}-pages-${parsed.pages[0]}-${parsed.pages[parsed.pages.length - 1]}`,
            "pdf",
          );
          const url = blobUrl(bytes, "application/pdf");
          setResultUrl(url);
          setEngineUsed("browser");
          setResult({
            kind: "file",
            fileName: name,
            sizeBytes: bytes.length,
            note: `Extracted ${summarizePages(parsed.pages)} from a ${count}-page PDF.`,
          });
          break;
        }
        case "images-to-pdf": {
          if (fileObjs.length === 0) throw new Error("Add at least one image.");
          setProgress(`Building PDF from ${fileObjs.length} image${fileObjs.length === 1 ? "" : "s"}…`);
          const { imagesToPdf } = await import("@/lib/pdfOps");
          const bytes = await imagesToPdf(fileObjs);
          const name = withExtension(
            fileObjs.length === 1
              ? `${safeFileName(fileObjs[0].name)}`
              : "folio-images",
            "pdf",
          );
          const url = blobUrl(bytes, "application/pdf");
          setResultUrl(url);
          setEngineUsed("browser");
          setResult({ kind: "file", fileName: name, sizeBytes: bytes.length });
          break;
        }
        case "docx-to-pdf": {
          const file = needSingle(fileObjs);
          const helperCaps =
            helperState.kind === "connected" ? helperState.capabilities : null;
          const wantMac =
            helperChoice === "mac" ||
            (helperChoice === "auto" &&
              helperCaps !== null &&
              helperCaps.word);
          if (wantMac) {
            if (helperState.kind !== "connected" || !helperCaps?.word) {
              throw new Error(
                helperState.kind === "non-mac"
                  ? "This format requires macOS."
                  : helperErrorMessage("helper_unreachable"),
              );
            }
            await runHelperConversion(file, "docx", "pdf", "pdf", "application/pdf");
            break;
          }
          const { docxToPdf } = await import("@/lib/pdfOps");
          const bytes = await docxToPdf(file, (stage) => setProgress(stage));
          const name = withExtension(safeFileName(file.name), "pdf");
          const url = blobUrl(bytes, "application/pdf");
          setResultUrl(url);
          setEngineUsed("browser");
          setResult({
            kind: "file",
            fileName: name,
            sizeBytes: bytes.length,
            note: "Converted in your browser — check pagination before sharing. On a Mac with Word + Folio for Mac, choose High Fidelity for Word-quality output.",
          });
          break;
        }
        case "word-to-pdf":
        case "pages-to-pdf":
        case "pages-to-word":
        case "powerpoint-to-pdf":
        case "keynote-to-pdf":
        case "keynote-to-powerpoint":
        case "excel-to-pdf":
        case "numbers-to-pdf":
        case "numbers-to-excel": {
          const file = needSingle(fileObjs);
          const from = extensionOf(file.name) || tool.helperFrom || "";
          const to = tool.helperTo || "";
          // Gate with the shared route logic so UI copy and behavior agree.
          const caps =
            helperState.kind === "connected" ? helperState.capabilities : null;
          const mac =
            isMac ||
            (typeof navigator !== "undefined" &&
              isMacPlatform(navigator.platform));
          const decision = resolveConversionRoute({
            conversionId: tool.conversionId ?? tool.slug,
            from,
            to,
            browserAvailable: false,
            helperConnected: helperState.kind === "connected",
            isMac: mac,
            capabilities: caps,
            nativeEngine: tool.nativeEngine ?? null,
            fallbackToBrowser: false,
          });
          if (decision.via === "blocked") {
            // Prefer app-specific copy when the blocker is a missing app.
            if (decision.engine === null && tool.requiresApp) {
              const need = (tool.nativeEngine ?? "").toLowerCase();
              const hasApp =
                (need === "pages" && caps?.pages) ||
                (need === "keynote" && caps?.keynote) ||
                (need === "numbers" && caps?.numbers) ||
                (need === "word" && caps?.word) ||
                (need === "powerpoint" && caps?.powerpoint) ||
                (need === "excel" && caps?.excel);
              if (helperState.kind === "connected" && !hasApp) {
                throw new Error(appMissingMessage(tool.requiresApp));
              }
            }
            throw new Error(decision.message);
          }
          const outExt = to === "pdf" ? "pdf" : to;
          const outMime =
            to === "pdf"
              ? "application/pdf"
              : to === "docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : to === "pptx"
                  ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          await runHelperConversion(file, from, to, outExt, outMime);
          break;
        }
        case "pdf-to-jpg": {
          const file = needSingle(fileObjs);
          setProgress("Loading renderer…");
          const { renderPdfPages } = await import("@/lib/pdfOps");
          const pages = await renderPdfPages(file, {
            scale: 2,
            onProgress: (done, total) =>
              setProgress(`Rendering page ${done} of ${total}…`),
          });
          const withUrls = pages.map((p) => ({
            page: p.pageNumber,
            blob: p.blob,
            url: trackUrl(URL.createObjectURL(p.blob)),
          }));
          const base = safeFileName(file.name, "page");
          if (withUrls.length === 1) {
            setResult({
              kind: "images",
              pages: withUrls.map((p) => ({
                page: p.page,
                url: p.url,
                size: p.blob.size,
              })),
            });
          } else {
            setProgress("Packing ZIP…");
            const { default: JSZip } = await import("jszip");
            const zip = new JSZip();
            for (const p of withUrls) {
              zip.file(`${base}-p${p.page}.jpg`, p.blob);
            }
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const url = trackUrl(URL.createObjectURL(zipBlob));
            setResultUrl(url);
            setResult({
              kind: "images",
              pages: withUrls.map((p) => ({
                page: p.page,
                url: p.url,
                size: p.blob.size,
              })),
            });
            setZipMeta({ name: `${base}-pages.zip`, size: zipBlob.size });
          }
          setEngineUsed("browser");
          break;
        }
        case "rotate-pdf": {
          const file = needSingle(fileObjs);
          setProgress("Reading PDF…");
          const { getPdfPageCount, rotatePdf } = await import("@/lib/pdfOps");
          let targets: number[] | null = null;
          if (rotateMode === "pages") {
            const count = await getPdfPageCount(
              new Uint8Array(await file.arrayBuffer()),
            );
            const parsed = parsePageRanges(rangeText, count);
            if (parsed.error) throw new Error(parsed.error);
            targets = parsed.pages;
            setProgress(
              `Rotating ${summarizePages(targets)} by ${degrees}°…`,
            );
          } else {
            setProgress(`Rotating all pages by ${degrees}°…`);
          }
          const bytes = await rotatePdf(file, targets, degrees);
          const name = withExtension(
            `${safeFileName(file.name)}-rotated-${degrees}`,
            "pdf",
          );
          const url = blobUrl(bytes, "application/pdf");
          setResultUrl(url);
          setEngineUsed("browser");
          setResult({ kind: "file", fileName: name, sizeBytes: bytes.length });
          break;
        }
        case "compress-pdf": {
          const file = needSingle(fileObjs);
          setProgress("Optimizing PDF…");
          const { optimizePdf } = await import("@/lib/pdfOps");
          const { bytes, beforeBytes, afterBytes } = await optimizePdf(file);
          const name = withExtension(`${safeFileName(file.name)}-optimized`, "pdf");
          const url = blobUrl(bytes, "application/pdf");
          setResultUrl(url);
          setEngineUsed("browser");
          setResult({ kind: "compress", fileName: name, before: beforeBytes, after: afterBytes });
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  const canRun =
    !busy &&
    (tool.slug === "merge-pdf"
      ? fileObjs.length >= 2
      : tool.slug === "images-to-pdf"
        ? fileObjs.length >= 1
        : fileObjs.length === 1);

  const helperConnected =
    helperState.kind === "connected" ? helperState.capabilities : null;
  const showHelperBanner = needsHelper;
  const showEngineChoice =
    tool.slug === "docx-to-pdf" && helperConnected?.word === true;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <ToolHeader
        name={tool.name}
        description={tool.longDescription}
        accepts={tool.accepts}
        processing={tool.processing}
      />

      {showHelperBanner && (
        <div className="mt-6">
          <HelperBanner
            state={helperState}
            requiresApp={tool.requiresApp}
            onRetry={refreshHelper}
          />
        </div>
      )}

      <div className="mt-8 space-y-4">
        <Dropzone
          accepts={tool.accepts}
          multiple={tool.multiple}
          disabled={busy}
          onFiles={addFiles}
        />

        {tool.processing === "mac-helper" && tool.nativeEngine && (
          <StatusBox kind="info">
            Uses {tool.nativeEngine} on your Mac
            {tool.requiresApp ? ` (${tool.requiresApp} must be installed)` : ""}.
            Your document never leaves this Mac.
          </StatusBox>
        )}

        {matrixConversion?.status === "helper-beta" && (
          <StatusBox kind="info">
            <strong>Known limitation:</strong> {matrixConversion.limitation}
          </StatusBox>
        )}

        {tool.slug === "docx-to-pdf" && showEngineChoice && (
          <fieldset className="rounded-2xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-ink-900">
              Conversion quality
            </legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Conversion engine">
              {(
                [
                  ["auto", "Auto (prefer Word)"],
                  ["mac", "High Fidelity — Microsoft Word"],
                  ["browser", "Fast Browser Conversion — Beta"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  onClick={() => setHelperChoice(value)}
                  aria-pressed={helperChoice === value}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    helperChoice === value
                      ? "border-ink-950 bg-ink-950 text-white"
                      : "border-slate-300 bg-white text-ink-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {complaints.length > 0 && (
          <StatusBox kind="error">
            <ul className="list-disc pl-5">
              {complaints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </StatusBox>
        )}

        <FileList
          items={files}
          reorderable={tool.multiple && files.length > 1}
          onRemove={removeFile}
          onMove={moveFile}
        />

        {/* Per-tool options */}
        {(tool.slug === "split-pdf" ||
          (tool.slug === "rotate-pdf" && rotateMode === "pages")) && (
          <div>
            <FieldLabel htmlFor="folio-pages">
              {tool.slug === "split-pdf"
                ? "Pages to keep (e.g. 1-3,5,8-10)"
                : "Pages to rotate (e.g. 1-3,5)"}
            </FieldLabel>
            <input
              id="folio-pages"
              type="text"
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              disabled={busy}
              inputMode="text"
              autoComplete="off"
              placeholder="1-3,5,8-10"
              aria-describedby="range-help"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-mono text-[15px] text-ink-900 placeholder:text-ink-400 focus:border-accent-600"
            />
            <p id="range-help" className="mt-1.5 text-[13px] text-ink-500">
              Page numbers start at 1. Use commas to combine pages and dashes
              for ranges; “8-” means “page 8 to the end”.
            </p>
          </div>
        )}

        {tool.slug === "rotate-pdf" && (
          <fieldset className="rounded-2xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-ink-900">
              Rotation
            </legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Scope">
              {(["all", "pages"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={busy}
                  onClick={() => setRotateMode(m)}
                  aria-pressed={rotateMode === m}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    rotateMode === m
                      ? "border-ink-950 bg-ink-950 text-white"
                      : "border-slate-300 bg-white text-ink-700 hover:bg-slate-50"
                  }`}
                >
                  {m === "all" ? "All pages" : "Selected pages"}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Degrees clockwise">
              {([90, 180, 270] as RotationDegrees[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={busy}
                  onClick={() => setDegrees(d)}
                  aria-pressed={degrees === d}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    degrees === d
                      ? "border-accent-600 bg-accent-50 text-accent-700"
                      : "border-slate-300 bg-white text-ink-700 hover:bg-slate-50"
                  }`}
                >
                  {d}° clockwise
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {tool.slug === "compress-pdf" && (
          <StatusBox kind="info">
            Folio rewrites the PDF with optimized object streams and cleans
            redundant metadata — entirely offline. Already-optimized files may
            barely shrink; the result always shows honest before/after sizes.
          </StatusBox>
        )}

        {tool.slug === "docx-to-pdf" && !showEngineChoice && (
          <StatusBox kind="info">
            Beta: headings, bold/italic, lists, tables and images are
            preserved, but pagination and advanced Word features (headers,
            footers, footnotes, text boxes) may differ from Word. Always
            review the PDF before sharing. On a Mac with Word + Folio for Mac,
            high-fidelity Word conversion is used automatically when available.
          </StatusBox>
        )}

        {HELPER_TOOLS.includes(tool.slug as ToolSlug) && (
          <StatusBox kind="info">
            This conversion runs locally on your Mac — no cloud, no uploads.
            Temporary files are deleted automatically after conversion.
          </StatusBox>
        )}

        {busy && <ProgressBar label={progress || "Working…"} />}

        {error && <StatusBox kind="error">{error}</StatusBox>}

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={run} disabled={!canRun}>
            {busy ? "Working…" : actionLabel(tool.slug)}
          </PrimaryButton>
          {(files.length > 0 || result) && (
            <SecondaryButton onClick={startOver} disabled={busy}>
              Start over
            </SecondaryButton>
          )}
        </div>

        {/* Results */}
        {result?.kind === "file" && resultUrl && (
          <StatusBox kind="success">
            <p className="font-medium">
              Done — {result.fileName} ({formatBytes(result.sizeBytes)})
            </p>
            {result.note && <p className="mt-1">{result.note}</p>}
            {engineUsed && <EngineBadge engine={engineUsed} />}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={resultUrl}
                download={result.fileName}
                className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Download {result.fileName}
              </a>
            </div>
          </StatusBox>
        )}

        {result?.kind === "compress" && resultUrl && (
          <StatusBox kind={result.after < result.before ? "success" : "info"}>
            <p className="font-medium">
              {result.after < result.before ? (
                <>
                  Saved {formatBytes(result.before - result.after)} (
                  {formatPercentChange(result.before, result.after)}):{" "}
                  {formatBytes(result.before)} → {formatBytes(result.after)}
                </>
              ) : result.after === result.before ? (
                <>
                  No savings found — the file is already optimized (
                  {formatBytes(result.before)} → {formatBytes(result.after)}).
                  You can still download the rewritten copy.
                </>
              ) : (
                <>
                  The rewritten file is slightly larger (
                  {formatBytes(result.before)} → {formatBytes(result.after)}
                  ). The original is already well optimized — keeping it is
                  the better choice.
                </>
              )}
            </p>
            {engineUsed && <EngineBadge engine={engineUsed} />}
            <div className="mt-3">
              <a
                href={resultUrl}
                download={result.fileName}
                className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Download {result.fileName}
              </a>
            </div>
          </StatusBox>
        )}

        {result?.kind === "images" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" role="status">
            <p className="text-sm font-medium text-emerald-900">
              Rendered {result.pages.length} page
              {result.pages.length === 1 ? "" : "s"}.
            </p>
            {zipMeta && resultUrl && (
              <a
                href={resultUrl}
                download={zipMeta.name}
                className="mt-3 inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Download all as ZIP ({formatBytes(zipMeta.size)})
              </a>
            )}
            <ul className="mt-3 space-y-2">
              {result.pages.map((p) => (
                <li
                  key={p.page}
                  className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="text-ink-700">
                    Page {p.page} · {formatBytes(p.size)}
                  </span>
                  <a
                    href={p.url}
                    download={withExtension(
                      `${safeFileName(files[0]?.file.name ?? "page", "page")}-p${p.page}`,
                      "jpg",
                    )}
                    className="font-medium text-accent-600 hover:underline"
                  >
                    Download JPG
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function needSingle(objs: File[]): File {
  if (objs.length !== 1) throw new Error("Add exactly one file to continue.");
  return objs[0];
}

function actionLabel(slug: string): string {
  switch (slug) {
    case "merge-pdf":
      return "Merge PDFs";
    case "split-pdf":
      return "Extract pages";
    case "images-to-pdf":
      return "Create PDF";
    case "docx-to-pdf":
    case "word-to-pdf":
    case "pages-to-pdf":
    case "powerpoint-to-pdf":
    case "keynote-to-pdf":
    case "excel-to-pdf":
    case "numbers-to-pdf":
      return "Convert to PDF";
    case "pages-to-word":
      return "Convert to Word";
    case "keynote-to-powerpoint":
      return "Convert to PowerPoint";
    case "numbers-to-excel":
      return "Convert to Excel";
    case "pdf-to-jpg":
      return "Convert to JPG";
    case "rotate-pdf":
      return "Rotate PDF";
    case "compress-pdf":
      return "Compress PDF";
    default:
      return "Process";
  }
}

/** Re-exported so ToolRunner callers share the degrees type. */
export type { RotationDegrees as RunnerRotation };
