import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security",
  description: "How Folio keeps documents local: browser processing, localhost-only Mac bridge, no cloud document pipeline.",
};

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Security</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Local-first architecture: there is no document cloud to breach.
      </p>
      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Architecture</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Browser tools run entirely in your tab (no document endpoints).</li>
            <li>
              Mac-native conversions travel only to your own Mac: Folio page →
              encrypted loopback (127.0.0.1:17392) → Folio for Mac → the desktop
              app. Plain HTTP (:17391) exists for localhost development only.
            </li>
            <li>No remote conversion APIs, no document storage, no analytics.</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Local bridge protections</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Localhost-only binding (never 0.0.0.0 or LAN interfaces).</li>
            <li>Host-header validation against DNS rebinding.</li>
            <li>Strict Origin allowlist with per-launch pairing tokens.</li>
            <li>Constant-time token comparison; short-lived per-tab sessions.</li>
            <li>Explicit conversion allowlist — no generic command execution.</li>
            <li>Sanitized filenames, confined 0700 temp dirs, guaranteed cleanup.</li>
            <li>100 MB size cap; AppleScript path quoting; no shell with untrusted input.</li>
            <li>Rolling rate limit (20 requests/minute).</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Responsible disclosure</h2>
          <p className="mt-2">
            Found a vulnerability? See SECURITY.md in the repository for the reporting
            process. Please do not open public issues for unpatched security bugs, and
            never include real document contents in a report.
          </p>
        </section>
      </div>
    </div>
  );
}
