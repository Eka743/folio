# Folio Release Day — October 13, 2026

**Decision: CONDITIONAL GO**

**Application release candidate:** `audit/pre-launch-readiness` at `89c14366bebb4105ef25f3caecfe1f0b75c50b83` (`89c1436`)

**Pull request:** [#15 — Audit Folio pre-launch readiness](https://github.com/Eka743/folio/pull/15), open against `main`

**Host tested:** MacBook Air M1 (`MacBookAir10,1`, arm64, 8 GiB RAM)

**Date/time zone:** 2026-10-13, Europe/Madrid

This is a release-day follow-up to the existing [final launch report](FINAL-LAUNCH-REPORT.md), [architecture audit](pre-launch-architecture.md), and [Phase 2N performance report](../PERFORMANCE_PHASE_2N.md). It records checks run against the exact application commit above. This turn made no product-code, dependency, design, Vercel, or production changes. The PR remains unmerged; no production deployment or load test was run.

## A. Release Candidate

| Check | Result |
| --- | --- |
| Branch / upstream | `audit/pre-launch-readiness` tracks `origin/audit/pre-launch-readiness`; synchronized at `89c1436` before this report was added. |
| Worktree | No tracked changes before writing this report. The pre-existing untracked `AGENTS.md` and `marketing/` were preserved and excluded from the PR. |
| Main comparison | `origin/main...HEAD` was `0 1`: the audit branch was one commit ahead, with no divergence. |
| PR #15 | Open, base `main`, mergeable, head `89c1436`. No merge was performed. |
| Five required GitHub jobs | `chromium`, `firefox`, `webkit`, `web`, and `helper` all passed on `89c1436`. |
| Other PR statuses | Vercel preview deployment and Vercel Preview Comments also passed on that head. The preview deployment is not proof of production configuration. |

The checks above were re-read from GitHub for the actual `89c1436` PR head on October 13, not copied from an older audit. Adding this report is a documentation-only PR update; verify the checks again on the resulting head before merging.

## B. Security

### Next.js

The tested and locked framework is `next@16.3.8` (Node `v26.7.0`). Next.js 16.4.0 was released October 6, but this release does not upgrade a tested dependency solely to take a newer minor version. The 16.3.8 release is the current patch on the tested 16.3 line.

The published September advisories are patched in 16.3.8. The September 22 critical `next/og` Node `ImageResponse` RCE was fixed in 16.3.6. Source search found no `next/og`, `ImageResponse`, `next/image`, remote image configuration, or Image Optimization path in Folio. September 30's Image Optimization SSRF advisory also says configurations without `images.remotePatterns` are unaffected; Folio does not configure that feature. No currently disclosed, unpatched Next.js advisory with an applicable Folio code path was found. See the [16.3.8 release](https://github.com/vercel/next.js/releases/tag/v16.3.8) and [critical `next/og` advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j).

**Unresolved security uncertainty:** Next.js announced an out-of-band update for **October 14, 2026**, covering two Critical and one High vulnerability in upstream dependencies, but has not published affected dependencies, versions, or applicability as of this audit. This announcement is not evidence that Folio is affected, and it is not evidence that 16.3.8 is safe. Recheck the [official announcement/advisories](https://nextjs.org/blog) on October 14 and apply the smallest supported security patch if Folio is affected. Do not leave this follow-up to routine maintenance.

### npm and application security

| Command | Result |
| --- | --- |
| `npm audit` | 11 findings: 6 High and 5 Moderate. The High findings are in the Tailwind 3 development/build dependency tree (`braces`, `brace-expansion`, and related selector/glob packages); npm's forced fix would move Tailwind to v4. No such breaking migration was attempted during release preparation. |
| `npm audit --omit=dev` | 3 Moderate findings in the `mammoth → argparse@1.0.10 → sprintf-js@1.0.3` chain. The vulnerable `sprintf-js`/`argparse` CLI code was absent from `.next/static` in the release build. The conversion suite passed; this is a dependency finding, not proof of exploitability or a reason to hide the audit result. |
| Production-bundle scan | No `sprintf-js`, `argparse`, `brace-expansion`, or `postcss-selector-parser` strings/files were found under `.next/static`. |

`npm ci` completed without changing the lockfile. The existing browser tests reject malformed, empty, mismatched-extension, oversized, and invalid signature inputs and verify retry paths. On the tested paths, document bytes, filenames, and metadata stayed in the browser; E2E network inspection found no document transmission or unexpected third-party request. Repository review found no document-upload API or application database. No secret values were printed or added to the report.

### Live response headers

A low-rate read-only HTTPS request to `https://foliotools.vercel.app/` returned HTTP 200 on October 13. Its response included CSP, HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive Permissions Policy. The CSP includes `unsafe-inline` for scripts and styles; no CSP change was made in this release pass. Three sampled hashed JS/CSS assets returned 200, `x-vercel-cache: HIT`, and `public,max-age=31536000,immutable`. These public probes do not identify the production deployment's source commit.

## C. Hosting

### Hobby eligibility and configuration

The owner clarified: **“quiero que sea una app mia nada mas”** (“I want it to be just my own app”). I interpret that as personal, non-commercial intent. Vercel's current Hobby terms allow personal/non-commercial use; a public URL or free access alone does not establish commercial use. Hobby would not fit if the project is used for financial gain, including sales/ads/affiliate promotion or paid work by someone involved in producing the project. The owner should keep the project within that stated personal use. See [Hobby](https://vercel.com/docs/plans/hobby) and [Vercel Fair Use — commercial usage](https://vercel.com/docs/limits/fair-use-guidelines).

The project context says the plan is Hobby, and the user confirms personal intent; neither the team plan nor settings were available for authenticated inspection. Opening the Vercel project led to a login screen. **Dashboard checks below are UNVERIFIED, not assumed true:**

| Vercel setting | Status |
| --- | --- |
| Actual account/team plan and billing-cycle state | UNVERIFIED |
| Project connected to `Eka743/folio`; production branch is `main` | UNVERIFIED in dashboard |
| Current production deployment and deployed commit SHA | UNVERIFIED in dashboard |
| Production domain assignment and TLS/domain status | UNVERIFIED in dashboard; the public `foliotools.vercel.app` endpoint did answer over HTTPS |
| Environment variables and production values | UNVERIFIED in dashboard; no values were requested or exposed |
| Month-to-date CDN request and transfer usage / remaining quota | UNVERIFIED |
| Notifications, protection, firewall and attack-challenge settings | UNVERIFIED |
| Previous stable deployment ID and rollback availability for this project | UNVERIFIED |

Hobby currently includes 100 GB Fast Data Transfer and 1,000,000 CDN Requests per monthly period. Hobby usage over its included allowance can pause the affected service until the quota resets; it does not provide Pro-style configurable spend management or paid overage controls. Vercel says DDoS mitigation is on by default. [Current CDN quotas](https://vercel.com/docs/manage-cdn-usage) · [Plan usage and pause behavior](https://vercel.com/docs/plans).

### Traffic model

The audited cold-session sample is approximately **43 CDN requests and 413.2 KB**. The estimates below multiply that sample by visitors; decimal GB are used. This is a planning model, not a capacity guarantee. It assumes every visit is cold and does not include any current monthly usage.

| Visitors | One-day requests | One-day transfer | If sustained daily: monthly requests | If sustained daily: monthly transfer |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 43,000 (4.3% of 1M) | 0.4132 GB (0.4% of 100 GB) | 1.29M (129%) | 12.396 GB (12.4%) |
| 5,000 | 215,000 (21.5%) | 2.066 GB (2.1%) | 6.45M (645%) | 61.98 GB (62.0%) |
| 10,000 | 430,000 (43.0%) | 4.132 GB (4.1%) | 12.9M (1,290%) | 123.96 GB (124.0%) |
| 25,000 | 1.075M (107.5%) | 10.33 GB (10.3%) | 32.25M (3,225%) | 309.9 GB (309.9%) |

**CDN requests are the first modeled quota to constrain usage.** Even 1,000 new cold visits every day for 30 days would exceed the 1M request allowance while staying below the modeled transfer allowance. A single 25,000-visitor day would slightly exceed 1M requests even though its modeled transfer is only about 10.3 GB. Repeat visits and browser/CDN caching, route mix, regions, and current usage can move these numbers substantially.

For a separate concurrency model, assume 3-minute sessions spread evenly over 12 hours. Average concurrent sessions are approximately 4 / 21 / 42 / 104 at 1k / 5k / 10k / 25k visitors per day; a 5× short peak would be about 21 / 104 / 208 / 521. If 25,000 visits were instead concentrated into 15 minutes, the model is roughly 5,000 average concurrent sessions and 1,194 CDN requests/second over that interval. These are arithmetic scenarios, not load-test results or claims about Vercel capacity.

Folio performs document work in each visitor's browser, so that work does not consume Folio server CPU or transmit document data. The public site still consumes CDN requests and transfer; a large launch can still exhaust Hobby's shared project/team quotas. No production load test was run, and no paid service or plan was enabled.

## D. Memory

The release-day stress run used the actual MacBook Air M1 with 8 GiB RAM, a headless Playwright Chromium browser, the local **production build**, and generated test documents. This was not low-memory device emulation. Generated files lived under temporary storage and were removed after the run. Peak process RSS is a sampled sum for Playwright Chromium processes; it is not total machine RAM or a per-tab memory guarantee. V8 heap was sampled through Chromium CDP; process RSS was sampled at 300 ms intervals.

| Fixture and operation | Result on October 13 |
| --- | --- |
| Synthetic DOCX, 1,200 paragraphs with repeated table/image markup (7,673-byte compressed source) → PDF | 5.11 s; valid 66-page PDF, 39,047,227 bytes and 66 image objects; sampled V8 heap peak 48 MiB; sampled Chromium process RSS peak 678.7 MiB; longest observed main-thread task 147 ms. |
| Three mixed DOCX files with tables/images → one PDF | 1.00 s; valid 6-page, 2,154,194-byte output; sampled V8 heap peak 17.8 MiB; Chromium process RSS sample 680.3 MiB; longest observed task 67 ms. |
| One-page + 20-page PDF → merge | 0.19 s; reparsed, 21 pages. |
| 100-page + one-page PDF → merge | 0.17 s; reparsed, 101 pages. |
| Generated image-heavy six-page PDF (6,257,830 bytes) → JPG ZIP | 0.95 s; archive contained all six JPGs; sampled Chromium process RSS peaked at 710.4 MiB across the run. |
| Generated 20-page PDF → JPG ZIP | 0.92 s; archive contained all 20 JPGs. |

No failure or crash occurred in these cases. The browser E2E suite also exercises invalid-file recovery, PDF page-limit handling, repeated conversion and cleanup behavior. The 100-page PDF was merged and reparsed; it was **not** rasterized to 100 JPGs in this stress pass. The DOCX was deterministic synthetic content, not a byte-large real-world Office file.

The earlier [Phase 2N profile](../PERFORMANCE_PHASE_2N.md) recorded approximately 633 MB sampled Chromium JS heap and a 118 MB output for a 3× 64-page DOCX combine. That historical profile found no soak leak, but jsPDF retains page images until serialization. It was not rerun as a three-large-document batch today and remains a high-memory limitation on an 8 GB device.

The current browser run used synthetic minimal `.pages`, `.key`, and `.numbers` packages through the fixture suite. Real native iWork validation is documented in [IWork native output validation](IWORK_NATIVE_OUTPUT_VALIDATION.md) and [the Mac manual plan](../MAC_MANUAL_TEST_PLAN.md) from September; those native source files were not freshly re-run on October 13. Do not treat generated Apple ZIP/XML samples as representative native user documents.

## E. Functionality

`npm run e2e` passed **138/138** Playwright tests across Chromium, Firefox, and WebKit on October 13. The completed suite covered the public home/navigation and tool routes; PDF merge, split, rotate, compress, signing, image/PDF conversion, DOCX/PPTX/XLSX and Apple-format paths, Markdown, and mixed-document combine; output parsing/downloads; invalid and oversized input handling; recovery/retry; object URL and worker cleanup; metadata; mobile-width layouts; and privacy/network assertions. All 19 public tool routes were exercised by the route matrix. Synthetic fixtures covered tables, images, multiple sheets/slides/pages, and Unicode content.

Other current release checks: `npm test` passed 150 tests in 17 files; `npm run release:check` passed. The native helper passed 50 XCTest cases when rerun with a clean `/tmp` Swift scratch directory, and `swift build --package-path apps/folio-mac` passed.

Validation caveats, retained rather than hidden:

- `npm run lint` on the full local tree traversed the user's pre-existing untracked `marketing/` directory and failed on its vendored minified `gsap.min.js`. The tracked application lint passed with `marketing/**` excluded, and the PR `web` job passed on `89c1436`. No user marketing files were altered.
- `npm run typecheck` initially encountered stale duplicate generated `.next/types/* 2.d.ts` files in the iCloud checkout. After the production build regenerated `.next`, typecheck passed. The generated directory is ignored.
- The first in-place helper test attempt was rejected by codesign due to resource-fork metadata in the iCloud build artifact. The same source tests passed 50/50 from `/tmp`; the remote `helper` job also passed.
- WebKit is browser-engine coverage, not a physical Safari test. No Edge/Windows, iOS, Android, or iPad hardware was available. Today's Apple fixture tests were synthetic; native Pages/Keynote/Numbers evidence is historical as stated above.
- The test suite contains responsive and accessible-name checks, but no full manual WCAG 2.2 AA audit or screen-reader certification was performed today.

## F. Performance

- The live homepage was 81,264 bytes of HTML in the sampled response. Three sampled content-hashed CSS/JS assets returned CDN `HIT` with one-year immutable caching. The HTML itself is `public,max-age=0,must-revalidate`.
- The audited sample remains approximately 43 requests / 413.2 KB per cold session. A previous local-only production load run exercised 185 GETs at 10/25/50/100 concurrent clients with no HTTP failures and p95 latency of 44/23/46/68 ms. This is historical local-host data, not a Vercel benchmark.
- Current 66-page synthetic DOCX conversion completed in 5.11 s, with a 147 ms maximum observed long task. The existing three-document 64-page profile is still the more demanding memory case and remains a limitation.
- No new bundle or product optimization was justified or applied today. This audit did not collect field Core Web Vitals or a real-user INP percentile. Existing audit lab measurements must not be represented as field data.

## G. Remaining Risks

| Priority | Risk | Treatment |
| --- | --- | --- |
| P0 — Critical | None identified in the reviewed code paths or executed release checks. This is not a proof that no unknown vulnerability exists. | No known P0 blocker; keep normal incident response ready. |
| P1 — High | October 14 Next.js upstream security update has undisclosed dependencies, impact, and fixed versions. | Recheck official advisories October 14; patch promptly if affected and rerun build/tests before continued promotion. |
| P1 — High | Authenticated Vercel project/team settings, remaining quota, alert state, current production SHA and prior rollback target were not verifiable. | Owner completes the dashboard checks below before merge/promotion. |
| P1 — High | Large multi-DOCX operations can retain many raster images; the historical 3× 64-page profile used ~633 MB JS heap and emitted ~118 MB. | Avoid implying unlimited large-batch capacity. Keep the existing documented behavior; investigate separately if large-batch use is expected. |
| P1 — High | Modeled Hobby CDN request usage exceeds 1M for 25k cold visits in one day and for 1k cold visits/day sustained for a month. | Check current headroom; stage promotion and pause/slow broad promotion if approaching quota. Do not assume unlimited traffic. |
| P2 — Medium | `npm audit` reports 6 High dev-tree and 3 Moderate production dependency findings; the former are build/development packages, while `sprintf-js` is not in the shipped static bundle. | Track dependency fixes in a separate scoped update; do not force a Tailwind major migration during release. Reassess reachability when upgrading Mammoth. |
| P2 — Medium | Today's native Apple tests used synthetic packages; the last documented actual native Pages/Keynote/Numbers validation was in September. Physical Safari/iOS/Android/Windows and full WCAG checks were not repeated. | Keep format and platform claims scoped to evidence; run manual device/iWork checks as follow-up when those devices/files are available. |
| P2 — Medium | No field INP or real-user performance data, and dashboard observability was unavailable. | Use Vercel dashboard quotas and privacy-preserving user reports during the first day; do not add a paid monitoring service for this release. |

## H. Release Decision

**CONDITIONAL GO**

No P0 was found, the audited application commit passed its required checks, public tool E2E passed in three browser engines, the M1 large-document run succeeded, and the owner states that Folio is intended as a personal app. There is no currently disclosed applicable Next.js vulnerability requiring an emergency version change today.

The release is **not yet ready for production promotion** because project-specific Vercel settings and current quota headroom are unverified. Before merge, the owner must verify them in the Vercel dashboard and accept the Hobby quota risk for the planned promotion. This gate does not authorize a paid upgrade. The October 14 Next.js security disclosure remains a mandatory next-day review; its unknown details are not a reason to claim safety or to install an unrelated minor version today.

## I. Exact Next Actions

### Completed automatically

1. Validated application code commit `89c1436`; the five required GitHub jobs and both Vercel-related PR statuses were green on that head.
2. Ran the release-day unit, three-engine E2E, build/release, helper XCTest, and companion build checks listed above; created this report and preserved `AGENTS.md` and `marketing/`.
3. Confirmed the public domain response and sampled security headers/CDN asset caching without running a production load test.

### Requires owner dashboard access — before merge/promotion

1. Open the Vercel `eka-labs/folio` project. Confirm the actual Hobby plan/team, connected `Eka743/folio` repository, production branch `main`, current production deployment, and the deployment commit shown by Vercel.
2. In Domains, confirm `foliotools.vercel.app` is assigned to Production with valid HTTPS. In Environment Variables, confirm the Production scope has the correct values required by `.env.example` and site configuration; do not paste secret values into chat or this report.
3. In Usage/Observability, inspect month-to-date **CDN Requests** and Fast Data Transfer and their remaining included allowances. Check dashboard/email usage notifications and confirm DDoS mitigation/protection status. Hobby has no Pro-style spend limit to configure.
4. Decide whether to stage public promotion against the remaining quota. A modeled 25k cold-visit day crosses the 1M request allowance; sustained 1k/day also crosses it over a month. If a pause is unacceptable, do not proceed with that traffic plan on Hobby without a separate owner-approved hosting decision.
5. Identify the immediately previous successful Production deployment and confirm Instant Rollback is available. Hobby rollback only reaches the immediately previous deployment; after rollback, Vercel disables automatic production-domain assignment until another deployment is promoted. Do not execute rollback as a test. See [Instant Rollback](https://vercel.com/docs/instant-rollback).

### Requires owner approval

1. Review the dashboard results, accept the remaining listed risks, and explicitly authorize merging PR #15. Keep it open until then; Codex did not merge it.
2. Before promotion, verify the latest PR head and all required GitHub checks are green. Merge only PR #15 to `main`; then verify Vercel's new Production deployment is built from the resulting merge commit. Do not promote the preview deployment as a substitute.
3. Smoke-check the production homepage, one representative conversion and its downloaded output, security headers, static assets, and the production domain after the approved merge. No deployment was performed in this audit.

### First 24 hours after owner-approved production promotion

- Check deployment status and production domain immediately after promotion; recheck at approximately 15 minutes, 1 hour, then hourly while promotion is active. Review HTTP 4xx/5xx errors, CDN Requests, transfer, usage notifications, and outage reports in Vercel.
- For a broken conversion, reproduce with a generated fixture and capture only tool/browser/version/error text. Never request document contents, filenames, or private user samples by default.
- For a traffic spike or quota warning, inspect current consumption and slow/pause additional promotion if needed. Hobby over-limit behavior can pause service; no paid plan or on-demand spend should be enabled without owner approval.
- For a credible security issue, stop further promotion, compare the report to the official advisory, prepare a narrowly scoped patch, and roll back only if production impact is confirmed and the owner directs it. For a failed deployment, leave the last successful Production deployment in place and follow Vercel's rollback steps above.

### Deferred until October 14, 2026

1. Read the official Next.js update and all linked upstream advisories as soon as published; map affected packages/features against Folio's lockfile and code paths.
2. If affected, update to the smallest supported patched version, rerun dependency audit/build/typecheck/unit/E2E and required Swift checks, then update PR/release evidence before further broad promotion.
3. If unaffected, record the advisory applicability and evidence in a short follow-up note; do not infer non-applicability before publication.
