# Folio

Folio is a free, simple, privacy-first web toolkit for everyday document and
PDF operations. Open it, pick a tool, drop files, download the result, leave.
No account, no uploads, no trackers.

“Folio understands the files you actually use on Mac.”

## Current tools (v0.2)

PDF, image and browser tools run **entirely in the browser**. Office and
iWork conversions run **locally on your Mac** via the Folio for Mac helper
(see `apps/macos-helper`) — never in the cloud.

| Tool | Route | What it does | Engine |
| ---- | ----- | ------------ | ------ |
| Merge PDF | `/tools/merge-pdf` | Combine 2–20 PDFs in your order (drag to reorder) | Browser |
| Split PDF | `/tools/split-pdf` | Extract pages via `1-3,5,8-10` syntax with validation | Browser |
| JPG/PNG → PDF | `/tools/images-to-pdf` | Up to 30 images, reorderable, one per A4 page | Browser |
| Word → PDF | `/tools/docx-to-pdf` | Browser Beta, or high fidelity with Word on Mac | Browser Beta / Word |
| Word (.doc) → PDF | `/tools/word-to-pdf` | `.doc`/`.docx` via Word on your Mac | Word (LibreOffice fallback) |
| Pages → PDF | `/tools/pages-to-pdf` | `.pages` via Pages on your Mac | Pages |
| Pages → Word | `/tools/pages-to-word` | `.pages` → `.docx` via Pages on your Mac | Pages |
| PowerPoint → PDF | `/tools/powerpoint-to-pdf` | `.ppt`/`.pptx` via PowerPoint on your Mac | PowerPoint (LibreOffice fallback) |
| Keynote → PDF (Beta / known limitation) | `/tools/keynote-to-pdf` | `.key` via Keynote on your Mac; not validated | Keynote |
| Keynote → PowerPoint (Beta / known limitation) | `/tools/keynote-to-powerpoint` | `.key` → `.pptx` via Keynote on your Mac; not validated | Keynote |
| Excel → PDF | `/tools/excel-to-pdf` | `.xls`/`.xlsx` via Excel on your Mac | Excel (LibreOffice fallback) |
| Numbers → PDF | `/tools/numbers-to-pdf` | `.numbers` via Numbers on your Mac | Numbers |
| Numbers → Excel | `/tools/numbers-to-excel` | `.numbers` → `.xlsx` via Numbers on your Mac | Numbers |
| PDF → JPG | `/tools/pdf-to-jpg` | Per-page JPGs; single download or ZIP for multi-page | Browser |
| Rotate PDF | `/tools/rotate-pdf` | All pages or selected pages, 90/180/270° clockwise | Browser |
| Compress PDF | `/tools/compress-pdf` | Object-stream rewrite; always shows before/after sizes | Browser |

**Intentionally omitted:** browser-only PPTX/XLSX conversion. Reliable
conversion needs the native desktop app or LibreOffice — both impossible in
a serverless static deployment. Shipping a fake would violate the “no fake
tools” principle. These formats convert locally via Folio for Mac instead.
See “Known limitations”.

## Privacy model

- No database, no auth, no accounts, no analytics SDKs. The hosting provider
  may still receive ordinary technical request metadata such as IP address,
  timestamps, and security logs.
- Browser tools: document bytes never leave the browser tab.
- Mac tools: the website talks to Folio for Mac over encrypted localhost only
  (`127.0.0.1:17392` in production; `17391` is development-only); conversions run in your installed desktop apps and
  every result names the engine that ran it. No document bytes reach Folio
  servers, Vercel functions, or any conversion SaaS.
- Zero third-party runtime requests: the pdf.js worker used by PDF → JPG
  is self-hosted same-origin (`/pdf.worker.min.mjs`, copied from the
  installed `pdfjs-dist` package at install/build time via
  `scripts/copy-pdf-worker.mjs`). The generated worker file is gitignored
  and never committed.
- Filenames are sanitized before download; inputs are type/size validated.

## Architecture

- **Next.js 15 (App Router) + React 19 + TypeScript (strict) + Tailwind 3**,
  deployable to Vercel’s free tier as a static-friendly app with no backend.
- **Folio for Mac helper** (`apps/macos-helper`, Swift, zero dependencies):
  localhost-only bridge (`https://127.0.0.1:17392` in production;
  `http://127.0.0.1:17391` for localhost development) driving Pages/Keynote/Numbers/
  Word/PowerPoint/Excel via AppleScript plus an honestly-labeled
  LibreOffice fallback for Office formats. See its README for the security
  model, build/test instructions, and manual-validation checklist.
- Shared workflow per tool: select/drop → validate → configure → process →
  result/download → start over (`components/ToolRunner.tsx`, `Dropzone.tsx`,
  `tool-ui.tsx`).
