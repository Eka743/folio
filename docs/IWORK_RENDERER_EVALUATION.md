# iWork renderer evaluation

Folio v0.2 identifies Pages, Keynote and Numbers containers locally, but does
not expose generic Apple-document conversion. The public browser tools remain
the seven conversions in `lib/formatMatrix.ts`.

## Candidate

The isolated candidate reviewed for evaluation is:

- Package: `@file-viewer/renderer-iwork`
- Version reviewed: `3.0.3`
- License reported by npm: Apache-2.0
- Repository: `https://github.com/flyfish-dev/file-viewer`
- Source package: `packages/renderers/iwork`
- Reported unpacked size: approximately 8.58 MB
- Reported runtime dependencies include `jszip`, `pako`, `@xmldom/xmldom`, `styled-exceljs`, `keynote-archives` and `@file-viewer/core`

This package is deliberately not a Folio dependency. Its bundle size,
transitive dependency surface, runtime behavior and document fidelity are not
yet acceptable evidence for a public conversion feature.

## Running the isolated check

Install the candidate only in a disposable evaluation directory, not in this
repository, then point the harness at that directory:

```sh
node scripts/iwork-renderer-evaluation.mjs --package-dir /path/to/evaluation --json
node scripts/iwork-renderer-evaluation.mjs --package-dir /path/to/evaluation --load
```

The harness reports package resolution and an opt-in module load. It does not
put the renderer in the Next.js client graph, send documents to a service, or
claim that a successful import proves rendering fidelity.

## Adoption gates

Before any renderer could be considered for a future release, it would need:

1. A disposable fixture corpus for representative Pages and Keynote files,
   plus a Numbers corpus; files must be used only locally.
2. Output validation, visual comparison and representative content checks.
3. A production bundle audit showing the renderer is isolated and lazy-loaded.
4. A network audit proving no document content or unexpected third-party
   request is emitted during rendering.
5. License and transitive-dependency review.
6. Repeat-use memory testing, worker cleanup and failure recovery on Safari,
   Chromium and Firefox.

Current decision: **Pages — experimental candidate; Keynote — experimental
candidate; Numbers — not ready; public conversion — disabled.** A valid
`QuickLook/Preview.pdf` entry may be opened as an embedded local preview, but
that is not generic iWork conversion.
