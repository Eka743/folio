import type { Metadata } from "next";
import { contactHref, publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Folio protects local document processing with browser isolation and a protected loopback Mac bridge.",
};

export default function SecurityPage() {
  const config = publicSiteConfig();
  const contact = contactHref(config.ownerContact);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Security</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Local-first architecture reduces the amount of sensitive document data
        that needs to leave your device.
      </p>
      <p className="mt-2 text-sm text-ink-500">Last updated: {config.policyUpdatedAt}</p>

      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Architecture</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Browser tools run entirely in your tab; there is no document API.</li>
            <li>
              Mac-native conversions travel only to your Mac through encrypted
              loopback at 127.0.0.1:17392. Plain HTTP on :17391 is for localhost
              development only.
            </li>
            <li>No remote conversion API, document database, analytics SDK, or advertising tracker is used by Folio.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Local bridge protections</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Localhost-only binding; the helper does not listen on LAN interfaces.</li>
            <li>Host-header validation helps defend against DNS rebinding.</li>
            <li>Strict Origin allowlisting and per-launch pairing tokens.</li>
            <li>Constant-time token comparison and request rate limiting.</li>
            <li>Explicit conversion allowlist; no arbitrary shell or command execution.</li>
            <li>Sanitized filenames and 0700 per-conversion temporary directories.</li>
            <li>Temporary files are cleaned up after success or failure.</li>
            <li>100 MB helper size cap and AppleScript path quoting.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Responsible disclosure</h2>
          <p className="mt-2">
            Do not include real document contents in a report or publicly disclose
            an unpatched vulnerability. Include the affected component, version
            or commit, reproduction steps, and impact. See SECURITY.md for the
            process and scope.
          </p>
          {contact && config.ownerContact ? (
            <p className="mt-2">
              Security contact:{" "}
              <a className="text-accent-600 underline" href={contact}>
                {config.ownerContact}
              </a>
            </p>
          ) : (
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-[15px] text-amber-900" role="note">
              A public security contact must be configured before release.
            </p>
          )}
        </section>

        <p className="text-sm text-ink-500">
          These measures reduce risk but are not a guarantee of absolute security.
          Keep your browser, macOS, desktop applications, and Folio for Mac
          installation up to date.
        </p>
      </div>
    </div>
  );
}
