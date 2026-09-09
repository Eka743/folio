#!/bin/bash
# Provision the per-install Folio loopback TLS certificate.
# Fixed openssl arguments only — no untrusted input. Key written 0600.
# Friendly CN plus SAN scoped to 127.0.0.1 + localhost; never used for any
# other host. The Keychain label intentionally contains "folio-bridge" so it
# is searchable from the Folio setup instructions.
set -euo pipefail

BRIDGE_DIR="${HOME}/.folio/bridge"
CERT="${BRIDGE_DIR}/folio-bridge-cert.pem"
KEY="${BRIDGE_DIR}/folio-bridge-key.pem"
IDENTITY="${BRIDGE_DIR}/folio-bridge-identity.p12"
EXPECTED_SUBJECT='CN=Folio Loopback Bridge (folio-bridge)'

mkdir -p "${BRIDGE_DIR}"
chmod 700 "${HOME}/.folio" 2>/dev/null || true
chmod 700 "${BRIDGE_DIR}"

if [[ -f "${CERT}" && -f "${KEY}" && -f "${IDENTITY}" ]]; then
  if openssl x509 -in "${CERT}" -noout -subject -nameopt RFC2253 2>/dev/null \
      | grep -Fq "${EXPECTED_SUBJECT}"; then
    echo "Loopback certificate already exists at ${BRIDGE_DIR}"
    exit 0
  fi
  echo "Refreshing the legacy loopback certificate identity at ${BRIDGE_DIR}"
  rm -f "${CERT}" "${KEY}" "${IDENTITY}"
fi

if [[ ! -f "${CERT}" || ! -f "${KEY}" ]]; then
  rm -f "${CERT}" "${KEY}" "${IDENTITY}"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "${KEY}" \
    -out "${CERT}" \
    -days 825 \
    -subj "/CN=Folio Loopback Bridge (folio-bridge)" \
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
