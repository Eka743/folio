# Security Policy

## Supported Versions

Folio v0.2 (this branch) is the currently supported version.

## Architecture in brief

- Browser tools run entirely in the user's tab. There is no document upload
  endpoint, no document database, no analytics.
- Mac-native conversions travel only over loopback to Folio for Mac
  (`https://127.0.0.1:17392` in production, `http://127.0.0.1:17391` for
  localhost development) and are exported by desktop apps on the user's Mac.
- The helper binds 127.0.0.1 only and enforces: Host validation (DNS-rebinding
  defense), strict Origin allowlist, per-launch pairing tokens with
  constant-time comparison, an explicit conversion allowlist, sanitized
  filenames confined to per-conversion 0700 temp dirs (always cleaned up),
  a 100 MB size cap, AppleScript path quoting (no shell with untrusted input),
  and a rolling rate limit.

## Reporting a Vulnerability

- **Do not** open a public issue for an unpatched vulnerability.
- Contact the security address shown in the site Legal Notice. Do not use a
  public issue for an unpatched vulnerability. If the email channel is
  unavailable, use a private GitHub Security Advisory instead.
- Include: affected component (web / helper / Folio for Mac), version or
  commit, reproduction steps, and impact. **Never include real document
  contents.**
- We aim to acknowledge within 7 days and will coordinate disclosure once a
  fix is available.

## Out of scope

- Social engineering, physical access, or a compromised user Mac (the helper
  intentionally runs as the user).
- Vulnerabilities in Apple / Microsoft / LibreOffice desktop apps themselves.

The public Security page and Legal Notice are generated from the same release
configuration as the privacy contact. No document contents are needed for a
report; redact or replace them with synthetic files.
