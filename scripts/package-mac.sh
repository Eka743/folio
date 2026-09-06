#!/bin/bash
# Build Folio.app (+ Folio-for-Mac.dmg when hdiutil is available) for testing.
# Unsigned development build: Gatekeeper will warn. Signed distribution
# requires Apple Developer credentials — see docs/SIGNING.md. Nothing here
# hardcodes certificates.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/dist"
APP="${OUT}/Folio.app"

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

# Optional signing (no-op without credentials):
if [[ -n "${DEVELOPER_ID_APP:-}" ]]; then
  echo "==> Signing with ${DEVELOPER_ID_APP}"
  codesign --force --options runtime --timestamp \
    --sign "${DEVELOPER_ID_APP}" \
    "${APP}/Contents/MacOS/FolioHelper" "${APP}/Contents/MacOS/Folio"
else
  echo "==> No DEVELOPER_ID_APP set; leaving unsigned (testing only)."
fi

if command -v hdiutil >/dev/null 2>&1; then
  echo "==> Creating DMG"
  rm -f "${OUT}/Folio-for-Mac.dmg"
  hdiutil create -volname "Folio for Mac" -srcfolder "${APP}" \
    -ov -format UDZO "${OUT}/Folio-for-Mac.dmg"
  echo "DMG: ${OUT}/Folio-for-Mac.dmg"
else
  echo "==> hdiutil unavailable (not macOS); app bundle ready at ${APP}"
fi
