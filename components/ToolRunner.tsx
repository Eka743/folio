"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dropzone, FileList, type ListedFile } from "@/components/Dropzone";
import {
  EngineBadge,
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
  readFileBytes,
  safeFileName,
  validateFiles,
  withExtension,
} from "@/lib/files";
import { describeError } from "@/lib/errors";
import { parsePageRanges, summarizePages } from "@/lib/pageRanges";
import type { RotationDegrees } from "@/lib/pdfOpsTypes";
import type { FolioTool } from "@/lib/tools";

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

export function ToolRunner({
  tool,
  initialFiles = [],
}: {
  tool: FolioTool;
  initialFiles?: File[];
}) {
  const [files, setFiles] = useState<ListedFile[]>(() =>
    initialFiles.map((file) => ({ file, id: nextId() })),
  );
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
  const runGuardRef = useRef(false);
  const fileListRef = useRef<HTMLOListElement>(null);
  const selectionFocusPendingRef = useRef(false);
  const complaintRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const fileObjs = useMemo(() => files.map((f) => f.file), [files]);

  useEffect(() => {
    if (selectionFocusPendingRef.current && files.length > 0) {
      selectionFocusPendingRef.current = false;
      fileListRef.current?.focus();
    }
  }, [files.length]);

  useEffect(() => {
    if (complaints.length > 0) complaintRef.current?.focus();
  }, [complaints]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  // Single registry for every object URL this component creates, so cleanup
  // never depends on stale state closures or double-revokes.
  const urlsRef = useRef<Set<string>>(new Set());
  const trackUrl = useCallback((url: string): string => {
    if (!mountedRef.current) {
      URL.revokeObjectURL(url);
      return url;
    }
    urlsRef.current.add(url);
    return url;
  }, []);
  const revokeAllUrls = useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current.clear();
  }, []);

  // Revoke any remaining object URLs on unmount only.
  useEffect(() => {
    mountedRef.current = true;
    const registry = urlsRef.current;
    return () => {
      mountedRef.current = false;
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

  const handleDropIssue = useCallback((message: string) => {
    resetResults();
    setComplaints([message]);
  }, [resetResults]);

  function blobUrl(bytes: Uint8Array, mime: string): string {
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return trackUrl(URL.createObjectURL(new Blob([copy], { type: mime })));
  }

  const addFiles = useCallback(
    (incoming: File[]) => {
      resetResults();
      const { accepted, complaints: found } = validateFiles(
        tool,
        incoming,
        files.length,
      );
      if (accepted.length > 0) {
        selectionFocusPendingRef.current = true;
        const listed = accepted.map((file) => ({ file, id: nextId() }));
        setFiles((prev) =>
          tool.multiple ? [...prev, ...listed] : listed.slice(0, 1),
        );
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

  const moveFile = useCallback(
    (id: string, dir: -1 | 1) => {
      setFiles((prev) => {
        const i = prev.findIndex((f) => f.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
      resetResults();
    },
    [resetResults],
  );

  const startOver = useCallback(() => {
    resetResults();
    setFiles([]);
    setComplaints([]);
  }, [resetResults]);

  async function run(): Promise<void> {
    if (runGuardRef.current) return;
    runGuardRef.current = true;
    setError(null);
    resetResults();
    setBusy(true);
    try {
      switch (tool.slug) {
        case "merge-pdf": {
          if (fileObjs.length < 2)
            throw new Error("Add at least two PDFs to merge.");
          setProgress("Merging PDFs…");
          const { mergePdfs } = await import("@/lib/pdfOps");
          const bytes = await mergePdfs(fileObjs);
          if (!mountedRef.current) return;
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
            await readFileBytes(file),
          );
          const parsed = parsePageRanges(rangeText, count);
          if (parsed.error) throw new Error(parsed.error);
          setProgress(`Extracting ${summarizePages(parsed.pages)}…`);
          const bytes = await splitPdf(file, parsed.pages);
          if (!mountedRef.current) return;
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
          if (!mountedRef.current) return;
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
          const { docxToPdf } = await import("@/lib/pdfOps");
          const bytes = await docxToPdf(file, (stage) => {
            if (mountedRef.current) setProgress(stage);
          });
          if (!mountedRef.current) return;
          const name = withExtension(safeFileName(file.name), "pdf");
          const url = blobUrl(bytes, "application/pdf");
          setResultUrl(url);
          setEngineUsed("browser");
          setResult({
            kind: "file",
            fileName: name,
            sizeBytes: bytes.length,
            note: "Converted in your browser. Review pagination and complex layouts before sharing.",
          });
          break;
        }
        case "markdown-to-pdf": {
          const file = needSingle(fileObjs);
          const { markdownToPdf } = await import("@/lib/pdfOps");
          const bytes = await markdownToPdf(file, (stage) => {
            if (mountedRef.current) setProgress(stage);
          });
          if (!mountedRef.current) return;
          const name = withExtension(safeFileName(file.name), "pdf");
          const url = blobUrl(bytes, "application/pdf");
          setResultUrl(url);
          setEngineUsed("browser");
          setResult({
            kind: "file",
            fileName: name,
            sizeBytes: bytes.length,
            note: "Rendered from sanitized Markdown in your browser. Remote images are not fetched.",
          });
          break;
        }
        case "pdf-to-markdown": {
          const file = needSingle(fileObjs);
          const { pdfToMarkdown } = await import("@/lib/pdfOps");
          const markdown = await pdfToMarkdown(file, (stage) => {
            if (mountedRef.current) setProgress(stage);
          });
          if (!mountedRef.current) return;
          const bytes = new TextEncoder().encode(markdown);
          const name = withExtension(safeFileName(file.name), "md");
          const url = blobUrl(bytes, "text/markdown;charset=utf-8");
          setResultUrl(url);
          setEngineUsed("browser");
          setResult({
            kind: "file",
            fileName: name,
            sizeBytes: bytes.length,
            note: "Extracted locally. This is a readable reconstruction, not a perfect copy of the original document layout.",
          });
          break;
        }
        case "pdf-to-jpg": {
          const file = needSingle(fileObjs);
          setProgress("Loading renderer…");
          const { renderPdfPages } = await import("@/lib/pdfOps");
          const pages = await renderPdfPages(file, {
            scale: 2,
            onProgress: (done, total) =>
              mountedRef.current && setProgress(`Rendering page ${done} of ${total}…`),
          });
          if (!mountedRef.current) return;
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
              await readFileBytes(file),
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
          if (!mountedRef.current) return;
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
          if (!mountedRef.current) return;
          const name = withExtension(`${safeFileName(file.name)}-optimized`, "pdf");
          const url = blobUrl(bytes, "application/pdf");
          setResultUrl(url);
          setEngineUsed("browser");
          setResult({ kind: "compress", fileName: name, before: beforeBytes, after: afterBytes });
          break;
        }
      }
    } catch (e) {
      if (mountedRef.current) setError(describeError(e).message);
    } finally {
      if (mountedRef.current) {
        runGuardRef.current = false;
        setBusy(false);
        setProgress("");
      }
    }
  }

  const canRun =
    !busy &&
    (tool.slug === "merge-pdf"
      ? fileObjs.length >= 2
      : tool.slug === "images-to-pdf"
        ? fileObjs.length >= 1
        : fileObjs.length === 1);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10" aria-busy={busy}>
      <ToolHeader
        name={tool.name}
        description={tool.longDescription}
        accepts={tool.accepts}
      />

      <div className="mt-8 space-y-4">
        <Dropzone
          accepts={tool.accepts}
          multiple={tool.multiple}
          disabled={busy}
          onFiles={addFiles}
          onDropIssue={handleDropIssue}
        />

        {complaints.length > 0 && (
          <StatusBox ref={complaintRef} tabIndex={-1} kind="error">
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
          disabled={busy}
          onRemove={removeFile}
          onMove={moveFile}
          listRef={fileListRef}
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
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-mono text-[15px] text-ink-900 placeholder:text-ink-400 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:ring-offset-1"
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
            redundant metadata in this browser. Already-optimized files may
            barely shrink; the result always shows honest before/after sizes.
          </StatusBox>
        )}

        {tool.slug === "docx-to-pdf" && (
          <StatusBox kind="info">
            Beta: headings, bold/italic, lists, tables and images are
            preserved, but pagination and advanced Word features, including headers,
            footers, footnotes and text boxes may differ. Always review the
            PDF before sharing.
          </StatusBox>
        )}

        {tool.slug === "markdown-to-pdf" && (
          <StatusBox kind="info">
            Markdown is rendered locally into a readable A4 PDF. Raw HTML is
            disabled and remote images are omitted instead of being fetched.
          </StatusBox>
        )}

        {tool.slug === "pdf-to-markdown" && (
          <StatusBox kind="info">
            Beta: Folio extracts text and only reconstructs headings and lists
            when the PDF layout makes them reasonably clear. Scanned PDFs and
            complex columns need OCR or manual cleanup.
          </StatusBox>
        )}

        {busy && <ProgressBar label={progress || "Working…"} />}

        {error && <StatusBox ref={errorRef} tabIndex={-1} kind="error">{error}</StatusBox>}

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={run} disabled={!canRun}>
            {busy ? "Working…" : actionLabel(tool.slug)}
          </PrimaryButton>
          {(files.length > 0 || result || complaints.length > 0 || error) && (
            <SecondaryButton onClick={startOver} disabled={busy}>
              Start over
            </SecondaryButton>
          )}
        </div>

        {/* Results */}
        {result?.kind === "file" && resultUrl && (
          <StatusBox ref={resultRef} tabIndex={-1} kind="success">
            <p className="font-medium">
              Done — {result.fileName} ({formatBytes(result.sizeBytes)})
            </p>
            {result.note && <p className="mt-1">{result.note}</p>}
            {engineUsed && <EngineBadge engine={engineUsed} />}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={resultUrl}
                download={result.fileName}
                className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
              >
                Download {result.fileName}
              </a>
            </div>
          </StatusBox>
        )}

        {result?.kind === "compress" && resultUrl && (
          <StatusBox ref={resultRef} tabIndex={-1} kind={result.after < result.before ? "success" : "info"}>
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
                className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
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
                className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
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
                    className="rounded-lg px-2 py-2 font-medium text-accent-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
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
      return "Convert to PDF";
    case "markdown-to-pdf":
      return "Convert to PDF";
    case "pdf-to-markdown":
      return "Convert to Markdown";
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
