#!/bin/bash
# Build Folio.app (+ Folio-for-Mac.dmg when hdiutil is available) for testing.
# The Automation permission flow requires a consistently signed hardened
# runtime app. Set DEVELOPER_ID_APP to the stable signing identity used for
# this installation; unsigned output is opt-in for non-TCC build checks.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -n "${FOLIO_OUTPUT_DIR:-}" ]]; then
  OUT="${FOLIO_OUTPUT_DIR}"
elif [[ "${ROOT}" == *"/Library/Mobile Documents/"* ]]; then
  # FileProvider can reattach Finder metadata to iCloud Drive bundles after
  # codesign has verified them. Keep the canonical signed artifact local.
  OUT="/private/tmp/FolioPackage"
else
  OUT="${ROOT}/dist"
fi
APP="${OUT}/Folio.app"
ENTITLEMENTS="${ROOT}/scripts/folio-automation.entitlements"

if [[ ! -f "${ENTITLEMENTS}" ]]; then
  echo "Missing entitlements file: ${ENTITLEMENTS}" >&2
  exit 2
fi

if [[ -z "${DEVELOPER_ID_APP:-}" && "${FOLIO_ALLOW_UNSIGNED:-}" != "1" ]]; then
  echo "DEVELOPER_ID_APP is required for a Folio build used with macOS Automation." >&2
  echo "Set FOLIO_ALLOW_UNSIGNED=1 only for builds that will not request TCC permissions." >&2
  exit 2
fi

echo "==> Building FolioHelper (release)"
swift build -c release --package-path "${ROOT}/apps/macos-helper"

echo "==> Building FolioMac (release)"
swift build -c release --package-path "${ROOT}/apps/folio-mac"

HELPER_BIN="$(swift build -c release --package-path "${ROOT}/apps/macos-helper" --show-bin-path)/FolioHelper"
MAC_BIN="$(swift build -c release --package-path "${ROOT}/apps/folio-mac" --show-bin-path)/FolioMac"

rm -rf "${APP}"
mkdir -p "${APP}/Contents/MacOS" "${APP}/Contents/Resources"

cp "${MAC_BIN}" "${APP}/Contents/MacOS/Folio"
cp "${HELPER_BIN}" "${APP}/Contents/MacOS/FolioHelper"

cat > "${APP}/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>tools.folio.mac</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleSignature</key><string>FOLI</string>
  <key>CFBundleName</key><string>Folio for Mac</string>
  <key>CFBundleVersion</key><string>0.2.0</string>
  <key>CFBundleShortVersionString</key><string>0.2.0</string>
  <key>CFBundleExecutable</key><string>Folio</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSAppleEventsUsageDescription</key><string>Folio for Mac controls Pages, Keynote, Numbers or Microsoft Office locally so those apps can export your documents on this Mac. Files never leave your Mac.</string>
</dict>
</plist>
PLIST

# iCloud Drive can add Finder/resource-fork metadata while copying build
# products. Those xattrs are not part of the app and prevent codesign from
# sealing the generated bundle, so remove them from this disposable artifact
# only (never from source files).
if command -v xattr >/dev/null 2>&1; then
  xattr -cr "${APP}"
fi

# Sign nested executables first, then the outer bundle. Both processes send
# Apple Events in production: Folio requests consent and FolioHelper performs
# document exports. They therefore need the same hardened-runtime entitlement.
DMG_SOURCE="${APP}"
if [[ -n "${DEVELOPER_ID_APP:-}" ]]; then
  echo "==> Signing with ${DEVELOPER_ID_APP}"
  # iCloud Drive may reattach Finder metadata to a bundle while codesign is
  # walking it. Stage the disposable artifact on a local filesystem so the
  # nested and outer signatures are deterministic, then copy the signed
  # bundle back without extended attributes/resource forks.
  SIGNING_ROOT="$(mktemp -d /private/tmp/folio-package.XXXXXX)"
  SIGNING_APP="${SIGNING_ROOT}/Folio.app"
  trap 'rm -rf "${SIGNING_ROOT}"' EXIT
  ditto --norsrc --noextattr --noqtn --noacl "${APP}" "${SIGNING_APP}"
  xattr -cr "${SIGNING_APP}" 2>/dev/null || true
  codesign --force --options runtime --timestamp \
    --entitlements "${ENTITLEMENTS}" \
    --sign "${DEVELOPER_ID_APP}" \
    "${SIGNING_APP}/Contents/MacOS/FolioHelper"
  codesign --force --options runtime --timestamp \
    --entitlements "${ENTITLEMENTS}" \
    --sign "${DEVELOPER_ID_APP}" \
    "${SIGNING_APP}/Contents/MacOS/Folio"
  # Sign the outer bundle after its nested executables so macOS/TCC sees a
  # stable bundle identity and can validate the Info.plist/resource seal.
  codesign --force --options runtime --timestamp \
    --entitlements "${ENTITLEMENTS}" \
    --sign "${DEVELOPER_ID_APP}" \
    "${SIGNING_APP}"
  # Build the DMG from the clean local staging copy. FileProvider can attach
  # FinderInfo to the iCloud copy immediately after it is written.
  DMG_SOURCE="${SIGNING_APP}"
  rm -rf "${APP}"
  ditto --norsrc --noextattr --noqtn --noacl "${SIGNING_APP}" "${APP}"
  # FileProvider can add FinderInfo during the copy-back; remove it once
  # more so the artifact handed to the user verifies immediately.
  xattr -cr "${APP}" 2>/dev/null || true
  codesign --verify --deep --strict --verbose=2 "${APP}"
else
  echo "==> No DEVELOPER_ID_APP set; leaving unsigned (testing only)."
fi

if command -v hdiutil >/dev/null 2>&1; then
  echo "==> Creating DMG"
  rm -f "${OUT}/Folio-for-Mac.dmg"
  hdiutil create -volname "Folio for Mac" -srcfolder "${DMG_SOURCE}" \
    -ov -format UDZO "${OUT}/Folio-for-Mac.dmg"
  echo "DMG: ${OUT}/Folio-for-Mac.dmg"
else
  echo "==> hdiutil unavailable (not macOS); app bundle ready at ${APP}"
fi
