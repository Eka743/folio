# Folio v0.2 — release notes draft

Folio v0.2 makes everyday document work easier while keeping processing in
your browser. It also adds two real Markdown conversion workflows.

- Universal Drop identifies PDFs, images, DOCX files and Apple Pages, Keynote
  and Numbers containers locally, then shows only actions Folio can actually
  perform. It now accepts ordered multi-file batches and derives available
  actions from the public capability graph.
- Multiple DOCX files can be converted into one validated PDF in selected
  order. A new mixed Combine documents → PDF Beta normalizes PDFs, DOCX,
  Markdown and JPG/PNG locally and names the exact source when a segment
  fails.
- PDF merge, split, rotate, compression and PDF/JPG workflows have stronger
  browser compatibility, clearer progress and error recovery, and more honest
  output validation.
- JPG/PNG to PDF and DOCX to PDF Beta remain local browser workflows; review
  DOCX pagination and complex layouts before sharing.
- Markdown to PDF renders a safe, styled Markdown subset into a downloadable
  A4 PDF. Raw HTML is disabled and remote images are omitted rather than
  fetched.
- PDF to Markdown extracts readable text and conservative heading/list
  structure from text-based PDFs. It is labelled Beta because reconstruction is
  not a perfect inverse of the source layout.
- Apple documents can be recognized and may expose a validated embedded PDF
  preview when the file contains one. Generic Pages, Keynote and Numbers
  conversion is not included.
- Selected files now show local visual previews across the public tools:
  first-page PDF thumbnails, JPG/PNG thumbnails, and honest DOCX, Markdown and
  Apple format cards. Preview rendering is bounded and cancellable, and a
  preview failure falls back without blocking the conversion workflow.
- PPTX and XLSX conversion are not part of this release: no reliable
  browser-local implementation met the usefulness bar during this phase.
- Universal Drop and batch tools enforce bounded file counts, aggregate bytes,
  sequential reads and safe PDF/image workloads for graceful failure on large
  inputs.
- Files are processed locally. Folio does not upload document contents or add
  accounts, analytics or tracking.

This is an unpublished draft for review. It must be updated if the final
release scope changes.
