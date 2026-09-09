import type { Metadata } from "next";
import { contactHref, publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Folio privacy policy: browser-local document processing, no uploads, no accounts and no tracking.",
};

export default function PrivacyPage() {
  const config = publicSiteConfig();
  const contact = contactHref(config.ownerContact);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Privacy Policy</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Folio is designed so the documents you select stay on the device where you use them.
      </p>
      <p className="mt-2 text-sm text-ink-500">Last updated: {config.policyUpdatedAt}</p>

      <div className="prose-folio mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">1. Scope</h2>
          <p className="mt-2">
            This policy covers the public Folio web application and its browser tools. Folio does not require an account and is not a cloud document storage service.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">2. Browser-local processing</h2>
          <p className="mt-2">
            When you select a file, Folio reads it into the current browser tab and processes it there. The result is generated locally and downloaded by your browser. Folio does not operate a document upload endpoint, document database or remote conversion pipeline.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
            <li>Document bytes are not sent to Folio infrastructure.</li>
            <li>Folio does not use documents for training, profiling or advertising.</li>
            <li>Browser memory and downloaded results follow your browser and operating system lifecycle.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">3. Website technical data</h2>
          <p className="mt-2">
            Folio does not intentionally collect document contents, advertising identifiers or behavioural profiles. Ordinary website requests may expose technical connection data to the hosting provider, such as an IP address, timestamp, requested path, user agent, response status and security events. Those logs and their retention are controlled by the provider, not by Folio&apos;s document-processing code.
          </p>
          <p className="mt-2">
            The current deployment target is Vercel. Vercel may process normal request and security metadata under its own terms. Folio does not send document bytes to Vercel functions, a CDN or a remote conversion service.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">4. Cookies and storage</h2>
          <p className="mt-2">
            Folio itself sets no cookies and uses no analytics, advertising or cross-site tracking. Browser-only tools do not require localStorage, IndexedDB, a service worker or an account. Your browser may apply its own security or load-balancing mechanisms outside Folio&apos;s control.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">5. Third parties and transfers</h2>
          <p className="mt-2">
            Current public-service dependencies are limited to the website host and the source services used to publish the project. GitHub hosts the source repository and security workflow; it is not a document-processing service. Folio does not intentionally transfer document contents outside your device.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">6. Your rights and contact</h2>
          <p className="mt-2">
            Where GDPR or another privacy law applies, you may have rights such as access, correction, deletion, restriction, objection and complaint to a supervisory authority. The public contact below is the available channel for questions and requests.
          </p>
          {contact && config.ownerContact ? (
            <p className="mt-2">
              Privacy requests:{" "}
              <a className="text-accent-600 underline" href={contact}>{config.ownerContact}</a>
            </p>
          ) : (
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-[15px] text-amber-900" role="note">
              A public privacy contact is required before release and is configured through the Legal Notice release settings.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">7. Updates</h2>
          <p className="mt-2">
            Material changes will be reflected on this page with a new update date. This policy describes the current implementation and is not a substitute for professional legal advice.
          </p>
        </section>
      </div>
    </div>
  );
}
