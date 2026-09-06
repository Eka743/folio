/**
 * Canonical site URL configuration.
 *
 * Production base URL is configurable via `NEXT_PUBLIC_SITE_URL` so the
 * codebase never assumes ownership of a particular domain (folio.tools or
 * otherwise). Vercel Preview deployments use their own `VERCEL_URL`.
 * Canonical metadata helpers must use this module — never hardcode a host.
 */

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === "production") return "https://folio.tools";
  return "http://localhost:3000";
}

export function ownerName(): string {
  return process.env.NEXT_PUBLIC_OWNER_NAME?.trim() || "TODO: site owner name";
}

export function ownerContact(): string {
  return process.env.NEXT_PUBLIC_OWNER_CONTACT?.trim() || "TODO: site owner contact";
}

/** True when legally-required owner placeholders are still unset. */
export function hasOwnerPlaceholders(): boolean {
  return ownerName().startsWith("TODO:") || ownerContact().startsWith("TODO:");
}