- Document logic in `lib/`:
  - `pdfOps.ts` — pdf-lib (merge/split/rotate/optimize/images), pdf.js
    (render via self-hosted same-origin worker), mammoth + html2canvas +
    jsPDF (DOCX), JSZip (archives).
    Heavy libs are dynamically imported so the homepage stays light.
  - `formatMatrix.ts` — the single source of truth for every conversion
    (inputs, outputs, engines, status, limitations). UI state is generated
    from it; compatibility rules are never duplicated in components.
  - `helper.ts` — localhost helper client: discovery, capabilities,
    engine route selection (`resolveConversionRoute`), filename
    sanitization, human-readable errors. Pure logic is Vitest-covered.
  - `pageRanges.ts` — range parsing/validation (tested).
  - `files.ts` — validation, size formatting, safe filenames (tested).
  - `tools.ts` — tool registry; adding a tool = one entry + one runner case.
- SEO: title/description/Open Graph metadata, `robots.ts`, `sitemap.ts`,
  SVG favicon, semantic HTML, keyboard-accessible dropzone fallback.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # vitest run
npm run build      # production build
```

Node 20+ recommended.

```bash
cd apps/macos-helper
swift build
swift test
```

## Vercel deployment

1. Import this repository in Vercel (Framework preset: Next.js).
2. Build command `npm run build`, output `.next` (defaults).
3. No database or document-processing server config is needed. Before public
   release, configure the verified operator/contact values, site URL, legal
   update date, public source repository state, and signed Mac download URL.
4. Run `npm run release:check` with those values before publishing. Metadata,
   sitemap and robots output use `NEXT_PUBLIC_SITE_URL`; the Legal Notice uses
   `NEXT_PUBLIC_OWNER_NAME` and `NEXT_PUBLIC_OWNER_CONTACT`. Set
   `NEXT_PUBLIC_SOURCE_REPOSITORY_PUBLIC=true` only after the repository is
   actually public. `NEXT_PUBLIC_MAC_DOWNLOAD_URL` must point to a signed,
   notarized installer.
   `.env.example` lists the configuration keys without containing personal data.

## Known limitations (honest)

- **DOCX → PDF (Beta):** headings, bold/italic, lists, tables and images are
  preserved, but pagination, fonts, headers/footers, footnotes, text boxes
  and tracked changes will differ from Word. Review before sharing.
- **Compress PDF:** client-side optimization only (object streams + metadata
  cleanup). Already-optimized PDFs may barely shrink; the UI says so instead
  of inventing savings. Image-heavy scanned PDFs need server-side tools
  (e.g. Ghostscript) for deep recompression — out of scope for v0.1.
- **PDF → JPG:** fully self-contained via the same-origin worker;
  very large PDFs may be slow or memory-heavy on low-end devices.
- **File caps:** PDFs ≤ 100 MB (≤ 20 files for merge), images ≤ 25 MB,
  DOCX ≤ 50 MB, Office ≤ 50 MB, iWork ≤ 100 MB — guards against browser
  memory exhaustion (the helper enforces 100 MB per conversion).
- Native iWork/Office fidelity is NOT validated in CI (runners lack the
  desktop apps). Each helper adapter requires manual validation on a Mac
  with the app installed — see `apps/macos-helper/README.md`. Nothing here
  renames extensions or rebuilds documents from plain text.
- **Keynote → PDF and Keynote → PPTX (deferred):** macOS Automation permission
  for Keynote does not remain enabled reliably in the current release. Both
  routes remain in the implementation for later compatibility work, but are
  not validated or guaranteed and are excluded from the v0.2 release verdict.

## Public release compliance

- The public legal configuration is centralized in `lib/site.ts` and checked by
  `npm run release:check` without printing environment values.
- `/privacy`, `/cookies`, `/terms`, `/legal`, `/security`, `/open-source`, and
  `/mac` describe the current local-first architecture and release limitations.
- Direct dependency notices are recorded in `docs/THIRD_PARTY_NOTICES.md`.
- The GitHub repository is currently private. The Open Source page deliberately
  does not claim public source availability until the repository is made public
  and the release configuration confirms it.

## Dependency notes

- `jspdf` is kept at v4+ (v2.x has known critical issues).
- `npm audit` may still report postcss advisories bundled through the
  pinned Next.js 15.x release; these are build-time CSS scope only
  (not document handling) and are resolved by upgrading to a patched
  Next 15.x / Next 16, deliberately deferred to avoid destabilizing v0.1.

## How to add a new Folio tool

1. Add an entry to `TOOLS` in `lib/tools.ts` (slug, accepts, limits).
2. Add a case in `run()` in `components/ToolRunner.tsx`, with the heavy
   work in a new `lib/` function (dynamically imported).
3. Only expose it in the UI when it genuinely works end-to-end — never ship
   a placeholder that renames extensions.
4. Add tests for any deterministic logic (parsing, validation, transforms).
5. Update this README’s tool table and any affected privacy notes.
