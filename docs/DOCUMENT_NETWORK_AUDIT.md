# Document Network Audit (Folio v0.2)

Question: can document bytes leave the user's device unintentionally?

## Method

Searched the repository for `fetch(`, `XMLHttpRequest`, `WebSocket`,
`sendBeacon`, form uploads, `app/api` routes, conversion SDKs, analytics,
and error-reporting payloads.

## Findings

| Path | Carries document bytes? | Verdict |
|---|---|---|
| Browser PDF/DOCX tools (`lib/pdfOps.ts`, mammoth/jsPDF/pdf-lib) | No network at all | Local-only |
| `lib/helper.ts` → `POST {base}/v1/convert` | Yes — to 127.0.0.1 only | Encrypted loopback hop to the user's own Mac (TLS :17392 in production) |
| `GET {base}/v1/pair`, `/v1/status`, `/v1/capabilities` | No (token + booleans) | Loopback metadata only |
| `app/api/**` | N/A — no such routes exist | No server document pipeline |
| Analytics / pixels / external scripts / fonts | None found | No third-party exfiltration surface |
| Error handling (`helperErrorMessage`, helper `hint` strings) | No — codes + static hints only | No file-content logging |
| Service worker | None registered | Documents never cached |

## Statement

The only network path carrying document bytes is the encrypted loopback hop
from the Folio tab to Folio for Mac on the same device. No cloud conversion
service (CloudConvert, ConvertAPI, Zamzar, PDF.co, Google/Microsoft/Apple
cloud conversion, remote LibreOffice) is used, referenced, or depended upon.
