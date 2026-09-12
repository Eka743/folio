# Phase 2G security audit

Audited: 2026-09-11

This audit covers the browser-local conversion matrix and the Universal Drop
capability boundary. It is a release review record, not a claim that arbitrary
Office or iWork files have native-app fidelity.

| Area | Check | Result | Evidence |
| --- | --- | --- | --- |
| ZIP traversal | Absolute paths, `..`, control characters and duplicate entries | PASS | `lib/safeArchive.ts`; archive regression tests |
| ZIP resource exhaustion | Input, entry, total-output, ratio and complexity limits | PASS | `DESKTOP_ARCHIVE_LIMITS`, Office/iWork limits |
| XML entity expansion | DTD, external entities, entity declarations and unsafe controls | PASS | `lib/safeXml.ts`; XXE regression test |
| OOXML relationships | External workbook/media/package targets | PASS | Bounded relationship resolver; external-link regressions |
| Macros and executable content | VBA, ActiveX, OLE, scripts, binary and unsupported embedded parts | PASS | Macro-enabled detection and fail-closed tests |
| Office media | Only bounded PNG/JPEG image entries are decoded | PASS | Image signature/dimension checks in `lib/office.ts` |
| Formula safety | External workbook/file references are rejected; formulas are not recalculated | PASS | XLSX parser guard and external-reference test |
| iWork containers | Bounded parser worker, safe archive reads, no generic partial export | PASS | `lib/iwork.ts`, renderer limits, limited-preview rejection |
| Output validation | PDF signature/parser/page count and OOXML package/parser/value checks | PASS | `lib/pdfOps.ts`, `lib/office.ts`, iWork export validators |
| Browser isolation | Heavy Office/iWork parsing occurs in cancellable workers when available | PASS | `lib/office.worker.ts`, renderer worker lifecycle |
| Network exfiltration | Document bytes, conversion APIs, analytics and tracking | PASS | `docs/DOCUMENT_NETWORK_AUDIT.md`; browser network matrix |

## Red-team cases exercised

- Malformed ZIPs, unsafe traversal names, oversized/ratio-heavy archives and
  duplicate entries are rejected before content parsing.
- DTD/entity payloads are rejected before XML interpretation.
- Macro-enabled DOCX/PPTX/XLSX containers are detected and expose no action.
- External XLSX workbook relationships and external DOCX non-hyperlink
  relationships are rejected without a fetch.
- Unsupported PowerPoint objects, external media, charts/media in reverse
  Apple exports, and invalid output packages fail closed with user-safe errors.
- Generated PDFs are reopened with the PDF parser; generated DOCX/PPTX/XLSX
  packages are reopened through bounded ZIP/XML or Office parsers.

## Residual risk

The Office renderers are schema-limited reconstructions, not Office engines.
The iWork library supports a bounded subset of native containers, and reverse
At the time of this Phase 2G audit, Apple outputs remained Beta or Experimental
until opened and saved by the native
applications. No cloud conversion or remote fallback is permitted.
