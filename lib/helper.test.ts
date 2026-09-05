import { describe, expect, it } from "vitest";
import {
  appMissingMessage,
  extensionOf,
  helperErrorMessage,
  isAllowedOrigin,
  isMacPlatform,
  resolveConversionRoute,
  sanitizeHelperFilename,
  type HelperCapabilities,
} from "./helper";

const FULL_CAPS: HelperCapabilities = {
  pages: true,
  keynote: true,
  numbers: true,
  word: true,
  powerpoint: true,
  excel: true,
  libreoffice: false,
};

const LO_ONLY: HelperCapabilities = {
  pages: false,
  keynote: false,
  numbers: false,
  word: false,
  powerpoint: false,
  excel: false,
  libreoffice: true,
};

describe("isMacPlatform", () => {
  it("detects macOS platform strings", () => {
    expect(isMacPlatform("MacIntel")).toBe(true);
    expect(isMacPlatform("macOS")).toBe(true);
    expect(isMacPlatform("Win32")).toBe(false);
    expect(isMacPlatform(null)).toBe(false);
    expect(isMacPlatform(undefined)).toBe(false);
  });
});

describe("isAllowedOrigin", () => {
  it("allows Folio origins and rejects attackers", () => {
    expect(isAllowedOrigin("https://folio.tools")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
  });
});

describe("sanitizeHelperFilename", () => {
  it("strips directories and traversal", () => {
    expect(sanitizeHelperFilename("/etc/passwd")).toBe("passwd");
    expect(sanitizeHelperFilename("..\\..\\a.pages")).toBe("a.pages");
  });

  it("falls back on hostile names", () => {
    expect(sanitizeHelperFilename("...")).toBe("document");
    expect(sanitizeHelperFilename("")).toBe("document");
  });
});

describe("extensionOf", () => {
  it("extracts lowercase extensions", () => {
    expect(extensionOf("Deck.KEY")).toBe("key");
    expect(extensionOf("noext")).toBe("");
  });
});

describe("helperErrorMessage", () => {
  it("maps codes to human copy without stack traces", () => {
    expect(helperErrorMessage("helper_unreachable")).toMatch(/isn't running/);
    expect(helperErrorMessage("permission_denied")).toMatch(/Automation/);
    expect(helperErrorMessage("nope")).toMatch(/went wrong/);
  });
});

describe("appMissingMessage", () => {
  it("names the missing app plainly", () => {
    expect(appMissingMessage("Pages")).toMatch(/Pages isn't installed/);
    expect(appMissingMessage("Microsoft Word")).toMatch(/Word/);
  });
});

describe("resolveConversionRoute", () => {
  it("routes browser-only tools to the browser", () => {
    const r = resolveConversionRoute({
      conversionId: "merge-pdf",
      from: "pdf",
      to: "pdf",
      browserAvailable: true,
      helperConnected: false,
      isMac: false,
      capabilities: null,
      nativeEngine: null,
      fallbackToBrowser: false,
    });
    expect(r.via).toBe("browser");
  });

  it("prefers the native app when the helper is connected", () => {
    const r = resolveConversionRoute({
      conversionId: "pages-to-pdf",
      from: "pages",
      to: "pdf",
      browserAvailable: false,
      helperConnected: true,
      isMac: true,
      capabilities: FULL_CAPS,
      nativeEngine: "pages",
      fallbackToBrowser: false,
    });
    expect(r.via).toBe("helper-native");
    expect(r.engine).toBe("pages");
  });

  it("blocks iWork on Windows/Linux instead of faking it", () => {
    const r = resolveConversionRoute({
      conversionId: "pages-to-pdf",
      from: "pages",
      to: "pdf",
      browserAvailable: false,
      helperConnected: false,
      isMac: false,
      capabilities: null,
      nativeEngine: "pages",
      fallbackToBrowser: false,
    });
    expect(r.via).toBe("blocked");
    expect(r.message).toMatch(/macOS/);
  });

  it("asks for Folio for Mac when the helper is down", () => {
    const r = resolveConversionRoute({
      conversionId: "key-to-pdf",
      from: "key",
      to: "pdf",
      browserAvailable: false,
      helperConnected: false,
      isMac: true,
      capabilities: null,
      nativeEngine: "keynote",
      fallbackToBrowser: false,
    });
    expect(r.via).toBe("blocked");
    expect(r.message).toMatch(/Folio for Mac/);
  });

  it("blocks when the native app is missing (iWork never uses LibreOffice)", () => {
    const r = resolveConversionRoute({
      conversionId: "key-to-pdf",
      from: "key",
      to: "pdf",
      browserAvailable: false,
      helperConnected: true,
      isMac: true,
      capabilities: { ...FULL_CAPS, keynote: false },
      nativeEngine: "keynote",
      fallbackToBrowser: false,
    });
    expect(r.via).toBe("blocked");
  });

  it("offers LibreOffice fallback for Office formats and labels it", () => {
    const r = resolveConversionRoute({
      conversionId: "docx-to-pdf",
      from: "docx",
      to: "pdf",
      browserAvailable: false,
      helperConnected: true,
      isMac: true,
      capabilities: LO_ONLY,
      nativeEngine: "word",
      fallbackToBrowser: false,
    });
    expect(r.via).toBe("helper-fallback");
    expect(r.engine).toBe("libreoffice");
  });

  it("falls back to the browser Beta when allowed", () => {
    const r = resolveConversionRoute({
      conversionId: "docx-to-pdf",
      from: "docx",
      to: "pdf",
      browserAvailable: true,
      helperConnected: false,
      isMac: true,
      capabilities: null,
      nativeEngine: "word",
      fallbackToBrowser: true,
    });
    expect(r.via).toBe("browser");
  });

  it("rejects unknown pairs instead of renaming extensions", () => {
    const r = resolveConversionRoute({
      conversionId: "pdf-to-exe",
      from: "pdf",
      to: "exe",
      browserAvailable: false,
      helperConnected: true,
      isMac: true,
      capabilities: FULL_CAPS,
      nativeEngine: null,
      fallbackToBrowser: false,
    });
    expect(r.via).toBe("blocked");
  });

  it("keeps helper disconnected + no browser fallback blocked", () => {
    const r = resolveConversionRoute({
      conversionId: "numbers-to-pdf",
      from: "numbers",
      to: "pdf",
      browserAvailable: true,
      helperConnected: false,
      isMac: true,
      capabilities: null,
      nativeEngine: "numbers",
      fallbackToBrowser: false,
    });
    expect(r.via).toBe("blocked");
  });
});

describe("privacy copy", () => {
  it("helper routes never claim browser processing", () => {
    const r = resolveConversionRoute({
      conversionId: "pages-to-pdf",
      from: "pages",
      to: "pdf",
      browserAvailable: false,
      helperConnected: true,
      isMac: true,
      capabilities: FULL_CAPS,
      nativeEngine: "pages",
      fallbackToBrowser: false,
    });
    expect(r.message.toLowerCase()).not.toContain("browser");
  });
});
