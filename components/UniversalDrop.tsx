"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dropzone, FileList, type ListedFile } from "@/components/Dropzone";
import { ToolRunner } from "@/components/ToolRunner";
import {
  actionsForKinds,
  capabilityFormatForKind,
  getCapability,
  type CapabilityActionId,
} from "@/lib/capabilityGraph";
import {
  capabilityLabel,
  inspectFiles,
  MAX_UNIVERSAL_FILES,
  MAX_UNIVERSAL_TOTAL_BYTES,
  readEmbeddedPdfPreview,
  type FileInspection,
} from "@/lib/fileIntelligence";
import { describeError } from "@/lib/errors";
import { formatBytes } from "@/lib/files";
import {
  MAX_PDF_BYTES,
  type FolioTool,
  getTool,
} from "@/lib/tools";

const ACCEPTS = ".pdf,.jpg,.jpeg,.png,.docx,.md,.markdown,.pages,.key,.keynote,.numbers,.pptx,.xlsx";

type UniversalItem = ListedFile & { inspection: FileInspection | null };

let universalId = 0;
function nextUniversalId(): string {
  universalId++;
  return `universal-${Date.now().toString(36)}-${universalId}`;
}

function toolForAction(action: CapabilityActionId): FolioTool | undefined {
  return getTool(action === "image-to-pdf" ? "images-to-pdf" : action);
}

function actionTitle(action: CapabilityActionId, count: number): string {
  if (action === "merge-pdf") return count > 1 ? `Merge ${count} PDFs` : "Merge PDFs";
  if (action === "image-to-pdf") return count > 1 ? `Create PDF from ${count} images` : "Create a PDF";
  if (action === "docx-to-pdf") return count > 1 ? `Convert ${count} Word files to one PDF` : "Convert to PDF";
  if (action === "combine-to-pdf") return `Combine ${count} document${count === 1 ? "" : "s"} into PDF`;
  if (action === "embedded-pdf") return "Export embedded PDF preview";
  if (action === "pages-to-pdf") return "Convert Pages to PDF";
  if (action === "keynote-to-pdf") return "Convert Keynote to PDF";
  if (action === "numbers-to-xlsx") return "Convert Numbers to XLSX";
  if (action === "numbers-to-pdf") return "Convert Numbers to PDF";
  if (action === "split-pdf") return "Extract PDF pages";
  if (action === "pdf-to-jpg") return "Convert PDF to JPG";
  if (action === "pdf-to-markdown") return "Convert PDF to Markdown";
  if (action === "markdown-to-pdf") return "Convert Markdown to PDF";
  return capabilityLabel(action);
}

function actionDescription(action: CapabilityActionId, count: number): string {
  if (action === "merge-pdf") return "Add, reorder and merge the selected PDFs locally.";
  if (action === "image-to-pdf") return "Place one image on each PDF page in your chosen order.";
  if (action === "docx-to-pdf") return count > 1
    ? "Convert each Word document locally, then join the PDF pages in order. Beta."
    : "Convert this Word document locally. Beta.";
  if (action === "combine-to-pdf") return "Normalize each supported source locally. Nothing is silently skipped.";
  if (action === "pages-to-pdf") return "Export the supported Pages subset locally. Unsupported content fails closed.";
  if (action === "keynote-to-pdf") return "Export supported Keynote slides locally. Unsupported content fails closed.";
  if (action === "numbers-to-xlsx") return "Export saved Numbers tables and values to an XLSX workbook locally.";
  if (action === "numbers-to-pdf") return "Render saved Numbers tables to a readable PDF locally.";
  return getCapability(action)?.description ?? "Available locally in this browser.";
}

function selectionLabel(items: UniversalItem[]): string {
  if (items.length === 1) return "1 document selected";
  return `${items.length} documents selected`;
}

function inspectionKindLabel(inspection: FileInspection): string {
  return inspection.formatLabel;
}

