import { describe, expect, it } from "vitest";
import {
  ALLOWED_ORIGIN_SUFFIX,
  HELPER_TLS_BASE,
  HELPER_TLS_PORT,
  helperBasesForPage,
  helperErrorMessage,
  isAllowedOrigin,
} from "./helper";
import { hasOwnerPlaceholders, siteUrl } from "./site";

describe("helperBasesForPage (mixed-content fix)", () => {
  it("probes HTTPS TLS bridge first on https pages", () => {
    const bases = helperBasesForPage("https:", "folio.tools");
    expect(bases[0]).toBe(HELPER_TLS_BASE);
    expect(bases.every((b) => b.startsWith("https://"))).toBe(true);
  });

  it("includes plaintext fallback only for http localhost dev", () => {
    const bases = helperBasesForPage("http:", "localhost:3000");
    expect(bases[0]).toBe(HELPER_TLS_BASE);
    expect(bases).toContain("http://127.0.0.1:17391");
  });

  it("TLS port is 17392", () => {
    expect(HELPER_TLS_PORT).toBe(17392);
  });
});

describe("preview origin tradeoff", () => {
  it("accepts vercel preview suffix", () => {
    expect(ALLOWED_ORIGIN_SUFFIX).toBe(".vercel.app");
    expect(isAllowedOrigin("https://folio-abc123-owner.vercel.app")).toBe(true);
  });

  it("accepts www folio origin", () => {
    expect(isAllowedOrigin("https://www.folio.tools")).toBe(true);
  });

  it("rejects suffix spoofing", () => {
    expect(isAllowedOrigin("https://folio.vercel.app.evil.example")).toBe(false);
    expect(isAllowedOrigin("http://x.vercel.app")).toBe(false);
    expect(isAllowedOrigin("https://vercel.app")).toBe(false);
  });
});

describe("secure connection error copy", () => {
  it("explains secure-connection failures without stack traces", () => {
    const msg = helperErrorMessage("secure_connection");
    expect(msg).toMatch(/secure connection/i);
    expect(msg).not.toMatch(/stack|Error:|undefined/);
  });

  it("explains untrusted certificates with an action", () => {
    expect(helperErrorMessage("not_trusted")).toMatch(/Folio for Mac/i);
  });
});

describe("site configuration", () => {
  it("returns a URL string", () => {
    expect(typeof siteUrl()).toBe("string");
  });

  it("reports owner placeholders as unset by default", () => {
    expect(hasOwnerPlaceholders()).toBe(true);
  });
});
