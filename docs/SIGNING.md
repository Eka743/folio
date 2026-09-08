# Signing & Notarization (Folio for Mac)

## Status

**Signing/notarization requires Apple Developer credentials.** Nothing is
hardcoded here; unsigned development builds are for non-TCC build checks only.
The Automation flow must use one consistently signed hardened-runtime app.

## What's ready

- `scripts/package-mac.sh` builds `Folio.app` with a proper `Info.plist`
  (bundle id `tools.folio.mac`, version 0.2.0, `LSUIElement`, and
  `NSAppleEventsUsageDescription` explaining Automation use).
- Set `DEVELOPER_ID_APP` to the stable signing identity for the installation.
  The script signs the outer app and embedded helper with
  `--options runtime --timestamp` and
  `com.apple.security.automation.apple-events`.
- When the checkout is in iCloud Drive, the script writes the verified bundle
  to `/private/tmp/FolioPackage` so FileProvider metadata cannot invalidate
  the signature. Set `FOLIO_OUTPUT_DIR` to choose another local volume.
- DMG creation via `hdiutil` on macOS (`Folio-for-Mac.dmg`).
- Signing is release infrastructure only; it does not make the deferred
  Keynote routes validated.

## Still needed (with credentials)

1. `codesign` with a Developer ID Application certificate (hardened runtime).
2. `notarytool submit` + `staple` for the DMG.
3. `SPCTL` / Gatekeeper verification on a clean Mac.

## Entitlements

Folio requests Keynote access from the foreground user-facing app, and the
helper drives desktop apps via AppleScript. Both signed executables carry
`com.apple.security.automation.apple-events`; macOS still requires the user
to approve each target app through TCC. Sandbox restrictions are intentionally
avoided: sandboxing would break AppleScript export to Pages/Keynote/Numbers.
The checked-in `scripts/folio-automation.entitlements` file is the single
source for this entitlement.
