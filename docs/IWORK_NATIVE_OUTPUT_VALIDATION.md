# Native iWork output validation

This checklist governs the reverse-format browser exports added in Phase 2G. A
structurally valid OOXML package is not evidence that Pages, Keynote or Numbers
will open it faithfully. The browser must never claim `Ready` until a human has
opened representative outputs in the relevant native application.

## Current status

| Path | Browser package validation | Native-app validation | Public status |
| --- | --- | --- | --- |
| Pages → DOCX | ZIP, content types, relationships, `word/document.xml`, expected text | Not yet completed | Beta |
| Keynote → PPTX | ZIP, presentation parts, slide count, expected text, embedded media relationships | Not yet completed | Experimental |
| Numbers → XLSX | Existing structured XLSX exporter; workbook/worksheet/value checks | Not yet completed | Beta |

No Terminal or shell-based substitute counts as native validation. Until the
owner completes the steps below, reverse native outputs remain Beta or
Experimental and must not be promoted to Ready.

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
