/**
 * Folio for Mac helper client (web side).
 *
 * Architecture: Folio Web -> http://127.0.0.1:17391 (localhost only)
 * -> Folio Helper for macOS -> native app automation -> result bytes
 * returned to the browser. Documents never touch a Folio cloud server.
 *
 * This module has two layers:
 * 1. Pure, Node-testable logic (route selection, origin checks, filename
 *    sanitization, error messages). Covered by `lib/helper.test.ts`.
 * 2. Thin browser `fetch` wrappers (probeHelper, fetchCapabilities,
 *    convertViaHelper). Only invoked from client components.
 */

import { isHelperConversionAllowed } from "./formatMatrix";

export const HELPER_HOST = "127.0.0.1";
export const HELPER_PORT = 17391;
export const HELPER_BASE = `http://${HELPER_HOST}:${HELPER_PORT}`;
export const HELPER_VERSION = "0.2.0";

/** Origins the helper trusts. The Swift helper enforces the same list. */
export const ALLOWED_FOLIO_ORIGINS = [
  "https://folio.tools",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const;

export interface HelperCapabilities {
  pages: boolean;
  keynote: boolean;
  numbers: boolean;
  word: boolean;
  powerpoint: boolean;
  excel: boolean;
  libreoffice: boolean;
  platform?: string;
}

export type HelperConnection =
  | { state: "unknown" }
  | { state: "connected"; capabilities: HelperCapabilities }
  | { state: "disconnected" }
  | { state: "wrong-os" };

export type RouteVia =
  | "browser"
  | "helper-native"
  | "helper-fallback"
  | "blocked";

export interface RouteDecision {
  via: RouteVia;
  /** Engine id for transparency UI (e.g. "word", "pages", "libreoffice"). */
  engine: string | null;
  /** Human-readable explanation for the chosen route / blocker. */
  message: string;
}

/** Browser platform sniffing (pure + testable). Pass `navigator.platform`. */
export function isMacPlatform(platform: string | undefined | null): boolean {
  if (!platform) return false;
  return /mac/i.test(platform);
}

/** Origin allowlist check. Mirrors the Swift helper's validation. */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const normalized = `${url.protocol}//${url.host}`;
    return (ALLOWED_FOLIO_ORIGINS as readonly string[]).includes(normalized);
  } catch {
    return false;
  }
}

/**
 * Sanitize an untrusted filename before sending it to the helper.
 * Mirrors Swift `sanitizeFilename`: strips directories, blocks traversal,
 * keeps a safe subset, caps length.
 */
export function sanitizeHelperFilename(name: string, fallback = "document"): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // Remove NUL / control chars.
  const noControls = base.replace(/[\0-\x1f\x7f]/g, "");
  const trimmed = noControls.trim().replace(/^\.+/, "");
  const cleaned = trimmed
    .replace(/[^A-Za-z0-9._\- ()[\]]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\- ]+|[.\- ]+$/g, "")
    .slice(0, 100);
  return cleaned || fallback;
}

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx + 1).toLowerCase();
}

export function helperErrorMessage(code: string, hint?: string): string {
  const map: Record<string, string> = {
    helper_unreachable: "Folio for Mac isn't running.",
    not_mac: "This format requires macOS.",
    app_missing: "The required desktop app isn't installed.",
    permission_denied:
      "macOS denied permission to control the desktop app. Open System Settings → Privacy & Security → Automation and allow Folio Helper, then try again.",
    open_failed: "The desktop app couldn't open this document.",
    convert_failed: "The converted file could not be created.",
    damaged: "This document appears to be damaged.",
    too_large: "This file is too large for local conversion.",
    bad_request: "The conversion request was invalid.",
    forbidden: "The helper refused this request.",
  };
  const base = map[code] ?? "Something went wrong during conversion.";
  return hint ? `${base} ${hint}` : base;
}

/**
 * Decide which engine should handle a conversion.
 * Pure function — fully unit-tested, no network.
 */
