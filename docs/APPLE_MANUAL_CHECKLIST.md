# Apple Beta owner checklist

Run this checklist on a Mac with recent Apple Pages, Keynote and Numbers
documents before changing the public Apple Beta scope. The browser must be
offline or monitored with DevTools so that local-only behavior is visible.

## Pages

- [ ] Open a simple `.pages` document with headings, paragraphs, a table and a
      placed PNG in Apple Pages. Compare Folio’s `Convert Pages to PDF` with
      Apple’s exported PDF for page count, text and basic placement.
- [ ] Open a Pages document with an embedded QuickLook preview and verify that
      `Export embedded PDF preview` is clearly labeled as a preview.
- [ ] Try a document containing unsupported media, complex drawing or a
      password/encrypted container. Confirm Folio fails closed with a useful
      message and does not silently omit content.

## Keynote

- [ ] Open a two-slide `.key` document with titles, body text, a table, an image
      and a simple chart. Compare Folio’s `Convert Keynote to PDF` with Apple’s
      PDF for slide count and supported content.
- [ ] Try a deck with transitions, video, audio or complex builds. Confirm the
      Beta explains its limits or rejects the document rather than claiming a
      native-fidelity export.

## Numbers

- [ ] Open a `.numbers` document with multiple sheets, tables, saved values,
      formulas and a chart. Confirm `Convert Numbers to XLSX` creates a valid
      workbook that opens in Numbers or Excel and that `Convert Numbers to PDF`
      produces the expected table pages.
- [ ] Confirm formulas are exported as saved values and are not presented as
      recalculated results. Try merged cells and unsupported objects; verify
      unsupported content fails closed.

## Browser and privacy gate

- [ ] Repeat each Apple action in Chromium, Firefox and WebKit/Safari.
- [ ] Re-select the same file, use drag and drop, reorder where available,
      retry after an intentional failure, and use Start over.
- [ ] Validate downloaded signatures: `%PDF-` plus parser-loadable PDF for PDF
      actions, and a ZIP containing `[Content_Types].xml` and `xl/workbook.xml`
      for XLSX.
- [ ] Confirm the Network panel shows no document upload, conversion API,
      analytics or tracker request. Apple parsing and export must stay in the
      browser.
