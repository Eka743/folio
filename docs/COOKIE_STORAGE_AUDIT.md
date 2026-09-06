# Cookie / Storage Audit (Folio v0.2)

## Classification

| Mechanism | Used by Folio? | Purpose | Essential? |
|---|---|---|---|
| Cookies (first-party) | No | — | — |
| `localStorage` | No | — | — |
| `sessionStorage` | Yes: `folio.helper.pairToken` | Per-tab pairing token for the localhost bridge | Strictly necessary |
| `IndexedDB` | No | — | — |
| Analytics / trackers / pixels | No | — | — |
| Third-party embeds / fonts / scripts | No (self-hosted pdf.js worker) | — | — |
| Service worker | No | — | — |

## Consent-banner decision

Folio operates with strictly-necessary storage only. Therefore **no
Accept/Reject cookie banner is shown** — a banner would imply tracking
choices that do not exist. This is documented on the `/cookies` page.

## Notes

- The hosting platform may set its own load-balancing/security cookies
  outside Folio's control; Folio itself sets none.
- The pairing token is tab-scoped (`sessionStorage`) and cleared on tab
  close; no persistent identifier is stored.
