import type { Metadata } from "next";
import { publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Folio uses no non-essential cookies, no analytics, and no trackers.",
};

export default function CookiesPage() {
  const { policyUpdatedAt } = publicSiteConfig();
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Cookie Policy</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Folio uses no non-essential cookies — so there is no cookie banner.
      </p>
      <p className="mt-2 text-sm text-ink-500">Last updated: {policyUpdatedAt}</p>
      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Strictly necessary storage only</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Pairing token</strong> (sessionStorage, per tab): proves the Folio
              tab paired with your local Folio for Mac helper. Cleared when the tab
              closes. Strictly necessary for the secure localhost bridge.
            </li>
            <li>
              No cookie is required for browser-only tools. The pairing token is
              not an advertising, analytics, or cross-site identifier.
            </li>
            <li>
              <strong>Hosting infrastructure</strong>: the static host may set load-
              balancing or security cookies outside Folio&apos;s control; Folio itself
              sets none.
            </li>
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">What Folio does not use</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>No analytics SDKs, tracking pixels, or advertising trackers.</li>
            <li>No localStorage or IndexedDB for documents.</li>
            <li>No third-party embeds, external fonts, or remote scripts at runtime.</li>
            <li>No service worker — documents are never cached for offline use.</li>
          </ul>
          <p className="mt-2 text-[15px] text-ink-500">
            No consent banner is shown because Folio uses only strictly necessary
            browser storage. Full audit: docs/COOKIE_STORAGE_AUDIT.md in the
            repository.
          </p>
        </section>
      </div>
    </div>
  );
}
