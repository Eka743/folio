"use client";

import { forwardRef, useCallback, useRef, useState } from "react";

export { FileList } from "@/components/DocumentPreview";
export type { ListedFile } from "@/components/DocumentPreview";

type DropzoneProps = {
  accepts: string;
  multiple: boolean;
  disabled?: boolean;
  compact?: boolean;
  onFiles: (files: File[]) => void | Promise<void>;
  onDropIssue?: (message: string) => void;
};

export const Dropzone = forwardRef<HTMLDivElement, DropzoneProps>(function Dropzone(
  {
    accepts,
    multiple,
    disabled,
    compact = false,
    onFiles,
    onDropIssue,
  },
  ref,
) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const openPicker = useCallback(() => {
    if (disabled || !inputRef.current) return;
    // Clear the previous selection before opening the picker. Clearing after
    // change invalidates picker-backed File handles in some WebKit builds
    // while an async inspection or conversion is still reading them.
    inputRef.current.value = "";
    inputRef.current.click();
  }, [disabled]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (disabled) return;
      const hasDirectory = [...(e.dataTransfer?.items ?? [])].some((item) => {
        const entry = (item as DataTransferItem & {
          webkitGetAsEntry?: () => { isDirectory?: boolean } | null;
        }).webkitGetAsEntry?.();
        return entry?.isDirectory === true;
      });
      if (hasDirectory) {
        onDropIssue?.("Folders aren’t supported here. Select a file instead.");
        return;
      }
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length === 0) return;
      if (!multiple && files.length > 1) {
        onDropIssue?.("Select one file at a time here.");
        return;
      }
      onFiles(files);
    },
    [disabled, multiple, onDropIssue, onFiles],
  );

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`Drop files here or press Enter to browse. Accepted: ${accepts}`}
      data-dropzone="true"
      data-dropzone-state={compact ? "compact" : "empty"}
      onClick={openPicker}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          openPicker();
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
      className={`flex cursor-pointer items-center rounded-2xl border-2 border-dashed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 ${
        compact
          ? "min-h-20 gap-3 px-4 py-4 text-left"
          : "min-h-44 flex-col justify-center px-6 py-10 text-center"
      } ${
        dragging
          ? "border-accent-600 bg-accent-50"
          : "border-slate-300 bg-paper hover:border-slate-400 hover:bg-slate-50"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <svg width={compact ? "24" : "32"} height={compact ? "24" : "32"} viewBox="0 0 24 24" fill="none" stroke="#5b6b7c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
      </svg>
      <div className={compact ? "min-w-0" : "w-full min-w-0"}>
        <p className={`${compact ? "" : "mt-3"} font-medium text-ink-900`}>
          Drop files here or <span className="text-accent-600 underline">browse</span>
        </p>
        <p className={`${compact ? "hidden sm:block" : "mt-1"} max-w-full break-words text-sm text-ink-500`}>
          {accepts} {multiple ? "· multiple files" : "· single file"}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accepts}
        data-dropzone-input="true"
        multiple={multiple}
        disabled={disabled}
        aria-label={`Select ${accepts} files`}
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length > 0) onFiles(files);
        }}
      />
    </div>
  );
});
