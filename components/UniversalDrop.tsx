"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { ToolRunner } from "@/components/ToolRunner";
import { capabilityLabel, inspectFile, readEmbeddedPdfPreview, type FileCapabilityAction, type FileInspection } from "@/lib/fileIntelligence";
import { formatBytes } from "@/lib/files";
import { describeError } from "@/lib/errors";
import { getTool, type FolioTool } from "@/lib/tools";

const ACCEPTS = ".pdf,.jpg,.jpeg,.png,.docx,.pages,.key,.keynote,.numbers";

function toolForAction(action: FileCapabilityAction): FolioTool | undefined {
  const slug = action === "image-to-pdf" ? "images-to-pdf" : action;
  return getTool(slug);
}

function actionDescription(action: FileCapabilityAction): string {
  switch (action) {
    case "merge-pdf":
      return "Add more PDFs to combine them in your chosen order.";
    case "split-pdf":
      return "Choose the pages to keep in a new PDF.";
    case "rotate-pdf":
      return "Turn every page or a selected set of pages.";
    case "compress-pdf":
      return "Rewrite the PDF locally and compare the result honestly.";
    case "pdf-to-jpg":
      return "Render each page as a JPG image.";
    case "image-to-pdf":
      return "Add more images and place one on each PDF page.";
    case "docx-to-pdf":
      return "Convert this Word document locally. Beta.";
    case "embedded-pdf":
      return "Open the file’s own QuickLook PDF preview in a new tab.";
    default:
      return "Available locally in this browser.";
  }
}

