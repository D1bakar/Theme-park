# ADR 0001: Request `<all_urls>` host permission at install

Date: 2026-11-12 · Status: Accepted · Decides: issue #9

## Context

ThemePark's core promise is styling every site the user visits. Two ways to
get there:

1. **`<all_urls>` host permission up front** — one install prompt, content
   scripts run everywhere, styling "just works".
2. **`activeTab` / per-site grants** — user grants access per site. Minimal
   prompt, but styling must be armed by a click on every site, every
   session; per-site profiles can't auto-apply; the product's main use case
   (persistent, site-wide customization) collapses.

## Decision

Request `host_permissions: ["<all_urls>"]` at install, alongside `storage`.

## Justification and containment

- The permission is used **only** for content-script style injection on the
  tabs the user has open.
- The extension performs **zero** network requests of any kind (no fetch,
  no XHR, no webRequest listeners). Page data is read only to the extent
  CSS injection requires — which is, in practice, not at all: injection is
  declarative.
- No analytics, no external storage, no messaging off-device.
- Chrome Web Store "Limited Use" requirements: data (never collected) is
  used solely for the disclosed purpose of applying user-chosen styles.

## Consequences

- Install prompt shows "Read and change all your data on all websites".
  This is honest — styling *is* that powerful — and the privacy page
  explains what it means for this product.
- Reversing this later (moving to activeTab) would be a product-level
  redesign, which is why the decision is recorded now.
