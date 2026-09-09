import type { Metadata } from "next";
import { publicSiteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Open Source",
  description: "Folio source and licensing information.",
};

export default function OpenSourcePage() {
  const config = publicSiteConfig();
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-950">Open Source</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-500">
        Folio is free software under the AGPL-3.0-or-later licence.
      </p>
      <p className="mt-2 text-sm text-ink-500">Last updated: {config.policyUpdatedAt}</p>

      <div className="mt-8 space-y-6 text-[16px] leading-relaxed text-ink-700">
        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">License</h2>
          <p className="mt-2">
            Folio is licensed under the <strong>GNU Affero General Public License v3.0
            or later (AGPL-3.0-or-later)</strong>. The complete license is in the
            repository&apos;s <code>LICENSE</code> file.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Source code</h2>
          {config.sourceRepositoryPublic ? (
            <p className="mt-2">
              The canonical source repository is{" "}
              <a
                className="text-accent-600 underline"
                href={config.sourceRepositoryUrl}
                rel="noreferrer"
              >
                {config.sourceRepositoryUrl}
              </a>
              . It contains the web app, security policy and release documentation.
            </p>
          ) : (
            <div className="mt-2 rounded-lg bg-amber-50 p-3 text-[15px] text-amber-900" role="note">
              <p className="font-medium">Public source publication is still pending.</p>
              <p className="mt-1">
                The release configuration does not mark the canonical repository
                as public, so this page does not claim that visitors can access
                the source. Make the repository public and set
                <code className="mx-1">NEXT_PUBLIC_SOURCE_REPOSITORY_PUBLIC=true</code>
                before launch.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Third-party notices</h2>
          <p className="mt-2">
            Direct runtime and build dependencies retain their own licenses and
            notices. Folio&apos;s release audit records the direct dependency
            licenses in <code>docs/THIRD_PARTY_NOTICES.md</code>; redistributed
            builds must preserve applicable notices and license terms.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-ink-950">Security reporting</h2>
          <p className="mt-2">
            Report vulnerabilities responsibly according to SECURITY.md. Do not
            open public issues for unpatched security bugs.
          </p>
        </section>
      </div>
    </div>
  );
}
