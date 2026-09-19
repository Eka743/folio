# Contributing to Folio

Thanks for helping improve Folio, an open-source document and PDF toolkit that
keeps browser processing on the user's device. Contributions are welcome, but
each change should preserve the product's privacy boundary, honest format
support and approachable workflows.

## Ways to contribute

- Report reproducible bugs or conversion-fidelity problems.
- Improve document-format support, performance, browser compatibility or
  accessibility.
- Add documentation, translations or safer error handling.
- Review security-sensitive parsing and archive-handling changes.

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Do
not include real document contents, private data, credentials, certificates or
signing material in issues, pull requests, fixtures, logs or screenshots.
Use a small synthetic or sanitized document when a reproduction file is
necessary.

## Development setup

The web project requires Node.js 20.19 or newer and uses npm:

```bash
git clone https://github.com/Eka743/folio.git
cd folio
npm ci
npm run dev
```

Open `http://localhost:3000` for the development app. The repository's
production build is:

```bash
npm run build
npm start
```

The native packages require macOS and Swift:

```bash
cd apps/macos-helper
swift build
swift test
swift build --package-path ../folio-mac
```

Real native-app fidelity checks require the relevant applications installed;
follow [`docs/MAC_MANUAL_TEST_PLAN.md`](docs/MAC_MANUAL_TEST_PLAN.md).

## Project principles

### Privacy first

Browser tools read and process selected files locally. Contributions must not
silently introduce document uploads, conversion APIs, document-content
telemetry, filename tracking or third-party document processing. Proposals
that require server-side document processing should be discussed before
implementation.

### Security

Document files are untrusted input. Preserve validation and limits around
malformed files, archives, ZIP bombs, path traversal, XML entities and
external relationships, macros/OLE content, SVG and image handling, resource
usage, and temporary data cleanup.

### Browser compatibility

Folio supports Chromium, Firefox and WebKit/Safari. A document feature is not
complete because it works in only one browser. Check keyboard access, touch
use and the supported mobile path for user-facing changes.

### Local-first performance

Avoid unnecessary file reads, `ArrayBuffer` copies, image decodes, base64
transforms, eager heavy imports and main-thread blocking. Preserve lazy
loading for conversion engines and workers.

### Output quality

Conversion changes should use representative real-world or sanitized
documents. Do not improve a benchmark by silently reducing advertised output
quality. Document meaningful fidelity limits close to the affected workflow.

## Adding or changing a converter

Consider this checklist before submitting a converter change:

- Validate file type from content as well as extension where applicable.
- Handle malformed files, unsupported features and output validation.
- Preserve local processing, memory cleanup and worker cleanup.
- Check Chromium, Firefox, WebKit, mobile behavior and retry/reset flows.
- Provide understandable errors, loading states and success/download states.
- Preserve labels, focus, keyboard navigation and screen-reader semantics.
- Add regression coverage for parsing, routing, security and deterministic
  transforms.

For Office or iWork conversions, include the supported subset and fidelity
limitations. Update `lib/formatMatrix.ts`, affected UI copy, tests and
documentation when the advertised capability changes.

## Testing

Run the checks relevant to your change:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
npm run release:check
npm run e2e
```

The E2E suite runs the configured Chromium, Firefox and WebKit projects. All
applicable tests should pass; do not weaken behavioral assertions to make a
change green. For native changes, also run the Swift commands above. Keep
generated build output, app bundles, DMGs and signing artifacts out of source
control.

## Before submitting a pull request

- Keep the change focused and explain the user-visible behavior.
- Add or update regression tests where behavior changed.
- Confirm that no document uploads or unnecessary dependencies were added.
- Consider all supported browsers and accessible error/loading/success states.
- Update documentation when capabilities, limitations or setup changes.
- Include screenshots for meaningful UI changes and measurements for
  performance-sensitive changes.

## Pull requests, issues and feature proposals

Prefer small, focused pull requests with a short problem statement,
implementation summary, privacy/security impact and validation commands.

Useful conversion bug reports include the source format, browser, operating
system, expected behavior, actual behavior and reproduction steps. Do not
publish confidential source files; create a minimal sanitized example instead.

Feature proposals should describe the user problem, desired behavior,
affected formats and privacy/security implications. A proposal is not a
promise that the feature will be accepted.

## Dependencies and code quality

Folio aims to stay lightweight. Before adding a dependency, consider bundle
size, license, maintenance, security, browser compatibility and whether the
existing dependencies already solve the problem.

Keep deterministic business logic in `lib/`, use `lib/formatMatrix.ts` as the
public conversion-support source of truth, follow the existing two-space
TypeScript and four-space Swift formatting, and rely on the repository's
TypeScript, ESLint and test checks rather than inventing a separate style
guide.

## Security, conduct and license

Use the private reporting path described in [SECURITY.md](SECURITY.md) for
unpatched vulnerabilities. Do not publish an exploit in a normal issue when a
private report is appropriate. Please also follow
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Folio is licensed under [AGPL-3.0-or-later](LICENSE). Contributions are
submitted under the project's existing license.