export function UniversalDrop() {
  const [items, setItems] = useState<UniversalItem[]>([]);
  const [activeTool, setActiveTool] = useState<{ tool: FolioTool; files: File[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const selectionCardRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const mountedRef = useRef(true);
  const operationRef = useRef(0);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
    else if (!busy && items.length > 0) selectionCardRef.current?.focus();
  }, [busy, error, items.length]);

  const resetSelection = useCallback(() => {
    operationRef.current++;
    clearPreview();
    setActiveTool(null);
    setItems([]);
    setError(null);
    setBusy(false);
  }, [clearPreview]);

  const inspectSelection = useCallback(async (incoming: File[]) => {
    const nextOperation = ++operationRef.current;
    const existingBytes = items.reduce((total, item) => total + item.file.size, 0);
    let totalBytes = existingBytes;
    const accepted: File[] = [];
    const complaints: string[] = [];
    for (const file of incoming) {
      if (items.length + accepted.length >= MAX_UNIVERSAL_FILES) {
        complaints.push(`${file.name || "Unnamed file"}: Select no more than ${MAX_UNIVERSAL_FILES} documents.`);
        continue;
      }
      if (file.size > MAX_PDF_BYTES) {
        complaints.push(`${file.name || "Unnamed file"}: This file is larger than Folio’s 100 MB local limit.`);
        continue;
      }
      if (totalBytes + file.size > MAX_UNIVERSAL_TOTAL_BYTES) {
        complaints.push(`${file.name || "Unnamed file"}: The selection would exceed Folio’s 150 MB total local limit.`);
        continue;
      }
      accepted.push(file);
      totalBytes += file.size;
    }
    if (accepted.length === 0) {
      if (mountedRef.current) setError(complaints.join(" ") || "No files were added.");
      return;
    }

    clearPreview();
    setActiveTool(null);
    setError(complaints.length > 0 ? complaints.join(" ") : null);
    const nextItems = [
      ...items,
      ...accepted.map((file) => ({ file, id: nextUniversalId(), inspection: null })),
    ];
    setItems(nextItems);
    setBusy(true);
    try {
      const inspections = await inspectFiles(nextItems.map((item) => item.file));
      if (!mountedRef.current || operationRef.current !== nextOperation) return;
      setItems(nextItems.map((item, index) => ({ ...item, inspection: inspections[index] })));
    } catch (cause) {
      if (mountedRef.current && operationRef.current === nextOperation) {
        setError(describeError(cause, "Folio couldn’t inspect these files. Check them and try again.").message);
      }
    } finally {
      if (mountedRef.current && operationRef.current === nextOperation) setBusy(false);
    }
  }, [clearPreview, items]);

  const removeFile = useCallback((id: string) => {
    operationRef.current++;
    setItems((previous) => previous.filter((item) => item.id !== id));
    clearPreview();
    setError(null);
  }, [clearPreview]);

  const moveFile = useCallback((id: string, direction: -1 | 1) => {
    setItems((previous) => {
      const index = previous.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    clearPreview();
  }, [clearPreview]);

  const ready = items.length > 0 && items.every((item) => item.inspection !== null);
  const valid = ready && items.every((item) => item.inspection?.valid && item.inspection.safety === "safe");
  const actions = useMemo(() => {
    if (!valid) return [];
    const kinds = items
      .map((item) => capabilityFormatForKind(item.inspection!.kind))
      .filter((kind): kind is NonNullable<typeof kind> => Boolean(kind));
    if (kinds.length !== items.length) return [];
    const hasEmbeddedPdf = items.length === 1 && items[0].inspection?.supportedActions.includes("embedded-pdf");
    return actionsForKinds(kinds, { hasEmbeddedPdf });
  }, [items, valid]);

  const chooseAction = useCallback(async (action: CapabilityActionId) => {
    if (!valid) return;
    setError(null);
    if (action === "embedded-pdf") {
      const file = items[0]?.file;
      if (!file) return;
      const nextOperation = ++operationRef.current;
      setBusy(true);
      try {
        const bytes = await readEmbeddedPdfPreview(file);
        if (!mountedRef.current || operationRef.current !== nextOperation) return;
        const copy = new Uint8Array(bytes.length);
        copy.set(bytes);
        const url = URL.createObjectURL(new Blob([copy.buffer], { type: "application/pdf" }));
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch (cause) {
        if (mountedRef.current && operationRef.current === nextOperation) {
          setError(describeError(cause, "The embedded preview couldn’t be opened. Choose another file.").message);
        }
      } finally {
        if (mountedRef.current && operationRef.current === nextOperation) setBusy(false);
      }
      return;
    }
    const tool = toolForAction(action);
    if (tool) setActiveTool({ tool, files: items.map((item) => item.file) });
  }, [items, valid]);

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
        <ToolRunner tool={activeTool.tool} initialFiles={activeTool.files} />
      </section>
    );
  }

  return (
    <section className="border-y border-slate-200 bg-paper" aria-labelledby="universal-drop-heading">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-700">Universal Drop</p>
          <h2 id="universal-drop-heading" className="mt-2 text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
            Drop documents. See every local option.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
            Folio checks each file’s content locally, then offers only actions it can actually complete. Add compatible files to work in one batch. Nothing is uploaded.
          </p>
        </div>

        <div className="mt-7 max-w-3xl">
          <Dropzone
            accepts={ACCEPTS}
            multiple
            disabled={busy}
            onFiles={inspectSelection}
            onDropIssue={(message) => {
              resetSelection();
              setError(message);
            }}
          />
        </div>

        {busy && (
          <p className="mt-4 text-sm font-medium text-ink-700" role="status" aria-live="polite">
            Inspecting {items.length || "these"} document{items.length === 1 ? "" : "s"} locally…
          </p>
        )}

        {error && (
          <div ref={errorRef} tabIndex={-1} className="mt-4 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
            {error}
          </div>
        )}

        {items.length > 0 && (
          <div
            ref={selectionCardRef}
            tabIndex={-1}
            className="mt-5 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,20,24,0.04)]"
            aria-label="Selected documents"
            data-universal-drop-selection="true"
            data-universal-file-count={items.length}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-950">{selectionLabel(items)}</p>
                <p className="mt-1 text-sm text-ink-500">Reorder the cards to set the output order.</p>
              </div>
              <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700">
                {formatBytes(items.reduce((total, item) => total + item.file.size, 0))}
              </span>
            </div>

            <div className="mt-4">
              <FileList
                items={items.map((item) => ({
                  ...item,
                  hasEmbeddedPreview: item.inspection?.supportedActions.includes("embedded-pdf") ?? false,
                }))}
                reorderable={items.length > 1}
                disabled={busy}
                accepts={ACCEPTS}
                onRemove={removeFile}
                onMove={moveFile}
                onAddFiles={inspectSelection}
                listRef={listRef}
              />
            </div>

            {ready && (
              <div className="mt-5" data-universal-actions="true">
                {items.length === 1 && ["pages", "keynote", "numbers"].includes(items[0].inspection!.kind) && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-paper px-4 py-3 text-sm leading-relaxed text-ink-700">
                    <p className="font-medium text-ink-950">Apple export is Beta.</p>
                    <p className="mt-1">Folio reads this container locally. Saved text, tables, images and basic shapes are supported where available; animations, transitions, formula recalculation and unsupported content are not exported.</p>
                  </div>
                )}
                {valid && actions.length > 0 ? (
                  <>
                    <h3 className="text-sm font-semibold text-ink-950">Available locally</h3>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {actions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          disabled={busy}
                          onClick={() => chooseAction(action)}
                          aria-label={actionTitle(action, items.length)}
                          data-universal-action={action}
                          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left transition hover:border-accent-400 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="block text-sm font-semibold text-ink-950">{actionTitle(action, items.length)}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{actionDescription(action, items.length)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : valid ? (
                  <p className="rounded-xl border border-slate-200 bg-paper px-4 py-3 text-sm leading-relaxed text-ink-700">
                    Folio recognized these files, but no shared browser-local conversion is enabled for this selection. Native Apple, PowerPoint and Excel conversion remains deferred until it can produce validated target files.
                  </p>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-paper px-4 py-3 text-sm leading-relaxed text-ink-700">
                    <p className="font-medium text-ink-950">Check these files before continuing.</p>
                    <ul className="mt-2 space-y-1">
                      {items.filter((item) => item.inspection && !item.inspection.valid).map((item) => (
                        <li key={item.id}>{item.file.name || "Unnamed file"}: {item.inspection?.warningMessages[0] ?? "This file is not valid."}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {items.map((item) => item.inspection && (
              <p key={`${item.id}-detail`} className="mt-3 text-xs text-ink-500">
                {item.file.name || "Unnamed file"}: Detected as {inspectionKindLabel(item.inspection)}
                {item.inspection.warningMessages.length > 0 && ` · ${item.inspection.warningMessages[0]}`}
              </p>
            ))}

            {previewUrl && (
              <p className="mt-4 text-sm">
                <a href={previewUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600">
                  Open preview in a new tab
                </a>
              </p>
            )}
          </div>
        )}

        {(items.length > 0 || error) && (
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
