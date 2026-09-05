import Link from "next/link";

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
        <nav className="flex items-center gap-4" aria-label="Footer">
          <Link href="/#tools" className="hover:text-ink-900 hover:underline">
            Tools
          </Link>
          <Link href="/privacy" className="hover:text-ink-900 hover:underline">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
