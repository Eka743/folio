"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/files";
import { schedulePdfThumbnail } from "@/lib/pdfThumbnail";
import { readEmbeddedPdfPreview } from "@/lib/fileIntelligence";

export type ListedFile = {
  file: File;
  id: string;
  hasEmbeddedPreview?: boolean;
};

type PreviewKind = "pdf" | "image" | "docx" | "markdown" | "pptx" | "xlsx" | "pages" | "keynote" | "numbers" | "file";
type PreviewState = "loading" | "ready" | "fallback";

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function previewKind(file: File): PreviewKind {
  const extension = extensionOf(file.name);
  if (file.type === "application/pdf" || extension === ".pdf") return "pdf";
  if (["image/jpeg", "image/png"].includes(file.type) || [".jpg", ".jpeg", ".png"].includes(extension)) return "image";
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === ".docx") return "docx";
  if (file.type === "text/markdown" || [".md", ".markdown"].includes(extension)) return "markdown";
  if (file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || [".ppt", ".pptx"].includes(extension)) return "pptx";
  if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || [".xls", ".xlsx"].includes(extension)) return "xlsx";
  if (extension === ".pages") return "pages";
  if ([".key", ".keynote"].includes(extension)) return "keynote";
  if (extension === ".numbers") return "numbers";
  return "file";
}

function formatLabel(kind: PreviewKind): string {
  switch (kind) {
    case "pdf": return "PDF";
    case "image": return "IMAGE";
    case "docx": return "DOCX";
    case "markdown": return "MD";
    case "pptx": return "PPTX";
    case "xlsx": return "XLSX";
    case "pages": return "PAGES";
    case "keynote": return "KEYNOTE";
    case "numbers": return "NUMBERS";
    default: return "FILE";
  }
}

function documentLabel(kind: PreviewKind): string {
  switch (kind) {
    case "pdf": return "PDF document";
    case "image": return "Image";
    case "docx": return "Word document";
    case "markdown": return "Markdown document";
    case "pptx": return "PowerPoint presentation";
    case "xlsx": return "Excel workbook";
    case "pages": return "Pages document";
    case "keynote": return "Keynote presentation";
    case "numbers": return "Numbers spreadsheet";
    default: return "Document";
  }
}

function PreviewGlyph({ kind }: { kind: PreviewKind }) {
  if (kind === "image") {
    return (
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m4 17 4.5-4 3.5 3 2.5-2 5.5 4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 3.75h8l4 4V20.25H6z" />
      <path d="M14 3.75v4h4M8.5 12h7M8.5 15.5h7" />
    </svg>
  );
}

function PreviewFallback({ kind, failed }: { kind: PreviewKind; failed: boolean }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 px-4 text-center text-ink-500"
      data-preview-fallback="true"
    >
      <div className="flex h-14 w-12 items-center justify-center rounded-lg border border-slate-300 bg-white text-accent-600 shadow-[0_1px_2px_rgba(16,20,24,0.05)]">
        <PreviewGlyph kind={kind} />
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-700">{formatLabel(kind)}</span>
      <span className="text-xs">{failed ? "Preview unavailable" : documentLabel(kind)}</span>
    </div>
  );
}

function PreviewFrame({
  kind,
  state,
  compact,
  children,
}: {
  kind: PreviewKind;
  state: PreviewState;
  compact: boolean;
  children: React.ReactNode;
}) {
  const frameHeight = compact ? "h-48" : "h-56";
  return (
    <div
      className={`relative ${frameHeight} w-full overflow-hidden rounded-xl border border-slate-200 bg-white`}
      aria-hidden="true"
      data-file-preview-kind={kind}
      data-preview-state={state}
    >
      {children}
    </div>
  );
}

function PreviewSkeleton({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 text-xs text-ink-400" data-preview-skeleton="true">
      <div className="h-16 w-12 animate-pulse rounded-md border border-slate-200 bg-white" />
      <span>{label}</span>
    </div>
  );
}

