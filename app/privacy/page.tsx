import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How Folio protects your documents: browser-local processing, Mac-local helper conversion, no uploads, no accounts, no trackers.",
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
          <h2 className="font-semibold text-ink-950">Browser conversions</h2>
          <p className="mt-2">
            PDF tools (merge, split, images-to-PDF, PDF-to-JPG, rotate,
            compress) and the fast DOCX-to-PDF Beta run{" "}
            <strong>entirely in your browser</strong> with JavaScript
            libraries (pdf-lib, pdf.js, mammoth, jsPDF). When you “upload” a
            file, it is only read into your browser tab’s memory. There is no
            server endpoint that receives documents, no database, and no
            storage.
          </p>
          <p className="mt-2 text-[15px] text-ink-500">
            After conversion the UI confirms: “Processed inside your browser.”
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Mac conversions</h2>
          <p className="mt-2">
            Pages, Keynote, Numbers and high-fidelity Office conversions are{" "}
            <strong>
              processed locally on your Mac by Folio for Mac
            </strong>
            : the Folio website talks to a localhost-only helper over an
            encrypted loopback connection (
            <code className="rounded bg-slate-100 px-1 text-[14px]">
              https://127.0.0.1:17392
            </code>
            , with plain{" "}
            <code className="rounded bg-slate-100 px-1 text-[14px]">
              http://127.0.0.1:17391
            </code>{" "}
            kept for localhost development only), which drives the desktop app you already have (Pages, Keynote,
            Numbers, Word, PowerPoint, Excel) or — only for Office formats and
            only with your knowledge — a local LibreOffice fallback. Every
            result names the engine that actually ran it (e.g. “Converted
            locally with Pages” vs “Converted locally using LibreOffice”).
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
            <li>Folio does not receive document contents.</li>
            <li>Conversions are never performed on Folio cloud servers.</li>
            <li>
              Each conversion uses a random temporary directory; input and
              output files are deleted after success or failure.
            </li>
            <li>
              Folio Helper communicates only via localhost, validates origins,
              and never accepts arbitrary commands or file paths.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Fully self-contained</h2>
          <p className="mt-2">
            Every browser tool — including PDF-to-JPG — runs with libraries
            served from Folio itself. The pdf.js rendering engine is hosted
            same-origin (no third-party CDN at runtime), so using Folio makes
            zero third-party network requests. Folio uses no document
            conversion SaaS, no remote Office automation, and no analytics.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">What Folio doesn’t do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>No accounts, no sign-in, no personal data collection.</li>
            <li>No analytics, advertising or cross-site tracking scripts.</li>
            <li>No logging of document names, contents or conversion activity.</li>
            <li>No cookies beyond what your browser requires for the site to function.</li>
            <li>No document bytes sent to Vercel functions or any cloud API.</li>
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
