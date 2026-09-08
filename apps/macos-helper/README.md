# Folio for Mac helper (`apps/macos-helper`)

Lightweight native companion that gives Folio Web high-fidelity,
privacy-first conversion for Apple iWork and Microsoft Office formats.
No Electron, no second Chromium, no cloud.

```
Folio Web (browser)
  → http://127.0.0.1:17391 (localhost only)
    → Folio Helper (this Swift package)
      → Pages / Keynote / Numbers / Word / PowerPoint / Excel (local apps)
      → LibreOffice headless fallback (Office formats only, clearly labeled)
    → result bytes returned to the browser
```

## What is genuinely implemented (v0.2)

- Localhost-only HTTP service: `GET /v1/status`, `GET /v1/pair`,
  `GET /v1/capabilities`, `POST /v1/convert` (+ `OPTIONS` preflight).
- Explicit conversion allowlist (12 pairs): `pages>pdf`, `pages>docx`,
  `key>pdf`, `key>pptx`, `numbers>pdf`, `numbers>xlsx`, `doc>pdf`,
  `docx>pdf`, `ppt>pdf`, `pptx>pdf`, `xls>pdf`, `xlsx>pdf`.
- Capability detection for Pages / Keynote / Numbers / Word / PowerPoint /
  Excel / LibreOffice (bundle-existence checks; injectable `AppProber`).
- Engine selection: native app preferred; LibreOffice fallback for Office
  formats only (never for iWork); the winning engine is returned so the web
  UI can label it honestly.
- AppleScript export builders for Pages / Keynote / Numbers / Office
  (`NSAppleScript`, no GUI clicking, no keystrokes, paths POSIX-quoted).
- Hardened file handling: random 0700 temp dir per conversion, sanitized
  filenames, traversal confinement, 100 MB cap, cleanup on success + failure.
- Origin allowlist (`https://folio.tools`, `http://localhost:3000`,
  `http://127.0.0.1:3000`) + short-lived pairing token (`X-Folio-Token`).

## What is scaffolded / needs a real Mac

CI builds and unit-tests the helper on Linux/macOS runners, but **no CI
runner has Pages/Keynote/Numbers/Word/PowerPoint installed**, so actual
export fidelity is NOT validated in CI. On a Mac with the apps installed:

1. `swift run FolioHelper` (or the built binary).
2. Open Folio Web → any `…-to-pdf` tool → “Folio for Mac connected”.
3. Convert a real `.pages` / `.key` / `.numbers` / `.doc(x)` / `.ppt(x)` /
   `.xls(x)` file and verify output + engine label.

Mark these runs “Requires manual validation on a Mac with \<app\>
installed” — never fake them.

## Build / test

```bash
cd apps/macos-helper
swift build
swift test
```

No third-party dependencies; `Foundation` only (`NSAppleScript` path is
`#if os(macOS)`-gated so Linux CI builds).

## Security model

Threats considered: malicious websites calling localhost, CSRF, path
traversal, arbitrary command execution, malicious filenames, malformed
documents, oversized payloads, temp-file leakage, port scanning, replay,
AppleScript injection, shell injection, DoS.

Mitigations:

| Threat | Mitigation |
| --- | --- |
| Arbitrary sites invoking the helper | Binds `127.0.0.1` only; `Origin` must be allowlisted on `/v1/pair` and `/v1/convert`; pairing token required for conversion |
| CSRF / replay | Per-launch random token (`X-Folio-Token`), constant-time compare; token only issued to allowlisted origins |
| Arbitrary commands / paths | No command API; fixed allowlist of `from>to` pairs; filenames sanitized + confined to the per-conversion temp dir |
| AppleScript / shell injection | No shell; `Process` argument arrays only; AppleScript embeds only POSIX-quoted paths + fixed format enums |
| Malformed / oversized docs | Extension-vs-`from` check, base64 + decoded size caps (100 MB), empty-doc rejection |
| Temp leakage | Random 0700 dir per conversion, `defer` cleanup on every path |
| Port scanning / info leak | `/v1/capabilities` exposes booleans only (no paths, versions, hostnames) |
| Permission abuse | Automation permission failures map to actionable copy (“System Settings → Privacy & Security → Automation”); no prompt spam (single attempt per conversion) |

## Permissions

First conversion (or the Folio for Mac “Request Keynote Access…” action)
triggers macOS Automation consent (“Folio would like to control Pages…”). If denied, the helper returns
`permission_denied` and the web UI explains how to re-allow it. The helper
never re-prompts in a loop.

## Distribution (future)

Structure supports Developer ID signing + hardened runtime + notarization
without code changes:

```bash
codesign --sign "Developer ID Application: <Team>" --options runtime .build/release/FolioHelper
xcrun notarytool submit FolioHelper.zip --keychain-profile "folio-notary" --wait
xcrun stapler staple FolioHelper
```

No certificates are hardcoded. Auto-update is out of scope for v0.2.
