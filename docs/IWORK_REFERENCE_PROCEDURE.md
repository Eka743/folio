# iWork reference capture procedure

This procedure creates the reference set required before any Pages, Keynote or
Numbers conversion can become public. It is deliberately separate from the
synthetic parser-contract corpus and must be run on a Mac with the relevant
Apple applications installed.

## Environment record

Record these values in a manifest before capturing files:

- macOS version and build
- Pages, Keynote and Numbers versions and application build numbers
- Folio commit under test
- display scale and export page/slide/sheet settings
- installed fonts and the exact font family used by the fixtures
- capture date/time and operator
- SHA-256 of every native source, exported PDF and captured PNG

Use a fresh local folder with no iCloud synchronization, cloud storage, or
customer documents. Do not open or save the references in a third-party web
service.

## Fixture content

Create one native source per format with stable, searchable markers:

- Pages: two pages, headings, Unicode text, a table with five rows, a shape,
  an image and a chart.
- Keynote: two slides, headings, Unicode text, speaker notes, a table, a
  shape, an image and a chart.
- Numbers: two sheets, a table with headers and saved values, a formula with a
  visible cached result, a chart and a second table.

Use unique markers such as `FOLIO-PAGES-REFERENCE-001` and
`FOLIO-NUMBERS-CACHED-0042`; do not use real names, addresses, or customer
content. Keep a companion manifest containing the expected page/slide/sheet
counts, text markers, table dimensions, chart/shape/image counts and formula
results.

## Capture steps

1. Open the native source in its matching Apple application and verify every
   marker visually.
2. Export through the application’s `File > Export To > PDF` flow. Record all
   export settings and do not use a screenshot as the PDF reference.
3. Re-open the exported PDF in Preview and record its page count and `%PDF-`
   signature. Store the original native source beside it and hash both.
4. Capture a lossless screenshot of each native page/slide/sheet and the PDF
   rendering at a fixed viewport and scale. Store the browser-engine name and
   font list used for every candidate capture.
5. Run the candidate in Chromium, Firefox and WebKit with network logging
   enabled. Save the candidate model summary, rendered PNGs, console output,
   request log and timing data beside the fixture. Any external request is a
   failure.
6. Compare semantic markers and dimensions first, then compare pixels with a
   fixed, reviewed tolerance. Do not choose a tolerance after seeing a
   favorable result. A missing marker, wrong count, substituted font or
   materially different geometry fails the fixture even if the screenshot
   looks plausible.

## Manifest and retention

The manifest must name each source/PDF/PNG, application version, settings,
expected semantics, SHA-256 and pass/fail result. Keep the native source and
exported PDF immutable after hashing. A changed app version, font, export
setting or fixture content requires a new reference revision and a fresh
review. Do not publish these files or add them to the Folio bundle unless
their licensing and privacy status is explicitly documented.

No renderer may be promoted from “experimental” on synthetic fixtures or
upstream samples alone. Promotion requires this reference set, representative
large/complex files, cancellation and memory soak results, dependency/license
sign-off, and a clean three-engine privacy/network audit.
