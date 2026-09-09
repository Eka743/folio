# Contributing to Folio

Thanks for helping make document conversion useful without sending documents
to a cloud service. Folio is an AGPL-3.0-or-later project with a Next.js web
app, a Swift localhost helper, and a small Folio for Mac menu-bar companion.

## Before you start

Please read [SECURITY.md](SECURITY.md). Do not include real document contents,
personal data, credentials, certificates, or private signing material in an
issue, pull request, test fixture, log, or screenshot. Use synthetic documents
for tests and redact filenames and metadata.

Folio's privacy boundary is part of the product: browser tools run in the tab;
Mac-native conversions use the user's loopback helper and installed desktop
apps. Do not add document uploads, cloud conversion, analytics, trackers, or
unnecessary third-party runtime requests.

## Local setup

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

For the native components on macOS:

```bash
cd apps/macos-helper
swift build
swift test
swift build --package-path ../folio-mac
```

The helper's real Pages, Numbers, Office, and LibreOffice behavior requires a
Mac with the corresponding app installed. Follow
[`docs/MAC_MANUAL_TEST_PLAN.md`](docs/MAC_MANUAL_TEST_PLAN.md). Keynote routes
are a deferred known limitation in v0.2 and must not be described as validated.

## Making changes

- Keep deterministic document and routing logic in `lib/` and keep
  `lib/formatMatrix.ts` as the conversion support source of truth.
- Use two-space TypeScript, four-space Swift, strict types, and existing
  formatting conventions.
- Prefer the smallest change that fixes the behavior and add a regression test
  for parsing, validation, routing, security, or deterministic transforms.
- Preserve the loopback-only, Origin/Host validation, pairing, rate-limit,
  size-limit, filename-sanitization, and temp-cleanup boundaries.
- Do not rename an extension in place of a real conversion.

When adding a conversion adapter, document its engine, Mac requirement,
fallback behavior, fidelity limits, and manual test evidence. Update the
format matrix, UI copy, README, and manual test plan together.

## Pull requests

Explain the user-visible behavior, privacy/security impact, and validation
commands in the pull request. Include screenshots for visible UI changes. For
native conversions, report the macOS version, app version, Folio commit, input
fixture description, output MIME/type, and whether the result was opened or
inspected. Never attach a confidential document.

Run the relevant web and Swift checks before requesting review. Packaging and
signing changes should include `./scripts/package-mac.sh` output and should
not include generated `dist/`, `.app`, DMG, or signing artifacts in source
control.

## Questions and security reports

Use a normal issue for reproducible non-sensitive bugs and feature ideas. Use
the private security-reporting path described in [SECURITY.md](SECURITY.md) for
vulnerabilities; do not publish an exploit before a fix is available.
