"use client";

import { useCallback, useRef, useState } from "react";
import { formatBytes } from "@/lib/files";

export function Dropzone({
  accepts,
  multiple,
  disabled,
  onFiles,
}: {
  accepts: string;
  multiple: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (disabled) return;
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length > 0) onFiles(files);
    },
    [disabled, onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`Drop files here or press Enter to browse. Accepted: ${accepts}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (disabled) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
        dragging
          ? "border-accent-600 bg-accent-50"
          : "border-slate-300 bg-paper hover:border-slate-400 hover:bg-slate-50"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5b6b7c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
      </svg>
      <p className="mt-3 font-medium text-ink-900">
        Drop files here or <span className="text-accent-600 underline">browse</span>
      </p>
      <p className="mt-1 text-sm text-ink-500">
        {accepts} {multiple ? "· multiple files" : "· single file"}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accepts}
        multiple={multiple}
        disabled={disabled}
        aria-label={`Select ${accepts} files`}
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
    </div>
  );
}

export interface ListedFile {
  file: File;
  id: string;
}

export function FileList({
  items,
  reorderable,
  onRemove,
  onMove,
}: {
  items: ListedFile[];
  reorderable: boolean;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ol className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white" aria-label="Selected files">
      {items.map((item, i) => (
        <li key={item.id} className="flex items-center gap-3 px-4 py-3">
          {reorderable && (
            <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-ink-400" aria-hidden="true">
              {i + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900" title={item.file.name}>
              {item.file.name}
            </p>
            <p className="text-[13px] text-ink-500">{formatBytes(item.file.size)}</p>
          </div>
          {reorderable && (
            <div className="flex shrink-0 gap-1" role="group" aria-label={`Reorder ${item.file.name}`}>
              <button
                type="button"
                disabled={i === 0}
                onClick={() => onMove(item.id, -1)}
                aria-label={`Move ${item.file.name} up`}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === items.length - 1}
                onClick={() => onMove(item.id, 1)}
                aria-label={`Move ${item.file.name} down`}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.file.name}`}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-red-700 hover:bg-red-50"
          >
            Remove
          </button>
        </li>
      ))}
    </ol>
  );
}
