import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">
        Page not found
      </h1>
      <p className="mt-3 text-ink-500">
        That page doesn’t exist. Try one of Folio’s document tools instead.
      </p>
      <Link
        href="/#tools"
        className="mt-6 inline-flex rounded-xl bg-ink-950 px-5 py-2.5 text-[15px] font-medium text-white hover:bg-ink-900"
      >
        Browse tools
      </Link>
    </div>
  );
}
