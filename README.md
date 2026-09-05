# Folio

Folio is a free, simple, privacy-first web toolkit for everyday document and
PDF operations. Open it, pick a tool, drop files, download the result, leave.
No account, no uploads, no trackers.

## Current tools (v0.1)

All tools run **entirely in the browser**. Files are read into tab memory and
never sent to a server.

| Tool | Route | What it does |
| ---- | ----- | ------------ |
| Merge PDF | `/tools/merge-pdf` | Combine 2–20 PDFs in your order (drag to reorder) |
| Split PDF | `/tools/split-pdf` | Extract pages via `1-3,5,8-10` syntax with validation |
| JPG/PNG → PDF | `/tools/images-to-pdf` | Up to 30 images, reorderable, one per A4 page |
| DOCX → PDF (Beta) | `/tools/docx-to-pdf` | mammoth → styled HTML → rasterized A4 PDF |
| PDF → JPG | `/tools/pdf-to-jpg` | Per-page JPGs; single download or ZIP for multi-page |
| Rotate PDF | `/tools/rotate-pdf` | All pages or selected pages, 90/180/270° clockwise |
| Compress PDF | `/tools/compress-pdf` | Object-stream rewrite; always shows before/after sizes |

**Intentionally omitted:** PPTX → PDF and XLSX → PDF. Reliable conversion
needs LibreOffice or a paid API — both incompatible with a free,
serverless, privacy-first static deployment. Shipping a fake would violate
the “no fake tools” principle. See “Known limitations”.

## Privacy model

- No database, no auth, no accounts, no analytics SDKs.
- Document bytes never leave the browser tab.
- Zero third-party runtime requests: the pdf.js worker used by PDF → JPG
  is self-hosted same-origin (`/pdf.worker.min.mjs`, copied from the
  installed `pdfjs-dist` package at install/build time via
  `scripts/copy-pdf-worker.mjs`). The generated worker file is gitignored
  and never committed.
- Filenames are sanitized before download; inputs are type/size validated.

## Architecture

- **Next.js 15 (App Router) + React 19 + TypeScript (strict) + Tailwind 3**,
  deployable to Vercel’s free tier as a static-friendly app with no backend.
- Shared workflow per tool: select/drop → validate → configure → process →
  result/download → start over (`components/ToolRunner.tsx`, `Dropzone.tsx`,
  `tool-ui.tsx`).
- Document logic in `lib/`:
  - `pdfOps.ts` — pdf-lib (merge/split/rotate/optimize/images), pdf.js
    (render via self-hosted same-origin worker), mammoth + html2canvas +
    jsPDF (DOCX), JSZip (archives).
    Heavy libs are dynamically imported so the homepage stays light.
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

## Vercel deployment

1. Import this repository in Vercel (Framework preset: Next.js).
2. Build command `npm run build`, output `.next` (defaults).
3. No environment variables, no database, no server config needed.
4. Custom domain optional; `app/sitemap.ts` and `app/robots.ts` assume
   `https://folio.tools` — update `metadataBase` in `app/layout.tsx` if your
   domain differs.

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
  DOCX ≤ 50 MB — guards against browser memory exhaustion.
- No PPTX/XLSX conversion (see above).

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
