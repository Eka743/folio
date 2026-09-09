import type { Metadata } from "next";
import { contactHref, publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Folio protects browser-local document processing without uploads or remote conversion.",
};

export default function SecurityPage() {
  const config = publicSiteConfig();
  const contact = contactHref(config.ownerContact);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Security</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Browser-local processing reduces the amount of sensitive document data that needs to leave your device.
      </p>
      <p className="mt-2 text-sm text-ink-500">Last updated: {config.policyUpdatedAt}</p>

      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Architecture</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Browser tools process selected files entirely in the current tab.</li>
            <li>There is no document API, upload endpoint or document database.</li>
            <li>No remote conversion API, analytics SDK or advertising tracker is used by Folio.</li>
            <li>PDF rendering and conversion dependencies are served with the application.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Browser boundaries</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Files are read only after you select or drop them into a tool.</li>
            <li>Results are created as browser downloads and are not retained by Folio.</li>
            <li>File size limits and input validation reduce accidental resource exhaustion.</li>
            <li>Folio does not execute document content as code or expose a server-side conversion fallback.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Responsible disclosure</h2>
          <p className="mt-2">
            Do not include real document contents in a report or publicly disclose an unpatched vulnerability. Include the affected component, version or commit, reproduction steps and impact. See SECURITY.md for the process and scope.
          </p>
          {contact && config.ownerContact ? (
            <p className="mt-2">
              Security contact:{" "}
              <a className="text-accent-600 underline" href={contact}>{config.ownerContact}</a>
            </p>
          ) : (
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-[15px] text-amber-900" role="note">
              A public security contact must be configured before release.
            </p>
          )}
        </section>

        <p className="text-sm text-ink-500">These measures reduce risk but are not a guarantee of absolute security. Keep your browser and operating system up to date.</p>
      </div>
    </div>
  );
}
