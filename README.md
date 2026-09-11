# Folio

Folio is a free, simple, privacy-first browser toolkit for everyday document
and PDF operations. Open it, pick a tool, select a file, download the result.
No account, no uploads, no trackers.

## Public web tools

Every public tool below processes files locally in the browser. Results are
generated in the current tab and downloaded by your browser.

| Tool | Route | What it does | Status |
| ---- | ----- | ------------ | ------ |
| Merge PDF | `/tools/merge-pdf` | Combine 2–20 PDFs in your order | Browser |
| Split PDF | `/tools/split-pdf` | Extract pages with `1-3,5,8-10` syntax | Browser |
| JPG/PNG → PDF | `/tools/images-to-pdf` | Convert up to 30 images, one per A4 page | Browser |
| Word → PDF | `/tools/docx-to-pdf` | Convert `.docx` in the browser | Browser Beta |
| PDF → JPG | `/tools/pdf-to-jpg` | Render pages as JPGs, one download or ZIP | Browser |
| Rotate PDF | `/tools/rotate-pdf` | Rotate all or selected pages | Browser |
| Compress PDF | `/tools/compress-pdf` | Rewrite PDFs and show honest size changes | Browser |
| Markdown → PDF | `/tools/markdown-to-pdf` | Render Markdown as a polished A4 PDF | Browser |
| PDF → Markdown | `/tools/pdf-to-markdown` | Extract readable structure from text PDFs | Browser Beta |

Historical native conversion experiments remain in the repository for future
work, but they are dormant and are not part of the public website, navigation,
sitemap or release process.

## Privacy model

- No database, auth, accounts, analytics SDKs, telemetry or document uploads.
- Selected files stay in the browser tab. Folio does not receive document
  bytes and has no cloud processing fallback.
- No third-party runtime requests. The pdf.js worker for PDF → JPG is
  self-hosted same-origin and copied from the installed dependency at build
  time.
- Filenames are sanitized before download, and inputs are type and size
  validated.

The hosting provider may still receive ordinary technical request metadata such
as IP address, timestamps, paths and security logs under its own policies.

## Architecture

- **Next.js 16 + React 19 + TypeScript + Tailwind 3**, deployable to Vercel
  without a document-processing backend.
- **Public tool allowlist:** `lib/tools.ts` and `lib/formatMatrix.ts` define
  only browser-local tools. `lib/dormantFormatMatrix.ts` is isolated from the
  public runtime and documents historical native pairs for repository work.
- **Document logic:** `lib/pdfOps.ts` uses pdf-lib, pdf.js, mammoth, html2canvas,
  jsPDF and JSZip. Heavy libraries are dynamically imported so the homepage
  stays light.
- **Shared workflow:** select/drop → validate → configure → process →
  result/download → start over.
- **SEO:** title/description/Open Graph metadata, robots, sitemap, SVG favicon
  and keyboard-accessible dropzone fallback.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm test           # vitest run
npm run build      # production build
npm audit
npm run release:check
```

Node 20.19+ is required by the current Next.js/tooling release.

## Deployment

1. Import this repository in Vercel with the Next.js framework preset.
2. Use `npm run build` as the build command.
3. No database or document-processing server configuration is needed.
4. Run the validation commands above before publishing.

## Known limitations

- **DOCX → PDF (Beta):** headings, bold/italic, lists, tables and images are
  supported, but pagination, fonts, headers/footers, footnotes, text boxes and
  tracked changes may differ. Review before sharing.
- **Markdown → PDF:** raw HTML is disabled and remote images are omitted rather
  than fetched. The output is laid out for readable A4 pages.
- **PDF → Markdown (Beta):** this is text extraction and reconstruction, not a
  perfect inverse of the source. Scanned pages, complex columns, tables and
  exact original formatting may need manual cleanup.
- **Compress PDF:** client-side optimization only. Already-optimized PDFs may
  barely shrink, and image-heavy scans need deeper recompression outside this
  project.
- **PDF → JPG:** very large PDFs may be slow or memory-heavy on low-end devices.
- **File caps:** PDFs ≤ 100 MB, images ≤ 25 MB, DOCX ≤ 50 MB.

## Public release compliance

- Public legal configuration is centralized in `lib/site.ts` and checked by
  `npm run release:check` without printing environment values.
- `/privacy`, `/cookies`, `/terms`, `/legal`, `/security` and `/open-source`
  describe the current web-only product.
- `/mac` and retired native tool routes redirect to the web product so old
  bookmarks do not show obsolete setup instructions.
- Direct dependency notices are recorded in `docs/THIRD_PARTY_NOTICES.md`.

## How to add a web tool

1. Add the tool to the explicit browser-local allowlist in `lib/tools.ts` and
   `lib/formatMatrix.ts`.
2. Add a case in `run()` in `components/ToolRunner.tsx`, with heavy work in a
   new dynamically imported `lib/` function.
3. Prove it works end-to-end in the browser. Never ship a placeholder that
   only renames extensions.
4. Add regression tests for parsing, validation or transforms.
5. Update this README and affected privacy copy.
