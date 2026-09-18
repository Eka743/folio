# Phase 2N — final deep performance audit

Date: 2026-09-18  
Branch: `perf/folio-performance-hardening`  
Starting HEAD: `8edcebb4ffd07413c3d03db541b3781d41052534`  
Source feature branch: `fix/single-file-upload-ux` at `1d5ba021c067d80056109c86f987f9c5db6f5c92`  
PR: #14

## Scope and method

The audit used headed production Chromium profiles, a deterministic 1,200-paragraph DOCX stress fixture, Chrome tracing/metrics, DOM and canvas counters, and a WebKit run. The same temporary profiler and fixture were run against the source feature branch, `8edcebb`, and the final working tree. No document data was sent to a server.

The stress fixture produced 64 PDF pages. Trace instrumentation was temporary and lived under `/tmp`; it is not part of the application.

## Root cause

DOCX conversion was not limited by ZIP inspection, Mammoth parsing, or pagination. The dominant cost was the serial rasterization loop:

- One `html2canvas` call per page.
- One JPEG `canvas.toDataURL()` per page.
- Repeated cloning and DOM attachment of page trees.
- Repeated style/layout work inside each rasterization call.

In the 3-document run this became 192 canvas renders and scaled almost linearly. The first layout/pagination phase reached the first render in roughly 0.3 seconds; the remaining wall time was page rasterization, JPEG encoding, PDF image accumulation, serialization, and validation.

## Change

`docxToPdf` now rasterizes three bounded A4 pages per `html2canvas` call, then crops the batch canvas into individual page canvases before adding pages to jsPDF. The batch is removed and canvases are released immediately after each batch.

Three pages was selected over four because it retained nearly all of the throughput gain while keeping the largest observed main-thread task around 200 ms in the 3× stress run. The largest batch canvas is 1,588 × 6,738 device pixels at scale 2, below the tested WebKit limit.

No WASM, worker, or fidelity-affecting compression change was added. The bottleneck is DOM-dependent and cannot be moved wholesale to a worker under the current renderer architecture.

## Measurements

All values below are the same 64-page instrumented profile unless noted.

| Profile | Source branch | `8edcebb` | Final | Final delta vs source | Final delta vs 8edcebb |
| --- | ---: | ---: | ---: | ---: | ---: |
| One stress DOCX | 10.80 s | 9.89 s | 5.94 s | **-45.0%** | **-40.0%** |
| Three stress DOCX combine | 30.31 s | 28.98 s | 16.10 s | **-46.9%** | **-44.4%** |

The earlier Phase 2 performance harness reported 10.57 s → 10.02 s and 30.29 s → 28.77 s for its separate 65-page fixture. Those figures are retained for historical context; the table above is the apples-to-apples Phase 2N comparison.

### Final timeline estimate for one stress DOCX

| Stage | Evidence |
| --- | ---: |
| File read, ZIP safety inspection, Mammoth parse, HTML sanitization, DOM construction and pagination | ~0.30 s to the first raster progress event; 2,337 forced height reads |
| Page rasterization and crop loop | ~5.3 s including the final batch |
| JPEG encoding | ~2.1 s aggregate timer time across 64 page canvases |
| jsPDF image accumulation and serialization | included in the post-render tail; output was 39.2 MB |
| Output validation and cleanup | included in the final ~0.54 s tail after the last batch; the generated PDF was reopened and page-count validated |

The browser metrics show layout duration falling from 0.843 s to 0.373 s for one document and from 2.485 s to 1.020 s for three documents. The largest observed long task was 208 ms for one document and 201 ms for three documents in the final profile.

### Other representative conversions

Warm production Chromium route profiles:

- PDF merge: 0.10 s
- PPTX → PDF: 0.26 s
- XLSX → PDF: 0.13 s
- Markdown → PDF: 0.33 s
- Sign PDF export: 0.50 s
- Four-file mixed combine (PDF + 2 DOCX + Markdown): 1.69 s

These paths did not show a dominant bottleneck comparable to DOCX rasterization.

## Memory and lifecycle

The 10× no-reload soak passed for DOCX conversion, mixed combine, and Sign PDF export. DOM and canvas counts remained stable after reset. The first DOCX run paid cold-module cost (2.68 s); subsequent runs were approximately 0.26 s for the small fixture.

The large 3× DOCX profile peaked around 633 MB of sampled Chromium JS heap and produced an approximately 118 MB PDF. This is effectively unchanged from `8edcebb` and reflects jsPDF retaining all rasterized page images until serialization. It is a remaining architectural limitation, not a leak observed in the soak.

## Bundle and lazy loading

Final production output totals:

- `.next/static`: 16,268,334 bytes
- `.next/server`: 38,160,547 bytes

Compared with `8edcebb` built in the same environment, the change is +3,210 static bytes and +10,772 server bytes. The DOCX batching change does not eagerly load new converter modules.

## Security, privacy, and quality

- No network, upload, analytics, or conversion API behavior was added.
- Existing ZIP limits, relationship handling, XML safety, image limits, and worker cleanup remain unchanged.
- Unit tests: 150 passed.
- Production build/typecheck: passed.
- Lint: passed.
- WebKit stress profile: passed at 8.10 s.
- Full browser matrix: 132 passed; 3 failed on the existing Apple worker URL substring assertion (`workerUrls.some(/iwork/i)`) in Chromium, Firefox, and WebKit. The Apple conversions themselves passed in the same run, and the failure is unrelated to `lib/pdfOps.ts`; the production bundler emits the worker URL through a generated asset wrapper.

DOCX Beta messaging remains because the renderer is still rasterized and advanced Word pagination/features can differ. No status labels were broadened by this phase.

## Remaining issues

- P1: Very large multi-DOCX batches can still use substantial memory because jsPDF retains all page images before final serialization. A streaming PDF writer or a different renderer would be required to remove that limit.
- P2: The output remains rasterized JPEG pages; changing quality or scale would trade fidelity for speed and was intentionally not done.
- P2: The Apple worker URL assertion should be made bundler-agnostic in the test suite; it is not a functional conversion failure.
