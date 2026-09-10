# iWork renderer evaluation

Folio v0.2 identifies Pages, Keynote and Numbers containers locally, but does
not expose generic Apple-document conversion. The public browser tools remain
the seven conversions in `lib/formatMatrix.ts`. This document records the
isolated evaluation only; it is not a support announcement.

## Candidate identity and isolation

The candidate reviewed on 2026-09-10 was:

- Package: `@file-viewer/renderer-iwork`
- Version: `3.0.3`
- npm license field: Apache-2.0
- Repository: [flyfish-dev/file-viewer](https://github.com/flyfish-dev/file-viewer)
- Source package: `packages/renderers/iwork`
- Release history observed: 3.0.0 on 2026-08-28, 3.0.1 on 2026-09-05,
  3.0.2 on 2026-09-07, and 3.0.3 on 2026-09-09
- Published package: 25 files, 8,579,976 unpacked bytes
- Largest published files: `dist/iwork.parser.js` 4,237,425 bytes and
  `dist/iwork.worker.js` 4,220,971 bytes

The package was installed only under `/tmp/folio-iwork-runtime.*`. It is not a
Folio dependency, is not in the Next.js client graph, and is not included in a
Folio production build.

The repeatable entry point is:

```sh
node scripts/iwork-renderer-evaluation.mjs \
  --package-dir /path/to/disposable/evaluation \
  --fixture-dir /path/to/disposable/corpus \
  --load --json
```

The companion corpus generator creates 44 deterministic parser-contract
containers and must also be run outside the application bundle:

```sh
node scripts/iwork-evaluation-corpus.mjs --output-dir /tmp/folio-iwork-corpus
```

## Package and runtime audit

Direct runtime dependencies declared by 3.0.3 are:

| Dependency | Version | Audit note |
| --- | --- | --- |
| `@file-viewer/core` | 3.0.3 | Apache-2.0; depends on DOMPurify 3.4.15 |
| `@xmldom/xmldom` | ^0.9.12 | MIT |
| `jszip` | 3.10.2 | `(MIT OR GPL-3.0-or-later)`; transitive `lie`, `pako` 1.x, `setimmediate`, and `readable-stream` |
| `keynote-archives` | 2.0.1 | MIT; generated protobuf definitions, `@protobuf-ts/runtime`, JSZip and `snappyjs` |
| `pako` | ^2.2.0 | `(MIT AND Zlib)` |
| `styled-exceljs` | 0.21.6 | Apache-2.0 |
| `tslib` | ^2.8.1 | runtime helper |

The installed package includes `LICENSE` and
`THIRD_PARTY_NOTICES.md`. The notice identifies public Apple iWork format
notes, an Apache-2.0 SheetJS Snappy implementation, MIT `keynote-archives`
generated protobuf definitions, and the Numbers saved-value path. Any future
adoption must carry the required notices and receive a legal review, with
particular attention to JSZip's dual license and generated protobuf
provenance. The npm Apache-2.0 field alone is not a complete Folio release
clearance.

The published implementation has two loading modes. The parser can be
dynamically imported on the main thread, or the renderer can create a module
worker, clone the input with `buffer.slice(0)`, transfer the clone, apply a
60-second default timeout, and terminate the worker on completion or abort.
Its default parser limits are 256 MB total uncompressed data, 200:1
compression ratio, 250,000 objects, 80 million image pixels and nesting depth
128. These are useful safeguards, but they do not prove acceptable browser
memory behavior for public conversion.

A static signal scan of the published JavaScript found no `fetch`,
`XMLHttpRequest`, `WebSocket`, `sendBeacon`, WebAssembly or `.wasm` runtime
usage. It found one worker construction and object-URL creation/revocation.
There are URL-looking strings in comments, notices and package metadata; those
are not evidence of a network request. In the browser harness below, the only
requests were local renderer files and local `blob:` object URLs. A Chromium
favicon 404 was a harness artifact.

## Fixture corpus and provenance

Two local corpora were evaluated:

1. `scripts/iwork-evaluation-corpus.mjs` generated 44 synthetic containers:
   P1–P16 Pages, K1–K17 Keynote, and N1–N11 Numbers. They cover text,
   Unicode, multiple pages/slides/sheets, tables, images, shapes, charts,
   notes, geometry markers, formulas and combined content. They are explicitly
   parser-contract fixtures, not Apple reference documents.
2. Fifteen upstream fixtures were downloaded into `/tmp`, five for each
   format: iWork '09, modern IWA, LibreOffice/libetonyek historical samples,
   and current Apple 15.3.1-generated samples. The upstream manifest pins
   hashes. The licensed historical files identify
   `LibreOffice/libetonyek` commit
   `37704aa6ac808fe7f7a14b4515503c3de3bc0dbf` and MPL-2.0; the project-generated
   current samples identify Apache-2.0 and state that they contain no customer
   or personal data.

No Apple Pages, Keynote or Numbers application was available for generating
fresh local reference exports. Apple reference outputs are therefore **not
available from this Mac**. Upstream goldens were used as supplied evidence,
not represented as locally regenerated Apple truth.

## Structural and browser results

The Node parser harness produced:

- Synthetic corpus: **44/44 parsed**, 0 failures.
- Upstream corpus: **15/15 parsed**, 0 parser failures; **13/15 core manifest
  structural assertions passed**.
- Adversarial checks: **6/6 rejected as expected** for truncated ZIP,
  random bytes, malformed IWA Snappy frame, encrypted-package marker, OOXML
  container mismatch, and uncompressed-size limit.

The upstream model results are not uniformly equivalent to a native export:

- Current Pages produced two scenes, a table, shape, chart and image, with
  text on the second scene.
- Current Keynote produced two scenes with text, notes, a table, chart, shape
  and image.
- Current Numbers produced two scenes with tables and a chart, including
  saved values in the first table. The manifest's Numbers search marker was
  not recovered in the returned text/cell model, so that structural assertion
  remains a documented failure.
- Some historical and modern fixtures produced sparse text/table output. The
  Pages 4/libetonyek fixture parsed as one scene but returned zero text blocks
  against a one-block minimum assertion.
- Modern fallback documents are marked `limitedPreview`; the renderer's own
  source describes exact geometry as experimental in that path.
- One synthetic legacy Numbers case emitted `## PB Type 6 for Field 2 at
  offset 0` while still producing a model. This is a parser diagnostic, not a
  promotion-quality signal.

The actual browser renderer was exercised against all 15 upstream files plus
one worker-mode current Pages case:

| Engine | Main-thread and worker cases | External HTTP(S) requests |
| --- | ---: | ---: |
| Chromium | 16/16 | 0 |
| Firefox | 16/16 | 0 |
| WebKit | 16/16 | 0 |

All inputs, renderer files and object URLs were local to the harness. This
supports the candidate's current offline behavior in the test setup; it does
not authorize adding the package to Folio.

The JSON harness also records scene dimensions, table row counts, object-kind
counts, notes, text markers and parser diagnostics for every successful
fixture. It intentionally reports a parse success separately from a
structural assertion success so sparse or partially recovered documents are
not mistaken for faithful conversion.

WebKit screenshots of current Pages, Keynote and Numbers were compared with
the upstream PNG goldens using a simple pixel-error diagnostic. The dimensions
were Pages 1192×1684 vs 1191×1684, Keynote 3840×2160, and Numbers 1664×1584.
Mean absolute channel errors were approximately 2.48, 5.97 and 4.98; pixels
over a channel-difference threshold of 12 were approximately 8.05%, 2.74% and
10.59%. These are evidence of plausible rendering and non-identity, not a
fidelity pass: there is no Apple-generated local reference set, fixed-font
calibration, semantic diff, or approved visual tolerance gate yet.

## QuickLook preview route

Folio's local preview path is intentionally narrower than conversion. It only
reads the exact `quicklook/preview.pdf` entry from the already inspected ZIP,
uses bounded archive limits, rejects unsafe paths/encryption/unsupported ZIP
features, and validates both `%PDF-` and a trailing `%%EOF` marker before
creating a local object URL. The browser then opens that local preview in a new
tab. It does not select the largest PDF, follow arbitrary paths, or treat the
preview as editable/conversion output. The candidate renderer itself searches
image preview paths; Folio's QuickLook path is separate and explicit.

## Fail-closed and memory review

The Folio container inspector rejects empty files, oversized archives, unsafe
paths, duplicates, Zip64/multi-disk archives, unsupported compression,
encrypted entries, excessive entry/total sizes and unsafe compression ratios.
The candidate harness rejected all six malformed/limit cases above. The
candidate worker clones transferred input and terminates its worker, while the
Folio preview and tool code revokes generated object URLs. A long-running
real-device memory soak with large customer documents and Apple application
reference exports remains outstanding; no claim of leak-free public iWork
conversion is made.

## Decision

**Do not adopt `@file-viewer/renderer-iwork` for public conversion in this
phase.** Pages and Keynote remain experimental candidates for future work;
Numbers is not ready; public iWork conversion remains disabled. The current
Folio branch contains identification and a bounded embedded QuickLook PDF
preview only. No candidate dependency, worker, network request, upload path or
public iWork action was added.

## Bundle and performance gates

The candidate was not added to Folio's dependency graph. A production build
comparison was made between `origin/main` at `e81a12a` and this branch after
the Phase 2B changes:

| Measurement | `origin/main` | This branch | Change |
| --- | ---: | ---: | ---: |
| All emitted client JavaScript | 24 files / 2,742,518 bytes | 26 files / 2,792,283 bytes | +49,765 bytes (+1.81%) |
| Homepage initial client entry | 23,131 bytes | 70,633 bytes | +47,502 bytes |
| Tool-route initial client entry | 45,028 bytes | 47,291 bytes | +2,263 bytes |
| Candidate iWork parser + worker only | — | 8,458,396 bytes | not shipped |

The homepage increase is the intentional Universal Drop surface; the tool
route remains lazy for the heavy conversion libraries. The current lazy
conversion chunks are approximately 396,701 bytes for `pdf-lib`, 330,657
bytes for PDF.js, 418,911 bytes for jsPDF, 398,556 bytes for Mammoth and
127,475 bytes for JSZip. No iWork lazy chunk exists because no iWork renderer
was adopted. The candidate package declares no optional or bundled
dependencies and publishes no source maps in its 25-file package inventory;
tree-shaking effectiveness was not assumed from that metadata and requires a
future integration build to measure.

The isolated candidate dependency audit on 2026-09-10 reported **0**
moderate-or-higher vulnerabilities across 24 production/optional resolved
packages. This is evidence for the disposable candidate install only, not a
license or adoption approval.

Universal Drop PDF detection was measured by the browser E2E budget test after
the page was loaded; it must stay at or below 250 ms in each required engine.
The candidate parser harness records parse time per fixture. On this Mac,
44 synthetic contract fixtures parsed in 0.23–6.03 ms (median 0.39 ms). A
separate padded-input stress sample parsed 512 KiB in 8.63 ms, 5 MiB in
11.65 ms and 25 MiB in 173.78 ms. Those padded files are not Apple documents
and these are not real-device or customer-document performance guarantees.
An extended large-document memory soak remains a Phase 2C gate.

## PDF output decision

The candidate returns a document model intended for its own HTML/SVG/canvas
renderer; it does not provide a Folio-compatible PDF byte output contract.
`window.print()` or browser print-to-PDF was not accepted as a conversion path:
it is browser- and printer-profile-dependent, cannot provide deterministic
download validation, and is not a safe substitute for native Apple fidelity.
Folio's existing PDF engines cannot consume the candidate model without a new
integration layer. Therefore no candidate-to-PDF route, rasterized PDF route,
or public iWork conversion action was added.

## Apple reference procedure

The Mac used for this evaluation did not have Pages, Keynote or Numbers, so
fresh Apple-generated reference outputs are unavailable. The exact capture
procedure for a future Phase 2C run is recorded in
[`docs/IWORK_REFERENCE_PROCEDURE.md`](IWORK_REFERENCE_PROCEDURE.md). Until
that procedure produces a versioned native source/PDF pair, matching upstream
PNGs is evidence only and cannot promote a renderer.

Before any future adoption, Phase 2C would still need native Apple reference
exports or an approved equivalent, semantic and fixed-font visual gates for
each declared generation, representative large/complex files, worker
cancellation and memory soak on Safari/Chromium/Firefox, bundle-budget
review, dependency/license sign-off, and a fresh privacy/network audit.
