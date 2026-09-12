# Phase 2I visual fidelity and status audit

This record covers the visual-fidelity hardening pass on `feat/v0.2-apple-update`.
It is a bounded browser-local conversion audit, not a claim of pixel-identical
Office or iWork reproduction.

## Benchmark corpus and method

The deterministic fixture lab creates 31 safe fixtures: 10 DOCX, 9 PPTX, 10
XLSX, one Markdown document and one three-page PDF. The corpus includes
headings, lists, tables, images, hyperlinks, Unicode, formulas, dates, merged
cells, multiple sheets, wide tables and long tables.

Office comparisons use independent LibreOffice PDF exports of the same safe
fixtures as a semantic and visual reference. Apple comparisons use the native
Pages, Keynote and Numbers validation record in
[`IWORK_NATIVE_OUTPUT_VALIDATION.md`](IWORK_NATIVE_OUTPUT_VALIDATION.md).
Generated source files and native validation artifacts remain temporary and
are not committed.

The repeatable comparison command is:

```bash
npm run visual:fidelity -- \
  --case docx /path/to/folio.docx.pdf /path/to/reference.docx.pdf \
  --case pptx /path/to/folio.pptx.pdf /path/to/reference.pptx.pdf \
  --case xlsx /path/to/folio.xlsx.pdf /path/to/reference.xlsx.pdf \
  --strict
```

It validates PDF signatures through the surrounding browser tests, page count,
page size within 1.5 points, raster page dimensions, and reports per-page mean
absolute pixel error and changed-pixel ratio. Text/page-count assertions remain
in `e2e/fixture-lab.spec.mjs`; this prevents a visually plausible but malformed
download from being treated as success.

## Current benchmark result

| Path | Page/slide geometry | Visual result | Main differences kept honest |
| --- | --- | --- | --- |
| DOCX → PDF | 2 pages; Folio A4, independent reference Letter | PARTIAL | Folio now preserves heading semantics, list markers, table headers/borders and a useful image size. Word-specific pagination, source page size, fonts and advanced layout still differ. |
| PPTX → PDF | 4 pages; 960 × 540 within tolerance | PARTIAL | Geometry and basic shapes/tables are strong. Standard PDF fonts replace unavailable CJK/emoji glyphs, and native theme/table styling is not identical. |
| XLSX → PDF | 2 pages; A4 portrait within tolerance | PARTIAL | Sheet title, header styling, borders, date formatting, saved values and page flow are improved. Formula recalculation, native print areas, Unicode glyph fallback and advanced Excel styling remain bounded. |
| Markdown → PDF | Generated PDF is loadable and text-bearing | PASS | The intentionally documented A4/browser layout is not a source-application fidelity comparison. |
| PDF → JPG | ZIP output contains decodable JPEG pages | PASS | Raster output is intentionally a rendering operation. |

The current generated report recorded these reference comparisons:

- DOCX: page count matched; page-size comparison was partial because Folio’s
  documented A4 layout differs from the Letter reference.
- PPTX: page count and page size matched within tolerance; page mean error was
  0.0046–0.0258 after normalization.
- XLSX: page count and page size matched within tolerance; page mean error was
  0.0024–0.0063 after normalization. The formatted date regression now renders
  `2026-09-11`, not the raw Excel serial `46276`.

## Final public status audit

| Public path | Status | Reason |
| --- | --- | --- |
| Merge PDF | Stable | Exact page-stream merge; output parsed and page count validated. |
| Split PDF | Stable | Exact page extraction; output parsed and page count validated. |
| Compress PDF | Stable | Local rewrite with honest size reporting and loadability validation. |
| Rotate PDF | Stable | Page rotation metadata is preserved without content re-rendering. |
| PDF → JPG | Stable | JPEG signatures, ZIP structure and decoded pages are validated. |
| JPG/PNG → PDF | Stable | Local image embedding with loadable PDF validation. |
| Markdown → PDF | Stable | Bounded, documented A4 Markdown renderer with loadable output. |
| PDF → Markdown | Beta | Text/structure reconstruction is not a perfect inverse; scans and complex columns need cleanup. |
| Combine documents → PDF | Beta | Mixed sources are normalized locally; DOCX/Markdown layout remains renderer-dependent. |
| DOCX → PDF | Beta | Headings, lists, tables and images work; Word pagination, fonts and advanced layout can differ. |
| PPTX → PDF | Beta | Bounded OOXML subset; animations, video, OLE, unsupported graphics and exact theme fidelity are out of scope. |
| XLSX → PDF | Beta | Saved values, formulas, dates, sheets and basic formatting work; recalculation and advanced print styling are out of scope. |
| Pages → PDF | Beta | Supported structured Pages subset only; advanced layout and unsupported objects fail closed. |
| Pages → DOCX | Beta | Real DOCX package and native reopen validation pass; Word-specific fidelity remains bounded. |
| Keynote → PDF | Beta | Supported slide subset only; animations, transitions, video and unsupported objects are not exported. |
| Keynote → PPTX | Beta | Promoted from Experimental after native Keynote 15.3.1 open/save/reopen validation; advanced Apple features remain out of scope. |
| Numbers → PDF | Beta | Saved tables/chart data are rendered locally; native print styling is not reproduced. |
| Numbers → XLSX | Beta | Saved table/value export and native reopen validation pass; formulas, charts and advanced formatting are not represented. |
| Multiple DOCX → one PDF | Beta | Sequential local conversion and ordered merge work; each DOCX retains the DOCX fidelity limitations above. |

No public route remains labelled Experimental after this audit. Dormant native
helper records and historical audit documents retain their historical context;
they do not advertise public routes.

## Security and privacy boundary

All conversions remain in-browser. The browser audit observed no document upload,
conversion API, analytics SDK, tracker, or third-party runtime request. PDF,
ZIP, JPEG and DOCX/PPTX/XLSX outputs were validated locally rather than by
assuming that a download event alone meant success. Worker buffers are copied
before transfer, workers are terminated on success/error/timeout, and temporary
preview object URLs are revoked on reset and removal.

## Known visual risks

- DOCX output is intentionally A4 and rasterized from sanitized HTML; it is not
  a Word layout engine.
- Standard PDF fonts cannot represent every CJK/emoji glyph without embedding a
  font, so unsupported glyphs are replaced safely rather than aborting a whole
  conversion.
- Office and iWork advanced features remain bounded and fail closed where the
  source cannot be represented faithfully.
