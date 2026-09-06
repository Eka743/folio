import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Folio for Mac",
  description: "Install Folio for Mac to convert Pages, Keynote, Numbers and Office documents locally — no Terminal, files never leave your Mac.",
};

const STEPS = [
  { title: "1. Download", body: "Get Folio-for-Mac.dmg from the releases page and drag Folio to Applications." },
  { title: "2. Open Folio for Mac", body: "Launch it from Applications. It shows connection status and which engines (Pages, Keynote, Numbers, Word, …) are installed." },
  { title: "3. One-time setup", body: "Trust the loopback certificate when asked (lets Folio reach your Mac securely) and approve Automation access so Pages can export locally. Each prompt appears once, with an explanation first." },
  { title: "4. Convert", body: "Return to Folio in Safari, pick e.g. Pages → PDF, drag your file, and click Convert. The PDF downloads; temporary files are deleted." },
];

export default function MacPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Folio for Mac</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        The companion that converts Pages, Keynote, Numbers, and Office documents
        locally. No Terminal. Your files never leave this Mac.
      </p>
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
      </div>
    </div>
  );
}
