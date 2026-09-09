import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OWNER_CONTACT,
  DEFAULT_OWNER_NAME,
  DEFAULT_SITE_URL,
  contactHref,
  hasOwnerPlaceholders,
  isContactValue,
  isHttpsUrl,
  publicSiteConfig,
  siteUrl,
} from "./site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public release configuration", () => {
  it("uses the approved public operator label and contact when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_OWNER_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_OWNER_CONTACT", "");
    expect(publicSiteConfig().ownerName).toBe(DEFAULT_OWNER_NAME);
    expect(publicSiteConfig().ownerContact).toBe(DEFAULT_OWNER_CONTACT);
    expect(hasOwnerPlaceholders()).toBe(false);
  });

  it("treats the now-public source repository as public by default", () => {
    vi.unstubAllEnvs();
    expect(publicSiteConfig().sourceRepositoryPublic).toBe(true);
  });

  it("keeps production metadata on the public domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "folio-preview.vercel.app");
    vi.stubEnv("NODE_ENV", "production");

    expect(siteUrl()).toBe(DEFAULT_SITE_URL);
  });

  it("uses the deployment hostname for preview metadata when no public URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "folio-preview.vercel.app");
    vi.stubEnv("NODE_ENV", "production");

    expect(siteUrl()).toBe("https://folio-preview.vercel.app");
  });

  it("reads all public release fields from one configuration surface", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test/");
    vi.stubEnv("NEXT_PUBLIC_OWNER_NAME", "Example Operator");
    vi.stubEnv("NEXT_PUBLIC_OWNER_CONTACT", "privacy@example.test");
    vi.stubEnv("NEXT_PUBLIC_SOURCE_REPOSITORY_URL", "https://github.com/example/folio");
    vi.stubEnv("NEXT_PUBLIC_SOURCE_REPOSITORY_PUBLIC", "true");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_UPDATED_AT", "2026-09-08");

    expect(publicSiteConfig()).toEqual({
      siteUrl: "https://example.test",
      ownerName: "Example Operator",
      ownerContact: "privacy@example.test",
      sourceRepositoryUrl: "https://github.com/example/folio",
      sourceRepositoryPublic: true,
      policyUpdatedAt: "2026-09-08",
    });
  });

  it("treats placeholder identity values as incomplete", () => {
    vi.stubEnv("NEXT_PUBLIC_OWNER_NAME", "TODO: add name");
    vi.stubEnv("NEXT_PUBLIC_OWNER_CONTACT", "placeholder@example.test");
    expect(hasOwnerPlaceholders()).toBe(true);
  });

  it("accepts only secure public URLs and usable contacts", () => {
    expect(isHttpsUrl("https://folio.tools")).toBe(true);
    expect(isHttpsUrl("http://localhost:3000")).toBe(false);
    expect(isContactValue("privacy@folio.tools")).toBe(true);
    expect(isContactValue("https://folio.tools/contact")).toBe(true);
    expect(isContactValue("not-an-email")).toBe(false);
    expect(contactHref("privacy@folio.tools")).toBe("mailto:privacy@folio.tools");
  });
});