function PdfPreview({ file, compact }: { file: File; compact: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<PreviewState>("loading");

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return () => { cancelled = true; };
    canvas.width = 0;
    canvas.height = 0;
    const scheduled = schedulePdfThumbnail(file, canvas);
    scheduled.promise.then(
      () => {
        if (!cancelled) setState("ready");
      },
      () => {
        if (!cancelled) setState("fallback");
      },
    );
    return () => {
      cancelled = true;
      scheduled.cancel();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [file]);

  return (
    <PreviewFrame kind="pdf" state={state} compact={compact}>
      {state === "loading" && <PreviewSkeleton label="Generating preview…" />}
      <canvas
        ref={canvasRef}
        className={`h-full w-full object-contain ${state === "ready" ? "" : "hidden"}`}
        data-preview-canvas="pdf"
      />
      {state === "fallback" && <PreviewFallback kind="pdf" failed />}
    </PreviewFrame>
  );
}

function ImagePreview({ file, compact }: { file: File; compact: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<PreviewState>("loading");
  useEffect(() => {
    let active = true;
    const nextUrl = URL.createObjectURL(file);
    queueMicrotask(() => {
      if (active) setUrl(nextUrl);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  return (
    <PreviewFrame kind="image" state={state} compact={compact}>
      {state === "loading" && <PreviewSkeleton label="Loading image…" />}
      {state !== "fallback" && url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-contain ${state === "loading" ? "invisible" : "p-2"}`}
          onLoad={() => setState("ready")}
          onError={() => setState("fallback")}
          data-preview-image="true"
        />
      )}
      {state === "fallback" && <PreviewFallback kind="image" failed />}
    </PreviewFrame>
  );
}

function ApplePreview({ file, compact, hasEmbeddedPreview }: { file: File; compact: boolean; hasEmbeddedPreview: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<PreviewState>(hasEmbeddedPreview ? "loading" : "ready");

  useEffect(() => {
    if (!hasEmbeddedPreview) {
      return;
    }
    let active = true;
    let createdUrl: string | null = null;
    readEmbeddedPdfPreview(file).then((bytes) => {
      if (!active) return;
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      const nextUrl = URL.createObjectURL(new Blob([copy], { type: "application/pdf" }));
      createdUrl = nextUrl;
      setUrl(nextUrl);
      setState("ready");
    }, () => {
      if (active) setState("fallback");
    });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file, hasEmbeddedPreview]);

  if (!hasEmbeddedPreview) return <FormatPreview kind={previewKind(file)} compact={compact} />;
  return (
    <PreviewFrame kind={previewKind(file)} state={state} compact={compact}>
      {state === "loading" && <PreviewSkeleton label="Opening local preview…" />}
      {state === "ready" && url && (
        <iframe
          title="Embedded Apple PDF preview"
          src={url}
          className="h-full w-full border-0"
          data-preview-iframe="apple-pdf"
        />
      )}
      {state === "fallback" && <PreviewFallback kind={previewKind(file)} failed />}
    </PreviewFrame>
  );
}

function FormatPreview({ kind, compact }: { kind: PreviewKind; compact: boolean }) {
  return (
    <PreviewFrame kind={kind} state="ready" compact={compact}>
      <PreviewFallback kind={kind} failed={false} />
    </PreviewFrame>
  );
}

/**
 * A visual enhancement only. The semantic filename stays outside this
 * decorative region so a failed preview never blocks the underlying tool.
 */
export function DocumentPreview({ file, compact = false, hasEmbeddedPreview = false }: { file: File; compact?: boolean; hasEmbeddedPreview?: boolean }) {
  const kind = previewKind(file);
  const key = `${kind}:${file.name}:${file.size}:${file.lastModified}:${hasEmbeddedPreview}`;
  if (kind === "pdf") return <PdfPreview key={key} file={file} compact={compact} />;
  if (kind === "image") return <ImagePreview key={key} file={file} compact={compact} />;
  if (kind === "pages" || kind === "keynote" || kind === "numbers") {
    return <ApplePreview key={key} file={file} compact={compact} hasEmbeddedPreview={hasEmbeddedPreview} />;
  }
  return <FormatPreview key={key} kind={kind} compact={compact} />;
}

export function FileList({
  items,
  reorderable,
  disabled,
  accepts,
  onRemove,
  onMove,
  onAddFiles,
  listRef,
}: {
  items: ListedFile[];
  reorderable: boolean;
  disabled?: boolean;
  accepts?: string;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onAddFiles?: (files: File[]) => void;
  listRef?: React.RefObject<HTMLOListElement | null>;
}) {
  const addInputRef = useRef<HTMLInputElement>(null);
  if (items.length === 0) return null;
  return (
    <div data-selected-file-preview-list="true">
      <ol
        ref={listRef}
        tabIndex={-1}
        className={`grid gap-3 ${items.length === 1 ? "max-w-[220px]" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"}`}
        aria-label="Selected files"
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            className="min-w-0 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(16,20,24,0.04)]"
            aria-posinset={index + 1}
            aria-setsize={items.length}
          >
            <div className="relative">
              <DocumentPreview file={item.file} hasEmbeddedPreview={item.hasEmbeddedPreview} />
              {reorderable && (
                <span className="absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-ink-950 px-2 text-xs font-semibold tabular-nums text-white shadow-sm" aria-label={`Position ${index + 1} of ${items.length}`}>
                  {index + 1}
                </span>
              )}
            </div>
            <div className="px-1 pt-2">
              <p className="truncate text-center text-sm font-medium text-ink-900" title={item.file.name}>
                {item.file.name}
              </p>
              <p className="mt-0.5 text-center text-xs text-ink-500">{formatBytes(item.file.size)}</p>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1" role="group" aria-label={`Actions for ${item.file.name}`}>
              {reorderable && (
                <>
                  <button
                    type="button"
                    disabled={disabled || index === 0}
                    onClick={() => onMove(item.id, -1)}
                    aria-label={`Move ${item.file.name} up`}
                    className="min-h-10 min-w-10 rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={disabled || index === items.length - 1}
                    onClick={() => onMove(item.id, 1)}
                    aria-label={`Move ${item.file.name} down`}
                    className="min-h-10 min-w-10 rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.file.name}`}
                className="min-h-10 rounded-lg border border-slate-200 px-3 py-1 text-sm text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      {onAddFiles && accepts && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-paper px-4 py-3">
          <p className="text-sm text-ink-500">{items.length} file{items.length === 1 ? "" : "s"} selected</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => addInputRef.current?.click()}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink-900 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add files
          </button>
          <input
            ref={addInputRef}
            type="file"
            accept={accepts}
            multiple
            disabled={disabled}
            className="sr-only"
            aria-label="Add more files"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              if (files.length > 0) onAddFiles(files);
              event.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
