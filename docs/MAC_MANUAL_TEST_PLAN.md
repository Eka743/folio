# Mac Manual Test Plan (Folio v0.2)

GitHub-hosted macOS runners lack Pages / Keynote / Numbers / Microsoft
Office, so native export paths are mocked in CI by design. This matrix must
be executed on a real Mac with the apps installed, in Safari, with zero
Terminal use.

## Setup

- Install Folio.app from `Folio-for-Mac.dmg` into Applications; open it.
- Complete one-time certificate trust + Automation permission (explained
  in-app). The imported certificate is named **Folio Loopback Bridge
  (folio-bridge)** in Keychain Access; set its SSL trust to **Always Trust**.
- Open the Folio PR preview in Safari.

## iWork matrix (each: simple text, images, formatting, multi-page/slides/sheets, tables, special chars, spaces + Unicode filenames, large file)

| Input | Output | Engine |
|---|---|---|
| .pages | .pdf | Pages |
| .pages | .docx | Pages |
| .key | .pdf | Keynote |
| .key | .pptx | Keynote |
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

- Helper not running → "Folio for Mac isn't running."
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
