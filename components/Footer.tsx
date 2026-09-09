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
