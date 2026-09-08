/**
 * Public release configuration.
 *
 * Legal identity is deliberately not supplied in source control. Production
 * release checks require the operator to provide the real values through the
 * public build environment. Development and preview builds remain usable and
 * show an explicit release-readiness notice instead of fake identity data.
 */

export const DEFAULT_SITE_URL = "https://folio.tools";
export const DEFAULT_SOURCE_REPOSITORY_URL = "https://github.com/Eka743/folio";
export const DEFAULT_POLICY_UPDATED_AT = "2026-09-08";

export interface PublicSiteConfig {
  siteUrl: string;
  ownerName: string | null;
  ownerContact: string | null;
  macDownloadUrl: string | null;
  sourceRepositoryUrl: string;
  sourceRepositoryPublic: boolean;
  policyUpdatedAt: string;
}

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizedUrl(value: string | null): string | null {
  return value?.replace(/\/+$/, "") || null;
}

/** Canonical public URL used by metadata, sitemap, and robots.txt. */
export function siteUrl(): string {
  const configured = normalizedUrl(optionalEnv("NEXT_PUBLIC_SITE_URL"));
  if (configured) return configured;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === "production") return DEFAULT_SITE_URL;
  return "http://localhost:3000";
}

export function ownerName(): string | null {
  return optionalEnv("NEXT_PUBLIC_OWNER_NAME");
}

export function ownerContact(): string | null {
  return optionalEnv("NEXT_PUBLIC_OWNER_CONTACT");
}

export function macDownloadUrl(): string | null {
  return normalizedUrl(optionalEnv("NEXT_PUBLIC_MAC_DOWNLOAD_URL"));
}

export function sourceRepositoryUrl(): string {
  return normalizedUrl(optionalEnv("NEXT_PUBLIC_SOURCE_REPOSITORY_URL")) ??
    DEFAULT_SOURCE_REPOSITORY_URL;
}

export function sourceRepositoryIsPublic(): boolean {
  return /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_SOURCE_REPOSITORY_PUBLIC?.trim() ?? "");
}

export function policyUpdatedAt(): string {
  return optionalEnv("NEXT_PUBLIC_LEGAL_UPDATED_AT") ?? DEFAULT_POLICY_UPDATED_AT;
}

export function publicSiteConfig(): PublicSiteConfig {
  return {
    siteUrl: siteUrl(),
    ownerName: ownerName(),
    ownerContact: ownerContact(),
    macDownloadUrl: macDownloadUrl(),
    sourceRepositoryUrl: sourceRepositoryUrl(),
    sourceRepositoryPublic: sourceRepositoryIsPublic(),
    policyUpdatedAt: policyUpdatedAt(),
  };
}

/** True when legally-required operator values are still unset. */
export function hasOwnerPlaceholders(): boolean {
  return ownerName() === null || ownerContact() === null;
}

export function isHttpsUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function isContactValue(value: string | null): boolean {
  if (!value) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
  return isHttpsUrl(value);
}

export function contactHref(value: string | null): string | null {
  if (!value) return null;
  return value.includes("@") && !value.startsWith("http")
    ? `mailto:${value}`
    : value;
}
