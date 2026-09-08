# macOS Bridge TLS (web ↔ Folio for Mac)

## Root cause of the Safari failure

The v0.2 prototype served **plain HTTP only** (`http://127.0.0.1:17391`)
while Folio is hosted on `https://`. Browsers classify an `https://` page
fetching `http://127.0.0.1` as **mixed content**; Safari blocks it at the
network layer — no preflight, no request, nothing in helper logs — so
"Check again" could never succeed. CORS, Origin, and CSP were secondary:
mixed content kills the request before any of them matter.

## Production architecture

- Folio for Mac serves a **TLS listener on 127.0.0.1:17392** with a
  per-install loopback certificate (CN/SAN scoped to 127.0.0.1 + localhost),
  generated automatically by the helper (or manually by
  `scripts/provision-bridge-cert.sh`) using fixed openssl arguments, with the
  key and PKCS#12 identity set to 0600 in `~/.folio/bridge/`. The identity is
  imported in memory on supported macOS releases. The user opens the
  certificate from the app and trusts it once in Keychain Access.
- Plain HTTP on **127.0.0.1:17391** is retained for `http://localhost`
  development only.
- The web client probes **HTTPS-first** (`helperBasesForPage` in
  `lib/helper.ts`): `https://` pages try the TLS bridge; only `http://`
  localhost dev pages fall back to plaintext.
- Pairing is per helper launch (`GET /v1/pair` → token kept in per-tab
  `sessionStorage` → `X-Folio-Token` on convert). Tokens are compared in
  constant time; the client re-pairs once if the helper restarted.

## Security properties (not weakened)

- Localhost-only binding (never 0.0.0.0 / LAN).
- `Host` validation rejects DNS-rebinding domains (403).
- `Access-Control-Allow-Private-Network: true` answers Chrome PNA preflights.
- Strict Origin allowlist; `*.vercel.app` preview suffix is a documented
  tradeoff (https-only, whole-host match, path/port/userinfo rejected).
- Rolling rate limit (20 requests / 60 s).
- Narrow conversion allowlist, sanitized + confined filenames, 0700 temp
  dirs with guaranteed cleanup, 100 MB cap, no shell with untrusted input.

## TLS termination note

TLS termination uses Network.framework on macOS and streams decrypted requests
to the same loopback-only HTTP router, so host/origin/pairing checks cannot
diverge between ports. Certificate path/argument logic remains unit tested on
every CI platform. The Safari end-to-end flow still requires manual validation;
see `docs/MAC_MANUAL_TEST_PLAN.md`.
