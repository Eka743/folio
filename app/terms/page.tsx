import type { Metadata } from "next";
import { publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Plain-language terms for the free Folio browser toolkit.",
};

export default function TermsPage() {
  const { policyUpdatedAt } = publicSiteConfig();
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Terms of Use</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">Plain-language terms for a free, open-source, privacy-first browser toolkit.</p>
      <p className="mt-2 text-sm text-ink-500">Last updated: {policyUpdatedAt}</p>

      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">1. What Folio provides</h2>
          <p className="mt-2">
            Folio is a free browser-based document utility. Its tools process selected files locally in your browser. There is no required account, paid plan, document cloud or promise that every format will be available on every device.
          </p>
          <p className="mt-2">By using Folio, you agree to use it lawfully and consistently with these terms.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">2. Your files and lawful use</h2>
          <p className="mt-2">
            You remain responsible for the documents you select, your authority to process them, any personal data they contain and your own backups. Folio does not take ownership of your documents or claim a licence to use their contents.
          </p>
          <p className="mt-2">Do not use Folio to infringe intellectual-property rights, distribute unlawful material, interfere with the service or attack its security.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">3. Local processing and privacy</h2>
          <p className="mt-2">
            Folio does not operate a document-upload endpoint or retain document contents on its web infrastructure. Website hosting may still process ordinary technical request metadata as described in the Privacy and Cookie Policies.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">4. Conversion limitations</h2>
          <p className="mt-2">
            Conversion fidelity depends on the input. Complex layouts, fonts, comments, embedded objects and proprietary features may change or be lost. Browser DOCX conversion is Beta, so review the downloaded result before relying on it, especially for legal, financial, medical or safety-critical work.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">5. Open source and intellectual property</h2>
          <p className="mt-2">
            Folio source code is licensed under the GNU Affero General Public License v3.0 or later. That licence governs copying, modification and distribution of the code. These terms govern use of the hosted website and do not reduce rights granted by the software licence.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">6. Availability and disclaimer</h2>
          <p className="mt-2">
            Folio is provided on an evolving, best-effort basis. Features may be changed, suspended or discontinued. To the maximum extent permitted by applicable law, Folio is provided without an assurance of uninterrupted availability, error-free operation or perfect conversion fidelity. Keep the original file and verify important outputs.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">7. Law and contact</h2>
          <p className="mt-2">The Legal Notice provides the current public operator label and contact. Mandatory consumer and privacy rights remain unaffected by these terms.</p>
        </section>
      </div>
    </div>
  );
}
