# Changelog

## Unreleased

- Checkout now creates a database-backed pending order before generating a Square payment link.
- Square checkout now supports environment-based sandbox and production API base URLs.
- Checkout now validates cart items server-side against Printify before creating Square payment links, uses Printify variant prices, and rejects stale or unavailable variants.
- Updated shop/product pages to respect Printify variant availability, block out-of-stock variants from the Loot Bag, and defer low-stock messaging.
- Cleaned up the Coming Soon page hero layout and marquee image presentation.
- Added a branded Coming Soon page and routed unfinished internal links there.
- Corrected shop browsing copy so the default filter reads `All Items`.
- Simplified shop filtering to collection-only browsing with dynamic Big OG Wayne music/drop buttons.
- Aligned shop/product header styling with the homepage header and corrected product detail badge labeling.
- Added a `/collections/` landing page with collection cards that link to pre-filtered shop results.
- Cleaned up smoke-test issues around collection links, shop grid sizing, product breadcrumbs, and product drop copy.
