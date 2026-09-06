import type { Metadata } from "next";
import { hasOwnerPlaceholders, ownerContact, ownerName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Legal Notice",
  description: "Legal notice and provider information for Folio.",
};

export default function LegalPage() {
  const missing = hasOwnerPlaceholders();
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Legal Notice</h1>
      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Provider</h2>
          <dl className="mt-2 space-y-1">
            <div><dt className="inline font-medium">Name: </dt><dd className="inline">{ownerName()}</dd></div>
            <div><dt className="inline font-medium">Contact: </dt><dd className="inline">{ownerContact()}</dd></div>
          </dl>
          {missing && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[15px] text-amber-900" role="note">
              Owner details are not yet configured (set NEXT_PUBLIC_OWNER_NAME and
              NEXT_PUBLIC_OWNER_CONTACT before production). No identity is fabricated
              here — this notice must be completed by the site operator.
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Open-source licensing</h2>
          <p className="mt-2">
            Folio&apos;s source code is licensed under the GNU Affero General Public
            License v3.0 or later. See the Open Source page and the LICENSE file.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Trademarks</h2>
          <p className="mt-2">
            Apple, Pages, Keynote, Numbers, and macOS are trademarks of Apple Inc.
            Microsoft Word, PowerPoint, and Excel are trademarks of the Microsoft group
            of companies. LibreOffice is a trademark of The Document Foundation. Folio
            is not affiliated with or endorsed by any of them.
          </p>
        </section>
      </div>
    </div>
  );
}
