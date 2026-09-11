# Document Network Audit (Folio v0.2)

Last audited: 2026-09-11

Question: can document bytes leave the user's device unintentionally?

## Method

Searched the repository for `fetch(`, `XMLHttpRequest`, `WebSocket`,
`sendBeacon`, form uploads, `app/api` routes, conversion SDKs, analytics,
and error-reporting payloads.

## Findings

| Path | Carries document bytes? | Verdict |
|---|---|---|
| Browser PDF/DOCX/Office tools (`lib/pdfOps.ts`, `lib/office.ts`, mammoth/jsPDF/pdf-lib/JSZip) | No network at all | Local-only |
| `lib/helper.ts` → `POST {base}/v1/convert` | Yes — to 127.0.0.1 only | Encrypted loopback hop to the user's own Mac (TLS :17392 in production) |
| `GET {base}/v1/pair`, `/v1/status`, `/v1/capabilities` | No (token + booleans) | Loopback metadata only |
| `app/api/**` | N/A — no such routes exist | No server document pipeline |
| Analytics / pixels / external scripts / fonts | None found | No third-party runtime exfiltration surface |
| Error handling (`helperErrorMessage`, helper `hint` strings) | No — codes + static hints only | No file-content logging |
| Service worker | None registered | Documents never cached |

## Office and Apple validation boundary

PPTX/XLSX inputs are parsed from bounded ZIP entries in memory. Pages → DOCX
and Keynote → PPTX write bounded OOXML packages in memory. The pipeline never
fetches external relationships, workbook references, images, macros, scripts,
or embedded executables. Native-app opening of reverse Apple outputs is tracked
separately in `docs/IWORK_NATIVE_OUTPUT_VALIDATION.md`; package/parser
validation is not native-app fidelity evidence.

## Statement

The only network path carrying document bytes is the encrypted loopback hop
from the Folio tab to Folio for Mac on the same device. The public website still
makes ordinary requests to its configured hosting provider to download HTML,
JavaScript, styles, and static assets; those requests may produce technical
access/security logs, but do not include document bytes. No cloud conversion
service (CloudConvert, ConvertAPI, Zamzar, PDF.co, Google/Microsoft/Apple
cloud conversion, remote LibreOffice) is used, referenced, or depended upon.
