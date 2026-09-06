# Signing & Notarization (Folio for Mac)

## Status

**Signing/notarization requires Apple Developer credentials.** Nothing is
hardcoded here; unsigned development builds are for testing only (Gatekeeper
will warn).

## What's ready

- `scripts/package-mac.sh` builds `Folio.app` with a proper `Info.plist`
  (bundle id `tools.folio.mac`, version 0.2.0, `LSUIElement`, and
  `NSAppleEventsUsageDescription` explaining Automation use).
- Optional signing path: set `DEVELOPER_ID_APP` ("Developer ID Application:
  …") and the script signs both binaries with `--options runtime --timestamp`.
- DMG creation via `hdiutil` on macOS (`Folio-for-Mac.dmg`).

## Still needed (with credentials)

1. `codesign` with a Developer ID Application certificate (hardened runtime).
2. `notarytool submit` + `staple` for the DMG.
3. `SPCTL` / Gatekeeper verification on a clean Mac.

## Entitlements

The helper drives desktop apps via AppleScript, which requires user-approved
Automation access at runtime (no special entitlement). Sandbox restrictions
are intentionally avoided: sandboxing would break AppleScript export to
Pages/Keynote/Numbers. This tradeoff is documented and matches the app's
local-only threat model.
