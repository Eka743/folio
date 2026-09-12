# Native iWork output validation

This checklist governs the reverse-format browser exports added in Phase 2G. A
structurally valid OOXML package is not evidence that Pages, Keynote or Numbers
will open it faithfully. The browser must never claim `Ready` until a human has
opened representative outputs in the relevant native application.

## Current status

| Path | Browser package validation | Native-app validation | Public status |
| --- | --- | --- | --- |
| Pages → DOCX | ZIP, content types, relationships, `word/document.xml`, expected text | Pages 15.3.1 opened, saved, closed and reopened | Beta |
| Keynote → PPTX | ZIP, presentation parts, slide count, expected text, embedded media relationships | Keynote 15.3.1 opened, saved, closed and reopened | Beta |
| Numbers → XLSX | XLSX workbook/worksheet/shared-string/value checks | Numbers 15.3.1 opened, saved, closed and reopened | Beta |

Validation record (2026-09-12, macOS local host): real native `.pages`, `.key`
and `.numbers` source fixtures were generated in the installed Apple apps,
converted through Folio in WebKit, opened in the corresponding native app,
saved as native documents, closed, and reopened. Pages preserved the source
text; Keynote preserved two slides and their text; Numbers preserved one table,
Unicode text, numeric values and the date cell. The reverse outputs remain Beta
because this is a bounded subset check, not a claim of full
native fidelity. The saved validation artifacts were temporary and are not
part of the repository. Phase 2I repeated the browser exports from fresh native
fixtures: the Pages DOCX export was opened and re-exported by Pages, the
Keynote PPTX was opened and saved as a native Keynote file, and the Numbers
XLSX was opened and saved as a native Numbers file; each saved result reopened
without a repair prompt.

No Terminal or shell-based substitute counts as native validation. The
application checks above are the evidence for this record; future changes to
the writers should repeat them before changing a public status.

## Owner validation — no Terminal required

1. Open the Folio preview in Safari or another supported browser and use the
   matching tool with a representative source file.
2. Download the output and open it by double-clicking it in Finder.
3. In Pages, Keynote, or Numbers as appropriate, confirm that the file opens
   without a repair dialog and that the document is editable.
4. Compare the source and output for text, Unicode, multiple pages/slides,
   tables, merged cells, images, basic shapes, ordering, row heights, column
   widths, and basic formatting.
5. Repeat with a document containing unsupported features (charts, video,
   animation, comments, external links, or embedded objects). Confirm that
   Folio rejects it clearly or omits only the documented non-editable feature.
6. Save the opened output from the native application, close it, and reopen the
   saved copy. Confirm that no corruption or repair prompt appears.
7. Repeat on a small-screen browser and in WebKit, Chromium, and Firefox. Keep
   the browser network panel open and confirm that no document request leaves
   the browser.

Record the application version, operating system, fixture names, and any
fidelity differences in the PR before changing a status. Do not use a renamed
ZIP, a synthetic parser fixture, or a file that was never opened by the native
application as evidence of native compatibility.

## Safety boundary

Folio writes only local OOXML packages and does not execute macros, external
relationships, embedded executables, or scripts. Macro-enabled Office sources,
external workbook references, unsafe archives, unsupported media, and content
outside the bounded parser subset fail closed. External hyperlinks may remain
as inert document links, but Folio never fetches them.
