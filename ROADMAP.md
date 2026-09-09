# Folio contributor roadmap

Folio is a local-first, AGPL-3.0-or-later document toolkit. This roadmap is a
set of contributor directions, not a promise that every item will ship on a
particular date.

## Beta foundation

- Keep browser PDF/image tools deterministic, accessible, and fully local.
- Improve synthetic fixtures and browser regression coverage.
- Publish repeatable Mac packaging, signing, notarization, and clean-machine
  installation guidance.
- Keep legal, privacy, security, open-source, and support copy synchronized
  with the actual architecture.

## Native formats

- Continue Pages → PDF and Pages → DOCX validation across supported macOS and
  Pages versions.
- Continue Numbers → PDF and Numbers → XLSX validation, including formulas,
  tables, charts, and pagination.
- Improve Office/LibreOffice fallback diagnostics and fidelity reporting.
- Add manual compatibility reports using only synthetic documents.

## Deferred and exploratory

- Keynote → PDF and Keynote → PPTX remain Beta/deferred/unvalidated while the
  macOS Automation/TCC issue is unresolved. Do not treat them as release
  gates or spend incidental work on TCC in unrelated changes.
- Explore additional browser-local PDF operations only when they can be
  implemented without uploads or third-party runtime processing.

## Quality and community

- Improve keyboard and screen-reader behavior, reduced-motion support, and
  localization readiness.
- Add performance checks for large PDFs and helper payloads.
- Make the helper bridge easier to audit and the release process reproducible.
- Welcome focused documentation, tests, accessibility fixes, and synthetic
  conversion fixtures through `CONTRIBUTING.md`.
