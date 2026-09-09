# Security Policy

## Supported versions

The current public web beta is the supported release surface.

## Architecture in brief

- Browser tools run entirely in the user's tab. There is no document upload
  endpoint, document database or analytics service.
- Files are read only after an explicit user selection and are processed in
  browser memory. Results are generated locally and downloaded by the browser.
- The public runtime has no server-side document conversion fallback, remote
  document storage or third-party runtime requests.
- Historical native packages remain in the repository but are dormant and are
  not part of the public web product.

## Reporting a vulnerability

- **Do not** open a public issue for an unpatched vulnerability.
- Contact the security address shown in the site Legal Notice. If the email
  channel is unavailable, use a private GitHub Security Advisory instead.
- Include the affected web component, version or commit, reproduction steps and
  impact. **Never include real document contents.**
- We aim to acknowledge within 7 days and will coordinate disclosure once a fix
  is available.

## Out of scope

- Social engineering, physical access or a compromised user device.
- Vulnerabilities in browser engines, operating systems or third-party
  libraries that are not caused by Folio integration.

The public Security page and Legal Notice use the same release configuration as
the privacy contact. No document contents are needed for a report; redact or
replace them with synthetic files.
