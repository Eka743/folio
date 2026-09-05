import Link from "next/link";

export function ToolHeader({
  name,
  description,
  accepts,
}: {
  name: string;
  description: string;
  accepts: string;
}) {
  return (
    <div>
      <Link
        href="/#tools"
        className="text-sm font-medium text-accent-600 hover:underline"
      >
        ← All tools
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-950">
        {name}
      </h1>
      <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-ink-500">
        {description}
      </p>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-medium text-emerald-800">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        Processed in your browser — files never leave your device
      </p>
      <p className="mt-2 text-[13px] text-ink-400">
        Accepts {accepts}
      </p>
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-ink-900"
    >
      {children}
    </label>
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 py-2.5 text-[15px] font-medium text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-40 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink-900 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function StatusBox({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : kind === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-slate-200 bg-paper text-ink-700";
  const role = kind === "error" ? "alert" : "status";
  return (
    <div role={role} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}

export function ProgressBar({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-paper px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-accent-600"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-ink-700">{label}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-accent-600" />
      </div>
    </div>
  );
}
