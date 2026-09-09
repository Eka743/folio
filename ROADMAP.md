# Folio contributor roadmap

Folio is a local-first, AGPL-3.0-or-later browser toolkit. This roadmap is a
set of contributor directions, not a promise that every item will ship on a
particular date.

## Web beta foundation

- Keep PDF, image and DOCX tools deterministic, accessible and fully local.
- Improve synthetic fixtures and browser regression coverage.
- Keep legal, privacy, security and open-source copy synchronized with the
  actual web architecture.
- Improve keyboard and screen-reader behavior, reduced-motion support and
  localization readiness.

## Browser tools

- Add PDF operations only when they can run reliably without uploads or remote
  processing.
- Improve large-file performance while preserving honest size and fidelity
  reporting.
- Expand browser DOCX coverage only when limitations can be clearly labelled.

## Dormant repository experiments

- Historical native packages remain in the repository but are out of scope for
  the public product and current release work.
- Do not spend release effort on desktop packaging, certificates, permissions
  or native conversion compatibility during the web-only beta.

## Quality and community

- Welcome focused documentation, tests, accessibility fixes and synthetic
  conversion fixtures through `CONTRIBUTING.md`.
