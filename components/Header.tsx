import Link from "next/link";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Folio home">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        role="img"
        aria-hidden="true"
      >
        <rect
          x="5"
          y="3"
          width="15"
          height="21"
          rx="2.5"
          fill="#fff"
          stroke="#101418"
          strokeWidth="2"
        />
        <rect x="10" y="7" width="17" height="22" rx="2.5" fill="#2563eb" />
        <line x1="14" y1="13" x2="23" y2="13" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="18" x2="23" y2="18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="23" x2="20" y2="23" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-[19px] font-semibold tracking-tight text-ink-950">
        Folio
      </span>
    </span>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="rounded-md">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-[15px]" aria-label="Primary">
          <Link
            href="/#tools"
            className="rounded-md px-3 py-2 text-ink-700 hover:bg-slate-100 hover:text-ink-950"
          >
            Tools
          </Link>
          <Link
            href="/privacy"
            className="rounded-md px-3 py-2 text-ink-700 hover:bg-slate-100 hover:text-ink-950"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </header>
  );
}
