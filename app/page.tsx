import Link from "next/link";
import { UniversalDrop } from "@/components/UniversalDrop";
import { conversionsByCategory, HOMEPAGE_CATEGORIES } from "@/lib/formatMatrix";
import { getTool, type ToolCategory, type ToolSlug } from "@/lib/tools";

const CATEGORY_ORDER: ToolCategory[] = [...HOMEPAGE_CATEGORIES];

const ICONS: Record<ToolSlug, React.ReactNode> = {
  "merge-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v10"/><path d="m8 9 4 4 4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
  ),
  "split-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5 20 19M8 16.5 20 5"/></svg>
  ),
  "images-to-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L6 21"/></svg>
  ),
  "docx-to-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>
  ),
  "pdf-to-jpg": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="13" height="13" rx="2"/><path d="M16 8h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-4"/></svg>
  ),
  "rotate-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>
  ),
  "compress-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 14h6v6H4zM14 4h6v6h-6z"/><path d="M10 17h7a3 3 0 0 0 3-3v-1M14 7H7a3 3 0 0 0-3 3v1"/></svg>
  ),
  "markdown-to-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="m7 9 2 2 2-2M7 14h5M15 9v6m0 0 2-2m-2 2-2-2"/></svg>
  ),
  "pdf-to-markdown": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4M9 12h6M9 16h6"/></svg>
  ),
  "combine-to-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h7l3 3v5H7z"/><path d="M7 13h10v8H7z"/><path d="M14 3v3h3M10 16v3M14 16v3"/></svg>
  ),
  "pages-to-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></svg>
  ),
  "keynote-to-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 15v-4l2-2 3 3 2-2 2 2M12 3v2"/></svg>
  ),
  "numbers-to-xlsx": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16M9 8v13M15 8v13M4 13h16M4 17h16"/></svg>
  ),
  "numbers-to-pdf": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6M9 19h3"/></svg>
  ),
};

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-5xl px-5 pb-14 pt-14 sm:pt-20">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent-100 bg-accent-50 px-3 py-1 text-[13px] font-semibold text-accent-700">
            <span className="inline-block h-2 w-2 rounded-full bg-accent-600" aria-hidden="true" />
            Free, private, browser-local
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-ink-950 sm:text-6xl sm:leading-[1.05]">
            Everyday document tools, without uploading your files.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-500 sm:text-xl">
            Drop, combine, convert and organize PDFs, images and everyday
            documents in your browser. No account, no cloud processing, and no
            document bytes sent to Folio.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-ink-700">
            <a href="#tools" className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-white shadow-sm transition hover:bg-ink-900">
              Browse tools <span aria-hidden="true">↓</span>
            </a>
            <Link href="/privacy" className="rounded-lg px-2 py-2 text-accent-700 underline-offset-4 hover:underline">
              How privacy works
            </Link>
          </div>
        </div>
        <div className="mt-12 grid max-w-4xl gap-3 border-t border-slate-200 pt-5 text-sm text-ink-500 sm:grid-cols-3">
          <p><strong className="font-semibold text-ink-950">1.</strong> Select a file</p>
          <p><strong className="font-semibold text-ink-950">2.</strong> Process it locally</p>
          <p><strong className="font-semibold text-ink-950">3.</strong> Download the result</p>
        </div>
      </section>

      <UniversalDrop />

      <section id="tools" className="scroll-mt-20 border-y border-slate-200 bg-paper" aria-labelledby="tools-heading">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-14">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-700">The toolbox</p>
              <h2 id="tools-heading" className="mt-2 text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
                Small tools for everyday documents.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-ink-500">
              Everything below runs in this tab. Your file stays on your device.
            </p>
          </div>

          <div className="mt-9 space-y-10">
            {CATEGORY_ORDER.map((category) => {
              const tools = conversionsByCategory(category)
                .map((conversion) => getTool(conversion.toolSlug))
                .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));
              if (tools.length === 0) return null;
              return (
                <div key={category}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">{category}</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tools.map((tool) => (
                      <Link
                        key={tool.slug}
                        href={`/tools/${tool.slug}`}
                        className="group flex min-h-44 flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,20,24,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_28px_rgba(16,20,24,0.08)]"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600 [&>svg]:h-[22px] [&>svg]:w-[22px]">
                          {ICONS[tool.slug]}
                        </span>
                        <span className="mt-5 flex items-center gap-2">
                          <span className="text-[17px] font-semibold tracking-tight text-ink-950">{tool.name}</span>
                          {tool.badge && <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-700">{tool.badge}</span>}
                        </span>
                        <span className="mt-1 flex-1 text-[15px] leading-relaxed text-ink-500">{tool.description}</span>
                        <span className="mt-4 text-sm font-semibold text-accent-700 group-hover:underline">Open tool <span aria-hidden="true">→</span></span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-10 px-5 py-14 sm:grid-cols-3 sm:gap-8 sm:py-16" aria-label="Privacy promises">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-700">Private by default</p>
          <h2 className="mt-2 font-semibold text-ink-950">The file stays in your browser.</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-500">Folio reads and processes selected files locally. There is no upload endpoint or document storage.</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-700">No hidden layer</p>
          <h2 className="mt-2 font-semibold text-ink-950">No account. No analytics.</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-500">No sign-in, ad scripts, tracking pixels or analytics SDKs. Just the tool you came for.</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-700">Honest Beta</p>
          <h2 className="mt-2 font-semibold text-ink-950">Limits are labelled.</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-500">Browser DOCX conversion is marked Beta so you can review complex layouts before sharing.</p>
        </div>
      </section>
    </div>
  );
}