export function resolveConversionRoute(opts: {
  conversionId: string;
  from: string;
  to: string;
  browserAvailable: boolean;
  helperConnected: boolean;
  isMac: boolean;
  capabilities: HelperCapabilities | null;
  nativeEngine: string | null;
  fallbackToBrowser: boolean;
}): RouteDecision {
  const {
    from,
    to,
    browserAvailable,
    helperConnected,
    isMac,
    capabilities,
    nativeEngine,
    fallbackToBrowser,
  } = opts;

  if (!isHelperConversionAllowed(from, to)) {
    // Browser-only conversions (PDF tools) or unknown pairs.
    if (browserAvailable) {
      return {
        via: "browser",
        engine: "browser",
        message: "Processed inside your browser.",
      };
    }
    return {
      via: "blocked",
      engine: null,
      message: `Folio doesn't support ${from.toUpperCase()} → ${to.toUpperCase()} yet.`,
    };
  }

  // Helper-eligible pair.
  if (!isMac) {
    if (browserAvailable && fallbackToBrowser) {
      return {
        via: "browser",
        engine: "browser",
        message:
          "Native conversion needs macOS — using the browser conversion instead (quality may differ).",
      };
    }
    return {
      via: "blocked",
      engine: null,
      message:
        "This format requires macOS with Folio for Mac. Your document never leaves your Mac — there is no cloud conversion.",
    };
  }

  if (!helperConnected || !capabilities) {
    if (browserAvailable && fallbackToBrowser) {
      return {
        via: "browser",
        engine: "browser",
        message:
          "Folio for Mac isn't running — using the browser conversion instead (quality may differ). Install Folio for Mac for high-fidelity results.",
      };
    }
    return {
      via: "blocked",
      engine: null,
      message: "Install Folio for Mac to convert this file locally.",
    };
  }

  const need = (nativeEngine ?? "").toLowerCase();
  const hasNative =
    (need === "pages" && capabilities.pages) ||
    (need === "keynote" && capabilities.keynote) ||
    (need === "numbers" && capabilities.numbers) ||
    (need === "word" && capabilities.word) ||
    (need === "powerpoint" && capabilities.powerpoint) ||
    (need === "excel" && capabilities.excel);

  if (hasNative) {
    return {
      via: "helper-native",
      engine: need,
      message: `Converted locally with ${need}.`,
    };
  }

  // LibreOffice fallback only for Office formats, never for iWork.
  const officeFallback =
    (need === "word" || need === "powerpoint" || need === "excel") &&
    capabilities.libreoffice;
  if (officeFallback) {
    return {
      via: "helper-fallback",
      engine: "libreoffice",
      message:
        "The native app isn't installed — convert locally with LibreOffice instead (quality may differ).",
    };
  }

  if (browserAvailable && fallbackToBrowser) {
    return {
      via: "browser",
      engine: "browser",
      message:
        "The required desktop app isn't installed — using the browser conversion instead (quality may differ).",
    };
  }

  return {
    via: "blocked",
    engine: null,
    message: `${opts.conversionId}: the required desktop app isn't installed on this Mac.`,
  };
}

/** Friendly app-missing copy per conversion. */
export function appMissingMessage(app: string | null): string {
  if (!app) return "The required desktop app isn't installed on this Mac.";
  if (app === "Pages") return "Pages isn't installed on this Mac.";
  if (app === "Keynote") return "Keynote isn't installed on this Mac.";
  if (app === "Numbers") return "Numbers isn't installed on this Mac.";
  return `${app} isn't installed on this Mac.`;
}

// ---- Browser fetch wrappers (not covered by node tests) ----

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms = 2500,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(t);
  }
}

function browserOrigin(): string {
  try {
    return window.location.origin;
  } catch {
    return "";
  }
}

export async function probeHelper(port = HELPER_PORT): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `http://${HELPER_HOST}:${port}/v1/status`,
      { headers: { Origin: browserOrigin() } },
      1500,
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchCapabilities(
  port = HELPER_PORT,
): Promise<HelperCapabilities | null> {
  try {
    const res = await fetchWithTimeout(
      `http://${HELPER_HOST}:${port}/v1/capabilities`,
      { headers: { Origin: browserOrigin() } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as HelperCapabilities;
    return json;
  } catch {
    return null;
  }
}

export interface HelperConvertResult {
  outputFilename: string;
  engine: string;
  contentBase64: string;
}

export async function convertViaHelper(opts: {
  from: string;
  to: string;
  file: File;
  port?: number;
  token?: string;
  onProgress?: (stage: string) => void;
}): Promise<HelperConvertResult> {
  const port = opts.port ?? HELPER_PORT;
  opts.onProgress?.("Uploading to Folio for Mac (localhost)…");
  const buffer = new Uint8Array(await opts.file.arrayBuffer());
  // Base64 without blowing the stack on large files.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
  }
  const contentBase64 = btoa(binary);
  opts.onProgress?.("Converting locally on your Mac…");
  const res = await fetchWithTimeout(
    `http://${HELPER_HOST}:${port}/v1/convert`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: browserOrigin(),
        ...(opts.token ? { "X-Folio-Token": opts.token } : {}),
      },
      body: JSON.stringify({
        from: opts.from.toLowerCase(),
        to: opts.to.toLowerCase(),
        filename: sanitizeHelperFilename(opts.file.name),
        contentBase64,
      }),
    },
    120_000,
  );
  if (!res.ok) {
    let code = "convert_failed";
    let hint = "";
    try {
      const j = (await res.json()) as { error?: string; hint?: string };
      if (j.error) code = j.error;
      if (j.hint) hint = j.hint;
    } catch {
      /* keep defaults */
    }
    throw new Error(helperErrorMessage(code, hint));
  }
  const json = (await res.json()) as HelperConvertResult;
  return json;
}

/** Decode helper base64 payload into bytes (browser). */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
