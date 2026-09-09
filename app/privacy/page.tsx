import type { Metadata } from "next";
import { contactHref, publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Folio privacy policy: local browser and Mac processing, no document uploads, no accounts, and no behavioral tracking.",
};

export default function PrivacyPage() {
  const config = publicSiteConfig();
  const contact = contactHref(config.ownerContact);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">
        Privacy Policy
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Folio is designed so document contents stay on the device where you use
        them.
      </p>
      <p className="mt-2 text-sm text-ink-500">
        Last updated: {config.policyUpdatedAt}
      </p>

      <div className="prose-folio mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">1. Operator and scope</h2>
          <p className="mt-2">
            Folio is operated by the person identified by the public operator
            label in the Legal Notice. The current public label is not a full
            legal name, and this page does not invent additional identity or
            controller details.
          </p>
          <p className="mt-2">
            This policy covers the Folio website, its browser tools, and the
            optional Folio for Mac companion used for local desktop conversion.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">2. Document processing</h2>
          <p className="mt-2">
            PDF, image, and browser-based DOCX operations run entirely in your
            browser with JavaScript libraries. A selected file is read into the
            tab&apos;s memory; Folio has no document upload endpoint, document
            database, or cloud conversion pipeline.
          </p>
          <p className="mt-2">
            Pages, Numbers, and supported Office conversions run locally on your
            Mac through Folio for Mac. The browser sends document bytes only to
            the protected loopback helper on the same device:
            <code className="ml-1 rounded bg-slate-100 px-1 text-[14px]">
              https://127.0.0.1:17392
            </code>
            . Plain HTTP on port 17391 is for localhost development only.
          </p>
          <p className="mt-2">
            Keynote → PDF and Keynote → PPTX remain Beta, deferred, and
            unvalidated because macOS Automation permission is not reliable in
            the current release. They are not guaranteed conversions.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
            <li>Folio does not receive document contents on its web servers.</li>
            <li>Folio does not use documents for model training or profiling.</li>
            <li>Temporary helper files use isolated directories and are cleaned up.</li>
            <li>Downloaded results remain subject to your browser and operating system.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">3. Website technical data</h2>
          <p className="mt-2">
            Folio does not require an account and does not intentionally collect
            document contents, advertising identifiers, or behavioural profiles.
            Folio does not sell personal data.
            Ordinary website requests may still expose technical connection data
            to the hosting/CDN provider, such as an IP address, timestamp,
            requested path, user-agent, response status, and security events.
            Those logs and their retention are controlled by the provider and
            the deployment configuration, not by Folio&apos;s document code.
          </p>
          <p className="mt-2">
            The current project deployment target is Vercel. Vercel may process
            normal request and security metadata under its own terms; Folio does
            not send document bytes to Vercel functions, a CDN, or any remote
            conversion service.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">4. Cookies and browser storage</h2>
          <p className="mt-2">
            Folio itself sets no cookies and uses no analytics, advertising, or
            cross-site tracking. The optional Mac bridge stores one strictly
            necessary per-tab pairing token in <code>sessionStorage</code>; it
            is cleared when the tab closes. Folio does not use localStorage,
            IndexedDB, fingerprinting, or a service worker for documents.
          </p>
          <p className="mt-2">
            A separate Cookie Policy explains why no consent banner is shown.
            Hosting infrastructure may have its own security or load-balancing
            mechanisms outside Folio&apos;s control.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">5. Third parties and transfers</h2>
          <p className="mt-2">
            Current public-service dependencies are limited to the website host
            and source/distribution services used to publish the project. GitHub
            hosts the source repository and security workflow; it is not a
            document-processing service. Apple, Microsoft, and The Document
            Foundation applications may receive files locally through their own
            desktop APIs when you choose a native conversion, but Folio does not
            send those files to their cloud services.
          </p>
          <p className="mt-2">
            Folio does not intentionally transfer document contents outside your
            device. Hosting providers may process technical request metadata in
            the regions and under the transfer mechanisms described in their
            current policies. The operator should confirm the production
            provider and its retention/transfer terms before publication.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">6. Retention and security</h2>
          <p className="mt-2">
            Folio does not retain document contents or conversion results on its
            web infrastructure. Browser memory, downloads, local application
            state, and helper temporary files follow the lifecycle described
            above. Technical hosting logs may be retained by the hosting provider
            under its policy; Folio does not invent a retention period it cannot
            verify.
          </p>
          <p className="mt-2">
            Security measures include browser-local processing, HTTPS loopback in
            production, localhost binding, Host and Origin validation, pairing
            tokens, request limits, filename validation, size limits, isolated
            temporary directories, and cleanup. No security measure is an
            absolute guarantee.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">7. Your rights and contact</h2>
          <p className="mt-2">
            Where GDPR or another privacy law applies, you may have rights such
            as access, correction, deletion, restriction, objection, and
            complaint to a supervisory authority. The appropriate controller,
            legal basis, and response process depend on the operator and actual
            hosting arrangement. The public contact below is the available
            channel for questions and requests.
          </p>
          {contact && config.ownerContact ? (
            <p className="mt-2">
              Privacy requests:{" "}
              <a className="text-accent-600 underline" href={contact}>
                {config.ownerContact}
              </a>
            </p>
          ) : (
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-[15px] text-amber-900" role="note">
              A public privacy contact is required before release and is configured
              through the Legal Notice release settings.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">8. Updates</h2>
          <p className="mt-2">
            Material changes will be reflected on this page with a new update
            date. This policy describes the current implementation; it is not a
            substitute for professional legal advice.
          </p>
        </section>
      </div>
    </div>
  );
}
