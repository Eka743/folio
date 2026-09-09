import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/legal", label: "Legal" },
  { href: "/open-source", label: "Open Source" },
  { href: "/security", label: "Security" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-paper">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-ink-900">Folio</p>
          <p className="mt-1 max-w-md">
            Free, privacy-first document tools. Your files are processed in
            your browser and never uploaded.
          </p>
          <nav className="mt-4 flex items-center gap-1.5" aria-label="Social links">
            <a
              href="https://x.com/ItsEkAItzV"
              target="_blank"
              rel="noreferrer"
              aria-label="X — ItsEkAItzV"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition hover:bg-slate-100 hover:text-ink-900 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
              </svg>
            </a>
            <a
              href="https://github.com/Eka743/folio"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub — Folio repository"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition hover:bg-slate-100 hover:text-ink-900 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.157-1.11-1.465-1.11-1.465-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.089 2.91.833.091-.647.35-1.089.636-1.34-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.987 1.029-2.687-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 7.844a9.55 9.55 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.594 1.028 2.687 0 3.848-2.339 4.695-4.566 4.943.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.748 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.523 2 12 2Z" clipRule="evenodd" />
              </svg>
            </a>
          </nav>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Footer">
          <Link href="/#tools" className="hover:text-ink-900 hover:underline">
            Tools
          </Link>
          <Link href="/privacy" className="hover:text-ink-900 hover:underline">
            Privacy
          </Link>
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink-900 hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
