"use client";

import Link from "next/link";
import type { HelperUiState } from "./useHelper";

/**
 * Non-cryptic helper connection banner. Never surfaces raw networking errors;
 * every state maps to an actionable human message.
 */
export function HelperBanner({
  state,
  requiresApp,
  compact,
  onRetry,
}: {
  state: HelperUiState;
  requiresApp?: string;
  compact?: boolean;
  onRetry?: () => void;
}) {
  if (state.kind === "checking") {
    return (
      <div role="status" className="rounded-xl border border-slate-200 bg-paper px-4 py-3 text-sm text-ink-500">
        Checking for Folio for Mac…
      </div>
    );
  }
  if (state.kind === "connected") {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
        Folio for Mac connected — your document never leaves this Mac.
      </div>
    );
  }
  if (state.kind === "setup") {
    return (
      <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
        <p className="font-medium">Folio for Mac is finishing its one-time setup.</p>
        {!compact && (
          <p className="mt-1">
            Open Folio for Mac and choose <strong>Set up secure connection</strong>
            if macOS asks for approval. This page will reconnect automatically;
            Keychain Access and Terminal are not required.
          </p>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[13px] font-medium hover:bg-amber-100"
          >
            Check again
          </button>
        )}
      </div>
    );
  }
  if (state.kind === "non-mac") {
    return (
      <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
        <p className="font-medium">This format requires macOS.</p>
        {!compact && (
          <p className="mt-1">
            Native Pages, Numbers and Office conversion runs locally on a Mac
            with Folio for Mac installed. Keynote routes are currently Beta /
            unvalidated because of a known macOS Automation limitation. There
            is no cloud conversion — your files stay private.
          </p>
        )}
      </div>
    );
  }
  // missing
  return (
    <div role="status" className="rounded-xl border border-slate-200 bg-paper px-4 py-3 text-sm leading-relaxed text-ink-700">
      <p className="font-medium text-ink-900">
        This conversion requires Folio for Mac.
      </p>
      {!compact && (
        <p className="mt-1">
          Install Folio for Mac from the
          <Link href="/mac" className="mx-1 text-accent-600 underline">
            Mac setup page
          </Link>
          {requiresApp ? ` (plus ${requiresApp}) ` : " "}
          to convert this file locally — no uploads, no cloud. If it is already
          installed, open it from Applications and this page will reconnect
          automatically.
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium hover:bg-slate-50"
        >
          Check again
        </button>
      )}
    </div>
  );
}

/** Subtle post-conversion engine transparency line. */
export function EngineBadge({ engine }: { engine: string }) {
  const label =
    engine === "browser"
      ? "Processed inside your browser"
      : engine === "libreoffice"
        ? "Converted locally using LibreOffice"
        : `Converted locally with ${engine}`;
  return (
    <p className="mt-2 text-[13px] text-ink-500" role="status">
      {label} · your document never left this device.
    </p>
  );
}
