# Changelog

## Unreleased

- Footer navigation simplified and redundant shop links removed.
- Product descriptions now preserve readable formatting.
- Product pages now show concise shipping, cancellation, and return/refund information.
- Fixed the related-products blank background mismatch on product pages with fewer related items.
- Homepage and Collections page now hide collection cards with no available merch.
- Loot Bag no longer shows internal collection slugs.
- Checkout page visual/customer experience improved.
- Checkout shipping timeline copy updated.
- Checkout now calculates standard shipping from Printify before creating Square payment links, stores the quote on the pending order, and charges the customer shipping as a Square order service charge.
- Square payment links now prefill hosted checkout with the buyer email, phone, and shipping address entered on BigOGWayne.com.
- Square payment links no longer ask Square to collect a separate shipping method, avoiding the confusing `Shipping Free` checkout display.
- Payment verification compares Square totals against pending order `total_cents`.
- BigOGWayne checkout now collects buyer shipping addresses so paid orders can submit to Printify fulfillment when address data is available.
- Added Printify order creation after first-time paid Square webhooks, with an exactly-once fulfillment claim and blocked/failed fulfillment statuses for manual recovery.
- Square webhook endpoint now verifies signatures, marks completed pending orders as paid, and ignores duplicate webhook events safely.
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
