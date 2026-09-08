import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of use for Folio, a free open-source privacy-first document toolkit.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Terms of Use</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Plain-language terms for a free, open-source, privacy-first toolkit.
      </p>
      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">1. Free service, no warranty</h2>
          <p className="mt-2">
            Folio is provided free of charge, without warranty of any kind. Conversions are
            performed by your browser or by desktop applications on your own Mac; output
            quality depends on those local engines and the input file.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">2. Local processing</h2>
          <p className="mt-2">
            Browser tools run inside your browser. Mac-native tools run locally on your Mac
            via Folio for Mac. Folio does not operate a document-processing cloud: there is
            no document upload endpoint, no document storage, and no account system.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">3. Your files, your responsibility</h2>
          <p className="mt-2">
            You are responsible for the files you convert, including having the right to
            process them and keeping your own backups. Temporary local files created during
            conversion are deleted automatically, so keep originals.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">4. Lawful use</h2>
          <p className="mt-2">
            Do not use Folio to infringe intellectual-property rights, bypass document
            protections you are not entitled to bypass, or process material you have no
            right to process.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">5. Conversion limitations</h2>
          <p className="mt-2">
            Complex layouts, embedded fonts, macros, and proprietary features may not
            survive conversion. Folio reports which engine performed each conversion so you
            can judge fidelity. LibreOffice fallback output is always labeled as such.
          </p>
          <p className="mt-2">
            Keynote → PDF and Keynote → PPTX are currently Beta / unvalidated because
            macOS Automation permission does not remain enabled reliably. They are
            deferred known limitations, not guaranteed services.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">6. Third-party desktop applications</h2>
          <p className="mt-2">
            Native conversions rely on Apple (Pages, Keynote, Numbers), Microsoft (Word,
            PowerPoint, Excel), or LibreOffice software installed on your Mac, governed by
            their own licenses. Folio is not affiliated with Apple, Microsoft, or The
            Document Foundation.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">7. Open source</h2>
          <p className="mt-2">
            Folio is open source under the GNU Affero General Public License v3.0 or later
            (see the Open Source page). The license governs the code; these terms govern
            use of the hosted website.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">8. Liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, Folio and its contributors are not
            liable for indirect, incidental, or consequential damages arising from use of
            the service, including conversion errors or data loss. These terms do not
            overclaim enforceability: consumer rights in your jurisdiction still apply.
          </p>
        </section>
      </div>
    </div>
  );
}
