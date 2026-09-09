import type { Metadata } from "next";
import { publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Folio uses no non-essential cookies, analytics or trackers.",
};

export default function CookiesPage() {
  const { policyUpdatedAt } = publicSiteConfig();
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Cookie Policy</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Folio uses no non-essential cookies, so there is no cookie banner.
      </p>
      <p className="mt-2 text-sm text-ink-500">Last updated: {policyUpdatedAt}</p>
      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">No Folio cookies</h2>
          <p className="mt-2">
            Browser-only tools do not require cookies, localStorage, IndexedDB or a service worker. Files are processed in the current tab and are not cached by Folio for later use.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">What Folio does not use</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>No analytics SDKs, tracking pixels or advertising trackers.</li>
            <li>No third-party embeds, external fonts or remote runtime scripts.</li>
            <li>No account identifiers or behavioural profiles.</li>
          </ul>
          <p className="mt-3 text-[15px] text-ink-500">
            Hosting infrastructure may apply its own security or load-balancing mechanisms outside Folio&apos;s control.
          </p>
        </section>
      </div>
    </div>
  );
}
