#!/bin/bash
# Provision the per-install Folio loopback TLS certificate.
# Fixed openssl arguments only — no untrusted input. Key written 0600.
# CN/SAN scoped to 127.0.0.1 + localhost; never used for any other host.
set -euo pipefail

BRIDGE_DIR="${HOME}/.folio/bridge"
CERT="${BRIDGE_DIR}/folio-bridge-cert.pem"
KEY="${BRIDGE_DIR}/folio-bridge-key.pem"
IDENTITY="${BRIDGE_DIR}/folio-bridge-identity.p12"

mkdir -p "${BRIDGE_DIR}"
chmod 700 "${HOME}/.folio" 2>/dev/null || true
chmod 700 "${BRIDGE_DIR}"

if [[ -f "${CERT}" && -f "${KEY}" && -f "${IDENTITY}" ]]; then
  echo "Loopback certificate already exists at ${BRIDGE_DIR}"
  exit 0
fi

if [[ ! -f "${CERT}" || ! -f "${KEY}" ]]; then
  rm -f "${CERT}" "${KEY}" "${IDENTITY}"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "${KEY}" \
    -out "${CERT}" \
    -days 825 \
    -subj "/CN=127.0.0.1" \
    -addext "subjectAltName=IP:127.0.0.1,DNS:localhost"
fi

if [[ ! -f "${IDENTITY}" ]]; then
  openssl pkcs12 -export \
    -out "${IDENTITY}" \
    -inkey "${KEY}" \
    -in "${CERT}" \
    -passout pass:folio-loopback-v02
fi

chmod 600 "${KEY}"
chmod 600 "${IDENTITY}"
chmod 644 "${CERT}"
echo "Provisioned loopback certificate at ${BRIDGE_DIR}"
echo "Next: open it from Folio for Mac and trust it once in Keychain Access, then https:// Folio pages can reach https://127.0.0.1:17392."
