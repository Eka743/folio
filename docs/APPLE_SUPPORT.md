# Browser-local Apple document support

Folio’s Apple Beta actions use `@file-viewer/renderer-iwork@3.0.3`, pinned in
`package.json` and `package-lock.json`. The package is published under
Apache-2.0 from [flyfish-dev/file-viewer](https://github.com/flyfish-dev/file-viewer),
at `packages/renderers/iwork`, and includes its own `LICENSE` and
`THIRD_PARTY_NOTICES.md`.

The runtime dependencies are `@file-viewer/core@3.0.3` (Apache-2.0, with
`dompurify@3.4.15`, MPL-2.0/Apache-2.0), `@xmldom/xmldom@0.9.12` (MIT),
`jszip@3.10.2` (MIT/GPL dual license),
`keynote-archives@2.0.1` (MIT, with `@protobuf-ts/runtime` Apache-2.0/BSD-3-Clause
and `snappyjs` MIT), `pako@2.2.0` (MIT/Zlib), `styled-exceljs@0.21.6`
(Apache-2.0), and `tslib` (0BSD). These are loaded only by the Apple action
chunk; no Apple parser code is part of the initial page bundle.

The parser accepts bounded ZIP/IWA input, rejects encrypted or unsafe
containers, and has no `fetch`, XHR, WebSocket, Beacon, WebAssembly or remote
asset loading path in its published runtime. Folio uses the typed model only:
Pages and Keynote export supported text, tables, images, basic shapes and saved
chart data to PDF; Numbers exports saved tables to XLSX and PDF. Formula
recalculation, animations, transitions, video, and unsupported objects are not
silently approximated—exports fail closed when the parser reports limited or
incomplete content. An embedded QuickLook PDF is offered separately as
`Export embedded PDF preview` and is not presented as native conversion.

The parser runs in the package’s bundled module Worker, which Folio starts only
when an Apple export is chosen. If the browser cannot start a module Worker,
Folio falls back to the same parser on the main thread so the feature remains
usable in constrained WebViews; the 100 MB input and parser safety limits still
apply. The Worker is emitted as a separate lazy asset and is not part of the
initial homepage bundle.

This dependency review was performed against npm package `3.0.3`, its lockfile
transitives, the published third-party notices, and the upstream tag used by
the package. Native Apple fixture files remain evaluation inputs only and are
not shipped in Folio.
