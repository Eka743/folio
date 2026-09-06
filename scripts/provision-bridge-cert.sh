#!/bin/bash
# Provision the per-install Folio loopback TLS certificate.
# Fixed openssl arguments only — no untrusted input. Key written 0600.
# CN/SAN scoped to 127.0.0.1 + localhost; never used for any other host.
set -euo pipefail

BRIDGE_DIR="${HOME}/.folio/bridge"
CERT="${BRIDGE_DIR}/folio-bridge-cert.pem"
KEY="${BRIDGE_DIR}/folio-bridge-key.pem"

mkdir -p "${BRIDGE_DIR}"
chmod 700 "${HOME}/.folio" 2>/dev/null || true
chmod 700 "${BRIDGE_DIR}"

if [[ -f "${CERT}" && -f "${KEY}" ]]; then
  echo "Loopback certificate already exists at ${BRIDGE_DIR}"
  exit 0
fi

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "${KEY}" \
  -out "${CERT}" \
  -days 825 \
  -subj "/CN=127.0.0.1" \
  -addext "subjectAltName=IP:127.0.0.1,DNS:localhost"

chmod 600 "${KEY}"
chmod 644 "${CERT}"
echo "Provisioned loopback certificate at ${BRIDGE_DIR}"
echo "Next: trust it once via Folio for Mac (one-click trust), then https:// Folio pages can reach https://127.0.0.1:17392."