export function UniversalDrop() {
  const [inspection, setInspection] = useState<FileInspection | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTool, setActiveTool] = useState<{ tool: FolioTool; file: File } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const selectionCardRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, []);

  useEffect(() => clearPreview, [clearPreview]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
    else if (inspection) selectionCardRef.current?.focus();
  }, [error, inspection]);

  const resetSelection = useCallback(() => {
    clearPreview();
    setActiveTool(null);
    setSelectedFile(null);
    setInspection(null);
    setError(null);
    setBusy(false);
  }, [clearPreview]);

  const handleDropIssue = useCallback((message: string) => {
    resetSelection();
    setError(message);
  }, [resetSelection]);

  const inspectSelection = useCallback(async (files: File[]) => {
    if (files.length > 1) {
      resetSelection();
      setError("Select one file at a time here.");
      return;
    }
    const file = files[0];
    if (!file) return;
    clearPreview();
    setActiveTool(null);
    setSelectedFile(file);
    setInspection(null);
    setError(null);
    setBusy(true);
    try {
      setInspection(await inspectFile(file));
    } catch (cause) {
      setError(describeError(cause, "Folio couldn’t inspect this file. Check the file and try again.").message);
    } finally {
      setBusy(false);
    }
  }, [clearPreview, resetSelection]);

  const chooseAction = useCallback(async (action: FileCapabilityAction) => {
    if (!selectedFile) return;
    setError(null);
    if (action === "embedded-pdf") {
      setBusy(true);
      try {
        const bytes = await readEmbeddedPdfPreview(selectedFile);
        const copy = new Uint8Array(bytes.length);
        copy.set(bytes);
        const url = URL.createObjectURL(new Blob([copy.buffer], { type: "application/pdf" }));
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch (cause) {
        setError(describeError(cause, "The embedded preview couldn’t be opened. Choose another file.").message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const tool = toolForAction(action);
    if (tool) setActiveTool({ tool, file: selectedFile });
  }, [selectedFile]);

  if (activeTool) {
    return (
      <section className="border-y border-slate-200 bg-paper" aria-label="Selected Folio tool">
        <div className="mx-auto max-w-5xl px-5 pt-5">
          <button
            type="button"
            onClick={() => setActiveTool(null)}
            className="rounded-lg px-2 py-2 text-sm font-medium text-accent-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
          >
            ← Choose another action
          </button>
        </div>
        <ToolRunner tool={activeTool.tool} initialFiles={[activeTool.file]} />
      </section>
    );
  }

  return (
    <section className="border-y border-slate-200 bg-paper" aria-labelledby="universal-drop-heading">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-700">New in Folio</p>
          <h2 id="universal-drop-heading" className="mt-2 text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
            Drop a document. See what Folio can do.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
            Folio checks the file’s content locally, then offers only actions that match what it actually found. Nothing is uploaded.
          </p>
        </div>

        <div className="mt-7 max-w-3xl">
          <Dropzone
            accepts={ACCEPTS}
            multiple={false}
            disabled={busy}
            onFiles={inspectSelection}
            onDropIssue={handleDropIssue}
          />
        </div>

        {busy && (
          <p className="mt-4 text-sm font-medium text-ink-700" role="status" aria-live="polite">
            Inspecting this file locally…
          </p>
        )}

        {error && (
          <div ref={errorRef} tabIndex={-1} className="mt-4 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
            {error}
          </div>
        )}

        {inspection && selectedFile && (
          <div ref={selectionCardRef} tabIndex={-1} className="mt-5 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,20,24,0.04)]" aria-label="Detected file">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink-950" title={selectedFile.name}>{selectedFile.name}</p>
                <p className="mt-1 text-sm text-ink-500">
                  Detected as <span className="font-medium text-ink-800">{inspection.formatLabel}</span>
                  {inspection.generation !== "unknown" && ` · ${inspection.generation} container`}
                </p>
                <p className="mt-1 text-sm text-ink-500">{formatBytes(selectedFile.size)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${inspection.valid && inspection.safety === "safe" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                {inspection.valid && inspection.safety === "safe" ? "Recognized" : "Needs attention"}
              </span>
            </div>

            {inspection.warningMessages.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
                {inspection.warningMessages.map((message) => <p key={message}>{message}</p>)}
              </div>
            )}

            {inspection.supportedActions.length > 0 && inspection.valid &&
              !["pages", "keynote", "numbers"].includes(inspection.kind) && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-ink-950">Choose an action</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {inspection.supportedActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      disabled={busy}
                      onClick={() => chooseAction(action)}
                      className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left transition hover:border-accent-400 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="block text-sm font-semibold text-ink-950">{capabilityLabel(action)}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{actionDescription(action)}</span>
                    </button>
                  ))}
                </div>
                {inspection.kind === "pdf" && inspection.supportedActions.includes("merge-pdf") && (
                  <p className="mt-3 text-xs text-ink-500">Merge starts with this PDF selected; you can add more and reorder them next.</p>
                )}
              </div>
            )}

            {inspection.kind === "pages" || inspection.kind === "keynote" || inspection.kind === "numbers" ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-paper px-4 py-3 text-sm leading-relaxed text-ink-700">
                <p className="font-medium text-ink-950">Detected, but conversion is unavailable.</p>
                <p className="mt-1">Folio identified this {inspection.formatLabel.toLowerCase()} locally. Native Pages, Keynote and Numbers conversion is still under evaluation{inspection.supportedActions.includes("embedded-pdf") ? "; an embedded PDF preview is available" : ""}.</p>
                {inspection.supportedActions.includes("embedded-pdf") && (
                  <button
                    type="button"
                    onClick={() => chooseAction("embedded-pdf")}
                    disabled={busy}
                    className="mt-3 min-h-11 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    Prepare embedded PDF preview
                  </button>
                )}
                {previewUrl && (
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="ml-3 text-sm font-semibold text-accent-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2">
                    Open preview in a new tab
                  </a>
                )}
              </div>
            ) : null}

            {!inspection.valid && (
              <p className="mt-4 text-sm text-ink-700">Remove this file and select a valid document to continue.</p>
            )}
          </div>
        )}

        {(inspection || selectedFile || error) && (
          <button
            type="button"
            onClick={resetSelection}
            disabled={busy}
            className="mt-4 min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink-900 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start over
          </button>
        )}

        <p className="mt-4 text-xs text-ink-400">Local inspection only · no account · no document upload</p>
      </div>
    </section>
  );
}
