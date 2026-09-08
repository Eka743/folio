import Link from "next/link";
import { TOOLS, type ToolSlug } from "@/lib/tools";
import {
  HOMEPAGE_CATEGORIES,
  conversionsByCategory,
  getConversionBySlug,
} from "@/lib/formatMatrix";

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
  "word-to-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>
  ),
  "pages-to-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v15H5z"/><path d="M9 12h6M9 16h6"/></svg>
  ),
  "pages-to-word": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v15H5z"/><path d="M9 12h6M9 16h4"/><path d="M16 16l2 2 3-3"/></svg>
  ),
  "powerpoint-to-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
  ),
  "keynote-to-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="m10 8 5 4-5 4z"/></svg>
  ),
  "keynote-to-powerpoint": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="13" height="12" rx="2"/><rect x="14" y="8" width="7" height="8" rx="1.5"/></svg>
  ),
  "excel-to-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 14h16M10 3v18"/></svg>
  ),
  "numbers-to-pdf": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
  ),
  "numbers-to-excel": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="3" width="12" height="18" rx="2"/><path d="M16 9h4v12h-4"/></svg>
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

function toolForSlug(slug: string) {
  return TOOLS.find((t) => t.slug === slug);
}

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
          your browser — plus local Office and iWork conversion on Mac.
          Nothing leaves your device.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-ink-500">
          Folio understands the files you actually use on Mac: Pages, Numbers,
          Word, PowerPoint and Excel. Keynote routes are currently Beta and
          unvalidated.
        </p>
      </section>

      {/* Categorized tool grid */}
      {HOMEPAGE_CATEGORIES.map((category) => {
        const conversions = conversionsByCategory(category);
        const tools = conversions
          .map((c) => toolForSlug(c.toolSlug))
          .filter((t): t is NonNullable<typeof t> => Boolean(t));
        if (tools.length === 0) return null;
        return (
          <section
            key={category}
            id={`tools-${category.toLowerCase()}`}
            className="mx-auto max-w-5xl scroll-mt-20 px-5 pb-10"
            aria-label={`${category} tools`}
          >
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
              {category === "PDF"
                ? "PDF"
                : category === "Images"
                  ? "Images"
                  : category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => {
                const conversion = getConversionBySlug(tool.slug);
                const badge =
                  conversion?.status === "helper-beta"
                    ? "Beta / known limitation"
                    : tool.badge;
                return (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,20,24,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(16,20,24,0.08)]"
                  >
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                      {ICONS[tool.slug as ToolSlug]}
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[17px] font-semibold tracking-tight text-ink-950">
                        {tool.name}
                      </h3>
                      {badge && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-ink-500">
                          {badge}
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
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Privacy strip */}
      <section className="border-t border-slate-200 bg-paper" aria-label="Privacy">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 py-14 sm:grid-cols-3">
          <div>
            <h2 className="font-semibold text-ink-950">Processed locally</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-500">
              PDF and image tools run entirely in your browser; Office and
              iWork files convert locally on your Mac with Folio for Mac.
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
              Compression reports real before/after sizes, every conversion
              names the engine that ran it, and unreliable conversions are
              omitted, not faked. <Link href="/privacy" className="text-accent-600 hover:underline">Learn more</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
