import type { Metadata } from "next";
import { publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Folio for Mac",
  description: "Install Folio for Mac for local Pages, Numbers and Office conversion — no Terminal, files never leave your Mac. Keynote remains Beta / unvalidated.",
};

const STEPS = [
  { title: "1. Download", body: "Download the signed, notarized Folio-for-Mac.dmg from the published link below and drag Folio to Applications." },
  { title: "2. Open Folio for Mac", body: "Launch it from Applications. It shows connection status and which supported engines (Pages, Numbers, Word, …) are installed." },
  { title: "3. One-time setup", body: "Open the loopback certificate from Folio for Mac and set it to Always Trust in Keychain Access. Approve Automation access only for the named supported app when a conversion needs it. Keynote conversion remains a Beta / known limitation and is not validated in v0.2." },
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
          The signed Mac installer is not published yet. A site operator must
          set <code>NEXT_PUBLIC_MAC_DOWNLOAD_URL</code> after a signed,
          notarized build passes clean-Mac validation. Developers can build from
          source, but normal users should not need Terminal.
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
            <li>“Folio for Mac isn&apos;t running.” — open the app from Applications.</li>
            <li>“Pages isn&apos;t installed.” — install Pages from the App Store, or use an Office format with the labeled LibreOffice fallback.</li>
            <li>“Folio needs permission to use Pages.” — allow it once under System Settings → Privacy &amp; Security → Automation.</li>
            <li>“Couldn&apos;t establish a secure connection.” — open Folio for Mac and complete the certificate trust step.</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Permissions and certificate</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              The loopback certificate encrypts the browser-to-helper connection
              on this Mac. It does not grant Folio internet access, access to
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
