import Link from "next/link";
import { TOOLS } from "@/lib/tools";

const ICONS: Record<string, React.ReactNode> = {
  "merge-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v10"/><path d="m8 9 4 4 4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
  ),
  "split-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5 20 19M8 16.5 20 5"/></svg>
  ),
  "images-to-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L6 21"/></svg>
  ),
  "docx-to-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>
  ),
  "pdf-to-jpg": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="13" height="13" rx="2"/><path d="M16 8h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-4"/></svg>
  ),
  "rotate-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>
  ),
  "compress-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 14h6v6H4zM14 4h6v6h-6z"/><path d="M10 17h7a3 3 0 0 0 3-3v-1M14 7H7a3 3 0 0 0-3 3v1"/></svg>
  ),
};

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pb-10 pt-14 text-center sm:pt-20">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-paper px-3 py-1 text-[13px] font-medium text-ink-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          Free · No account · Files stay on your device
        </p>
        <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight text-ink-950 sm:text-5xl">
          Everyday PDF tools, minus the upload.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-ink-500">
          Merge, split, rotate, compress and convert your documents right in
          your browser. Nothing leaves your device.
        </p>
      </section>

      {/* Tool grid */}
      <section id="tools" className="mx-auto max-w-5xl scroll-mt-20 px-5 pb-16" aria-label="Tools">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,20,24,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(16,20,24,0.08)]"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                {ICONS[tool.slug]}
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-semibold tracking-tight text-ink-950">
                  {tool.name}
                </h2>
                {tool.badge && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-ink-500">
                    {tool.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 flex-1 text-[15px] leading-relaxed text-ink-500">
                {tool.description}
              </p>
              <span className="mt-3 text-sm font-medium text-accent-600 group-hover:underline">
                Open tool →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Privacy strip */}
      <section className="border-t border-slate-200 bg-paper" aria-label="Privacy">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 py-14 sm:grid-cols-3">
          <div>
            <h2 className="font-semibold text-ink-950">Processed locally</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-500">
              Every tool runs entirely in your browser using local libraries.
              Folio has no server storage, no accounts and no document uploads.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink-950">No trackers</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-500">
              No analytics SDKs, no ad scripts, no third-party tracking. All
              libraries — including the PDF renderer — are served from Folio
              itself.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink-950">Honest limits</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-500">
              Compression reports real before/after sizes, and conversions
              document their fidelity. Unreliable conversions are omitted, not
              faked. <Link href="/privacy" className="text-accent-600 hover:underline">Learn more</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
