import type { Metadata } from "next";
import { publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Folio for Mac",
  description: "Install Folio for Mac for local Pages, Numbers and Office conversion — no Terminal, files never leave your Mac. Keynote remains Beta / unvalidated.",
};

const STEPS = [
  { title: "1. Get the signed installer", body: "When the public release is available, download the signed and notarized Folio-for-Mac.dmg and drag Folio to Applications." },
  { title: "2. Open Folio for Mac", body: "Open Folio from Applications. It starts the secure local bridge automatically and shows which supported engines (Pages, Numbers, Word, …) are installed." },
  { title: "3. Approve macOS prompts", body: "Folio guides the one-time secure connection setup. When a conversion needs Pages or Numbers, macOS may ask for Automation permission; Folio explains the request immediately beforehand. Keychain Access and Terminal are not required." },
  { title: "4. Convert", body: "Return to Folio in Safari, pick e.g. Pages → PDF, drag your file, and click Convert. The PDF downloads; temporary files are deleted." },
];

export default function MacPage() {
  const { macDownloadUrl } = publicSiteConfig();
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Folio for Mac</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        The companion for local Pages, Numbers, and Office conversion. Keynote
        routes remain Beta / unvalidated. No Terminal. Your files never leave
        this Mac.
      </p>
      {macDownloadUrl ? (
        <a
          href={macDownloadUrl}
          rel="noreferrer"
          className="mt-5 inline-flex rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
        >
          Download the signed Folio for Mac
        </a>
      ) : (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="note">
          Public download is not available yet. The signed and notarized
          installer will be linked here after it passes clean-Mac Gatekeeper
          validation.
        </p>
      )}
      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        {STEPS.map((s) => (
          <section key={s.title} className="rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-ink-950">{s.title}</h2>
            <p className="mt-2">{s.body}</p>
          </section>
        ))}
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Troubleshooting</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>“Folio for Mac isn&apos;t detected.” — open the app from Applications; the browser reconnects automatically.</li>
            <li>“Pages isn&apos;t installed.” — install Pages from the App Store, or use an Office format with the labeled LibreOffice fallback.</li>
            <li>“Folio needs permission to ask Pages.” — allow the named macOS Automation prompt; the document stays on this Mac.</li>
            <li>“Secure connection setup is incomplete.” — open Folio for Mac and choose Set up secure connection. macOS handles the approval; no Keychain Access step is needed.</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Permissions and certificate</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              The loopback certificate encrypts the browser-to-helper connection
              on this Mac. Folio creates and trusts it through supported macOS
              Security APIs. It does not grant Folio internet access, access to
              unrelated files, or a general remote-control channel.
            </li>
            <li>
              macOS Automation permission is requested only when a named desktop
              app must be driven. Review the app name before allowing it, and
              revoke access later in System Settings → Privacy &amp; Security →
              Automation.
            </li>
            <li>
              Never bypass Gatekeeper or security prompts to install an
              untrusted build. The public download must point to a signed and
              notarized release.
            </li>
            <li>
              Keynote routes remain Beta / deferred / unvalidated in v0.2.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
