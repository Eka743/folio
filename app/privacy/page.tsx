import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How Folio protects your documents: local browser processing, no uploads, no accounts, no trackers.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">
        Privacy
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Folio is designed so your documents never have to leave your device.
      </p>

      <div className="prose-folio mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Local processing</h2>
          <p className="mt-2">
            All seven tools — merge, split, images-to-PDF, DOCX-to-PDF,
            PDF-to-JPG, rotate and compress — run entirely in your browser
            with JavaScript libraries (pdf-lib, pdf.js, mammoth, jsPDF).
            When you “upload” a file, it is only read into your browser tab’s
            memory. There is no server endpoint that receives documents, no
            database, and no storage.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Fully self-contained</h2>
          <p className="mt-2">
            Every tool — including PDF-to-JPG — runs with libraries served
            from Folio itself. The pdf.js rendering engine is hosted
            same-origin (no third-party CDN at runtime), so using Folio
            makes zero third-party network requests. Your document bytes
            are never sent anywhere.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">What Folio doesn’t do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>No accounts, no sign-in, no personal data collection.</li>
            <li>No analytics, advertising or cross-site tracking scripts.</li>
            <li>No logging of document names, contents or conversion activity.</li>
            <li>No cookies beyond what your browser requires for the site to function.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Your responsibility</h2>
          <p className="mt-2">
            Because processing happens on your device, anyone with access to
            your device or browser downloads folder could see your files and
            results. On shared computers, delete downloaded results when you
            finish and close the tab — Folio keeps nothing, but your browser
            and OS might.
          </p>
        </section>
      </div>
    </div>
  );
}
