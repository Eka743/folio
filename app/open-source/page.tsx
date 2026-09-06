import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open Source",
  description: "Folio is free and open source under the AGPL-3.0-or-later license.",
};

export default function OpenSourcePage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Open Source</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Folio is free and open source — no accounts, no trackers, no ads.
      </p>
      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">License</h2>
          <p className="mt-2">
            Folio is licensed under the <strong>GNU Affero General Public License v3.0
            or later (AGPL-3.0-or-later)</strong>. AGPL was chosen deliberately: unlike
            permissive licenses, it requires operators of hosted modified versions to
            share their source, which protects a privacy-first tool against closed
            hosted forks that users cannot audit. See LICENSE in the repository.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Source code</h2>
          <p className="mt-2">
            The repository is currently private while launch hardening lands. Once it is
            made public, this page will link the canonical repository, contribution
            guide, and dependency acknowledgements (Next.js, React, pdf-lib, pdf.js,
            mammoth, jsPDF, Tailwind CSS).
          </p>
          <p className="mt-2 text-[15px] text-ink-500" role="note">
            Launch blocker: public repository visibility is still pending. No public
            availability is claimed until then.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Security reporting</h2>
          <p className="mt-2">
            Report vulnerabilities responsibly per SECURITY.md in the repository. Do not
            open public issues for unpatched security bugs.
          </p>
        </section>
      </div>
    </div>
  );
}
