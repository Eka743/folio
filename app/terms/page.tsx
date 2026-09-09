import type { Metadata } from "next";
import { publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Plain-language terms for the free Folio document toolkit.",
};

export default function TermsPage() {
  const { policyUpdatedAt } = publicSiteConfig();
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Terms of Use</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Plain-language terms for a free, open-source, privacy-first toolkit.
      </p>
      <p className="mt-2 text-sm text-ink-500">Last updated: {policyUpdatedAt}</p>

      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">1. What Folio provides</h2>
          <p className="mt-2">
            Folio is a free document utility. Browser tools process files in your
            browser; optional native conversions use Folio for Mac and desktop
            software installed on your Mac. There is no required account, paid
            plan, document cloud, or promise that every format will be available
            on every device.
          </p>
          <p className="mt-2">
            By using Folio, you agree to use it lawfully and consistently with
            these terms. If you do not agree, do not use the service.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">2. Your files and lawful use</h2>
          <p className="mt-2">
            You remain responsible for the documents you select, including your
            authority to process them, any personal data they contain, and your
            own backups. Folio does not take ownership of your documents or
            claim a licence to use their contents.
          </p>
          <p className="mt-2">
            Do not use Folio to infringe intellectual-property rights, bypass
            protections you are not entitled to bypass, distribute unlawful
            material, attack the bridge, probe other users&apos; devices, or
            interfere with the service or its security.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">3. Local processing and privacy</h2>
          <p className="mt-2">
            Folio does not operate a document-upload endpoint or retain document
            contents on its web infrastructure. Mac-native requests use the
            protected loopback helper on your own device. Website hosting may
            still process ordinary technical request metadata as described in the
            Privacy and Cookie Policies.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">4. Conversion limitations</h2>
          <p className="mt-2">
            Conversion fidelity depends on the input and local engine. Complex
            layouts, fonts, macros, comments, embedded objects, and proprietary
            features may change or be lost. Always verify the downloaded result
            before relying on it, especially for legal, financial, medical, or
            safety-critical work.
          </p>
          <p className="mt-2">
            Keynote → PDF and Keynote → PPTX are Beta, deferred, and unvalidated
            because macOS Automation permission is unreliable in the current
            release. They are not guaranteed services.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">5. Desktop software</h2>
          <p className="mt-2">
            Native conversions depend on Apple Pages, Keynote, or Numbers,
            Microsoft Word, PowerPoint, or Excel, or LibreOffice installed and
            licensed separately by you. Those products and their providers have
            their own terms and privacy practices. Folio is not affiliated with
            Apple, Microsoft, or The Document Foundation.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">6. Open source and intellectual property</h2>
          <p className="mt-2">
            Folio source code is licensed under the GNU Affero General Public
            License v3.0 or later. That licence governs copying, modification,
            and distribution of the code. These terms govern use of the hosted
            website and do not reduce rights granted by the software licence.
          </p>
          <p className="mt-2">
            Third-party names and marks belong to their respective owners. Notices
            for direct software dependencies are listed in the repository&apos;s
            third-party notices document.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">7. Availability and changes</h2>
          <p className="mt-2">
            Folio is provided on an evolving, best-effort basis. Features may be
            changed, suspended, or discontinued, including where a browser,
            operating-system, desktop-app, hosting, or security change requires
            it. We may refuse or limit abusive requests to protect users and the
            service.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">8. Disclaimer and liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by applicable law, Folio is provided
            without an assurance of uninterrupted availability, error-free
            operation, or perfect conversion fidelity. Nothing in these terms
            excludes or limits a warranty, remedy, liability, or consumer right
            that cannot lawfully be excluded or limited.
          </p>
          <p className="mt-2">
            Subject to mandatory law, the operator and contributors are not liable
            for indirect or consequential loss arising from use of the service,
            including reliance on an unverified conversion. You should keep the
            original file and verify important outputs.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">9. Law and contact</h2>
          <p className="mt-2">
            The Legal Notice provides the current public operator label and
            contact. Applicable identity, governing-law, and jurisdiction details
            may need to be supplemented for a particular offering or legal
            requirement; mandatory consumer and data-protection rights remain
            unaffected by these terms.
          </p>
          <p className="mt-2">
            This page is implementation preparation, not a substitute for legal
            advice.
          </p>
        </section>
      </div>
    </div>
  );
}
