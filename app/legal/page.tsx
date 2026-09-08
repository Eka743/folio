import type { Metadata } from "next";
import { contactHref, publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Legal Notice",
  description: "Legal notice and provider information for Folio.",
};

export default function LegalPage() {
  const config = publicSiteConfig();
  const contact = contactHref(config.ownerContact);
  const complete = Boolean(config.ownerName && config.ownerContact);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Legal Notice</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Provider information for the Folio website.
      </p>
      <p className="mt-2 text-sm text-ink-500">Last updated: {config.policyUpdatedAt}</p>

      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Provider / operator</h2>
          {complete ? (
            <dl className="mt-2 space-y-1">
              <div>
                <dt className="inline font-medium">Name: </dt>
                <dd className="inline">{config.ownerName}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Contact: </dt>
                <dd className="inline">
                  {contact ? (
                    <a className="text-accent-600 underline" href={contact}>
                      {config.ownerContact}
                    </a>
                  ) : (
                    config.ownerContact
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-[15px] text-amber-900" role="note">
              <p className="font-medium">Release configuration incomplete.</p>
              <p className="mt-1">
                The operator name and public contact must be supplied through
                <code className="mx-1">NEXT_PUBLIC_OWNER_NAME</code> and
                <code className="mx-1">NEXT_PUBLIC_OWNER_CONTACT</code> before
                this notice is published. No identity is fabricated here.
              </p>
            </div>
          )}
          <p className="mt-3 text-[15px] text-ink-500">
            The operator should add any additional information required by the
            applicable Spain/EU rules for the actual operator, such as a postal
            address, registration details, or tax identifier where applicable.
            Folio does not invent or require company-only fields for an individual
            operator.
          </p>
          <p className="mt-3 text-[15px] text-ink-500">
            Website: <code>{config.siteUrl}</code>
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Service and jurisdiction</h2>
          <p className="mt-2">
            Folio is a free web toolkit. Its browser tools process documents in
            the browser, while optional native conversions use Folio for Mac on
            the user&apos;s Mac. The Terms, Privacy, and Cookie Policies explain
            the service and its limitations.
          </p>
          <p className="mt-2">
            The operator must confirm and publish the applicable governing law and
            jurisdiction before release. Mandatory consumer and privacy rights
            are not removed by the site terms.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Open-source licensing</h2>
          <p className="mt-2">
            Folio&apos;s source code is licensed under the GNU Affero General
            Public License v3.0 or later. See the Open Source page and the
            repository&apos;s LICENSE file.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Trademarks</h2>
          <p className="mt-2">
            Apple, Pages, Keynote, Numbers, and macOS are trademarks of Apple
            Inc. Microsoft Word, PowerPoint, and Excel are trademarks of the
            Microsoft group of companies. LibreOffice is a trademark of The
            Document Foundation. Folio is not affiliated with or endorsed by any
            of them.
          </p>
        </section>
      </div>
    </div>
  );
}
