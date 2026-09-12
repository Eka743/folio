# Mac Manual Test Plan (Folio v0.2)

This plan covers the dormant Folio for Mac helper routes. The public
browser-local Apple exports are validated separately in
`docs/IWORK_NATIVE_OUTPUT_VALIDATION.md`; the Keynote deferral below applies
only to native helper automation.

GitHub-hosted macOS runners lack Pages / Keynote / Numbers / Microsoft
Office, so native export paths are mocked in CI by design. This matrix must
be executed on a real Mac with the apps installed, in Safari, with zero
Terminal use.

## Setup

- Install Folio.app from `Folio-for-Mac.dmg` into Applications; open it.
- Complete the in-app one-time secure connection setup. Folio creates and
  trusts its per-install loopback certificate through macOS Security APIs;
  approve the normal macOS authentication prompt if shown. Automation consent
  is requested only when a supported native conversion needs it.
- Open the Folio PR preview in Safari.

## iWork matrix (each: simple text, images, formatting, multi-page/slides/sheets, tables, special chars, spaces + Unicode filenames, large file)

| Input | Output | Engine |
|---|---|---|
| .pages | .pdf | Pages |
| .pages | .docx | Pages |
| .key | .pdf | Keynote helper — deferred, do not count as native-helper validated |
| .key | .pptx | Keynote helper — deferred, do not count as native-helper validated |
| .numbers | .pdf | Numbers |
| .numbers | .xlsx | Numbers |

## Office (requires Microsoft Office installed; otherwise record as unvalidated)

| Input | Output | Engine |
|---|---|---|
| .doc/.docx | .pdf | Word (fallback: browser Beta) |
| .ppt/.pptx | .pdf | PowerPoint |
| .xls/.xlsx | .pdf | Excel |
| .doc/.ppt/.xls | .pdf | LibreOffice fallback (labeled) |

## Failure states

- Helper unavailable → "Folio for Mac isn't detected; open it from Applications."
- Desktop app not installed → "Pages/Keynote/Numbers isn't installed."
- Permission denied → actionable Automation-settings guidance, no prompt spam.
- Corrupted input → "This document appears to be damaged."
- Oversized file → size-limit message.
- Untrusted cert → secure-connection guidance with trust action.
- Cancelled/failed conversion → "The converted file could not be created."

## Privacy spot-checks

- Engine badge names the real engine after each conversion.
- Temporary dirs removed after success and failure.
- No document content in error messages or logs.

Keynote Automation permission is a known unresolved macOS/TCC limitation for
the dormant native helper. Do not spend this helper validation pass debugging
it, and do not include either Keynote helper route in the native-helper
acceptance result. This does not invalidate the separately tested browser-local
Keynote Beta exports.

## Latest non-Keynote validation record

Validated on 2026-09-09 on the local macOS test machine with synthetic,
disposable fixtures generated in Pages and Numbers. The web UI was exercised
through the HTTPS loopback bridge using the configured
`https://foliotools.vercel.app` Origin (and the Pages route was also completed
from the local web UI):

| Route | Engine | Output evidence |
| --- | --- | --- |
| Pages → PDF | Pages | Valid PDF, 1 page, `Creator: Pages` |
| Pages → DOCX | Pages | Valid Microsoft Word 2007+ ZIP container; document XML contained the fixture text |
| Numbers → PDF | Numbers | Valid PDF, 1 page, `Creator: Numbers` |
| Numbers → XLSX | Numbers | Valid Microsoft Excel 2007+ ZIP container; worksheet contained the fixture values |

All four requests returned HTTP 200, non-empty claimed-format output, and the
helper's returned engine matched the native app. No conversion temp directory
remained after the requests. This is machine-level compatibility evidence, not
a claim that every macOS or app version has identical fidelity; repeat it when
the native apps or packaging change.
