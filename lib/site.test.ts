import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contactHref,
  hasOwnerPlaceholders,
  isContactValue,
  isHttpsUrl,
  publicSiteConfig,
} from "./site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public release configuration", () => {
  it("does not expose fake operator identity when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_OWNER_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_OWNER_CONTACT", "");
    expect(publicSiteConfig().ownerName).toBeNull();
    expect(publicSiteConfig().ownerContact).toBeNull();
    expect(hasOwnerPlaceholders()).toBe(true);
  });

  it("reads all public release fields from one configuration surface", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test/");
    vi.stubEnv("NEXT_PUBLIC_OWNER_NAME", "Example Operator");
    vi.stubEnv("NEXT_PUBLIC_OWNER_CONTACT", "privacy@example.test");
    vi.stubEnv("NEXT_PUBLIC_MAC_DOWNLOAD_URL", "https://downloads.example.test/folio.dmg");
    vi.stubEnv("NEXT_PUBLIC_SOURCE_REPOSITORY_URL", "https://github.com/example/folio");
    vi.stubEnv("NEXT_PUBLIC_SOURCE_REPOSITORY_PUBLIC", "true");
    vi.stubEnv("NEXT_PUBLIC_LEGAL_UPDATED_AT", "2026-09-08");

    expect(publicSiteConfig()).toEqual({
      siteUrl: "https://example.test",
      ownerName: "Example Operator",
      ownerContact: "privacy@example.test",
      macDownloadUrl: "https://downloads.example.test/folio.dmg",
      sourceRepositoryUrl: "https://github.com/example/folio",
      sourceRepositoryPublic: true,
      policyUpdatedAt: "2026-09-08",
    });
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
