# Big OG Wayne Tasks

## Sprint 1 - Homepage V2

### ✅ Completed

- [x] Create PROJECT.md
- [x] Create CODING_STANDARDS.md
- [x] Repository review
- [x] Homepage implementation plan

#### HP-006 Homepage collection availability polish

Status: Completed

Description

Hide homepage collection cards when a collection has no currently purchasable Printify products.

Completed Scope

- Homepage collection cards now load after checking the live `/products` list.
- Homepage and Collections page share the same collection availability helper.
- Collection cards render only when at least one matching product has a purchasable variant.
- Product availability uses visible product checks plus variants where `is_enabled !== false` and `is_available !== false`.
- Homepage and Collections page now both avoid showing empty merch collections as shoppable.

---

#### HP-007 Footer simplification

Status: Completed

Description

Simplify footer navigation and remove redundant shop links.

Completed Scope

- Homepage footer Shop section removed.
- Redundant coming-soon support link list removed from the homepage footer.
- Homepage footer brand block is centered with a single-line tagline and centered social links.
- Essential footer content retained: branding, copyright, Olympic Embers Media credit, Privacy, and Terms.
- Intentional TikTok and YouTube footer social links retained.

---

### 🚧 In Progress

_None_

---

### 📋 Backlog

#### HP-001 Remove storefront homepage sections

Status: Ready

Description

Remove the Featured Collection section and Browse the Loot section from the homepage.

Do not replace them yet.

Acceptance Criteria

- Featured Collection removed.
- Browse the Loot removed.
- No JavaScript errors.
- Cart still works.
- Hero unchanged.
- Mobile navigation unchanged.
- Footer unchanged.
- Remove generic "Collection #1", "Collection #2", etc. labels.
- Replace them with dynamic collection badges.
- Initial badges:
  - Streetwise → FEATURED RELEASE
  - No Bluff → SIGNATURE SERIES
  - Stinky Pinky → FAN FAVORITE

---

#### HP-002 Build "Featured This Month"

Blocked by: HP-001

### Goal

Transition the homepage from a storefront-first experience to an artist-first experience by replacing the removed homepage sections with a dynamic Featured This Month section.

### Acceptance Criteria

- A Featured This Month section appears directly below the Hero.
- Streetwise is the current featured release.
- The featured release Supports multiple media platforms (TikTok, YouTube, Spotify) through configuration without requiring HTML changes.
- The section includes:
  - Release artwork
  - Headline
  - Story
  - Watch/Listen CTA
  - REP BIG OG WAYNE CTA
- The section is fully responsive.
- The design matches the existing visual identity.
- Existing Hero, Cart, Mobile Navigation, and Footer continue to function correctly.
- No console errors.

### Implementation Notes

- Create `homepage.config.js`.
- Store featured release data in the configuration object.
- Store collection badges in the configuration object.
- Store collection stories in the configuration object.
- Render homepage content from the configuration instead of hardcoded values whenever practical.
- Preserve existing functionality.

---

#### HP-003 REP BIG OG WAYNE

Blocked by: HP-002

Acceptance Criteria

- Streetwise featured first.
- No Bluff second.
- Stinky Pinky third.
- Each collection includes a short story.
- CTA links to the correct collection.

---

#### HP-004 Follow the Movement

Blocked by: HP-003

Acceptance Criteria

- Spotify
- TikTok
- YouTube
- Instagram
- Facebook

Grouped into:
- Listen
- Watch
- Connect

---

#### HP-005 Homepage cleanup

Acceptance Criteria

- Remove unused CSS.
- Remove homepage-only JS.
- No console errors.
- Responsive.

---

## Shop/Product Cleanup

### ✅ Completed

#### SHOP-001C Collection-only shop browsing

Status: Completed

Description

Refine the shop browsing experience with dynamic music/drop collection browsing.

Completed Scope

- Dynamic collection buttons generated from Printify product title prefixes using `[Collection Name] — [Product Type]`.
- Preferred known collection order:
  - Streetwise
  - Hoodrat Mama
  - No Bluff
  - Stinky Pinky
- Future collections appear automatically after known collections.
- Collection-only browsing keeps the shop simple for the current catalog size.
- Empty filter results show a clean message.
- Product cards remain fully clickable and preserve live Printify product links.

Future Enhancement

- Product Type, Size, and Sort filtering may be added later when the catalog is large enough to justify more granular browsing controls.

#### SHOP-001G Printify variant availability

Status: Completed

Description

Basic launch-readiness out-of-stock handling for live Printify products.

Completed Scope

- Shop and product pages now treat variants as purchasable only when `is_enabled !== false` and `is_available !== false`.
- Shop cards prefer pricing from the first purchasable variant.
- Products with no purchasable variants stay visible but show an Out of Stock state.
- Product pages disable Add to Loot Bag when no purchasable variant is available.
- Low-stock labels are deferred because Printify `quantity` is not reliable in the current `/products` payload.

#### SHOP-001H Server-side checkout validation

Status: Completed

Description

Harden checkout trust before Square payment links are created.

Completed Scope

- `/create-checkout` now validates cart shape and line-item quantities before contacting Square.
- Checkout validates product IDs and variant IDs against fresh Printify product data.
- Checkout rejects deleted, hidden, unavailable, disabled, stale, or invalid product variants.
- Square line item names and prices now come from Printify product/variant data instead of browser cart values.
- Duplicate product/variant cart lines are merged server-side and limited to a launch-safe maximum quantity of 10.
- Low-stock labels remain deferred because Printify `quantity` is not reliable in the current `/products` payload.

#### SHOP-001I Database-backed pending orders

Status: Completed

Description

Phase 1 fulfillment foundation for storing server-verified orders before Square checkout.

Completed Scope

- Checkout now requires `DATABASE_URL` before creating Square payment links.
- `/create-checkout` stores a pending order record after Printify validation and before Square payment link creation.
- Pending order line items store server-verified Printify product IDs, variant IDs, titles, quantities, unit prices, and line totals.
- Square payment links include the pending order ID as the Square order reference and metadata.
- Pending orders are updated with Square checkout URL/payment link data after link creation.
- Square webhook handling and Printify order creation remain future phases.

#### SHOP-001J Square paid webhook updates

Status: Completed

Description

Phase 2 fulfillment foundation for verifying Square webhooks and marking paid pending orders.

Completed Scope

- Added a `POST /webhooks/square` endpoint with route-specific raw body handling for Square signature verification.
- Square webhook signatures are verified with `x-square-hmacsha256-signature`, the configured notification URL, and `SQUARE_WEBHOOK_SIGNATURE_KEY`.
- `payment.updated` events are processed only when Square payment status is `COMPLETED`.
- Completed payments can mark matching pending orders as `paid` after amount and currency checks.
- Duplicate Square webhook events are tracked and ignored safely using `processed_square_events`.
- Printify order creation remains Phase 3.

#### SHOP-001K Printify order creation after paid webhook

Status: Completed

Description

Phase 3 fulfillment foundation for submitting paid pending orders to Printify exactly once.

Completed Scope

- First-time paid Square webhook transitions can submit a Printify order from `pending_orders.line_items_json`.
- Printify orders use the paid pending order ID as `external_id`.
- Fulfillment submission is atomically claimed with `paid -> fulfillment_pending` before the Printify API call.
- Duplicate Square `payment.updated` events do not create duplicate Printify orders.
- Printify order success is stored with `printify_order_id`, `printify_status`, `printify_order_json`, and `printify_submitted_at`.
- Missing shipping/customer address data blocks fulfillment with `printify_address_missing` or `fulfillment_blocked`.
- Printify API failures move orders to `fulfillment_failed` for owner/manual recovery.
- No separate Printify `send_to_production` call is made.
- BigOGWayne checkout now collects buyer shipping address before Square payment link creation.
- Square hosted checkout is prefilled with buyer email, phone, and address data collected before shipping calculation.
- Square hosted checkout no longer asks for a separate Square shipping method, preventing a confusing `Shipping Free` display.
- Checkout now calculates standard shipping from Printify before Square payment link creation.
- Square hosted checkout charges the calculated Printify shipping quote as a Square order service charge and webhook amount verification uses `total_cents`.

#### SHOP-001L Product page display polish

Status: Completed

Description

Improve product-page description readability, related-products presentation, and concise customer-facing policy copy.

Completed Scope

- Product descriptions now preserve readable paragraphs, line breaks, bullet-style lists, and safe basic formatting.
- Product descriptions sanitize Printify-provided HTML before rendering.
- Product pages now show concise shipping timing, 12-hour cancellation, and return/refund details copy.
- Customer-facing product policy copy avoids internal fulfillment settings and overly long policy language.
- Related-products grid background no longer creates a mismatched blank block when fewer related cards are shown.

#### SHOP-001M Collections availability polish

Status: Completed

Description

Hide collection cards from the Collections page when a collection has no currently purchasable Printify products.

Completed Scope

- Collections page now fetches the live `/products` list before rendering cards.
- Collection cards render only when at least one matching product has a purchasable variant.
- Product availability uses the same launch logic as shop/product pages: visible product plus a variant where `is_enabled !== false` and `is_available !== false`.
- Collection matching uses the same title-prefix slug convention as shop filters.
- Empty or failed product loading shows a friendly message instead of misleading shoppable collection cards.

#### SHOP-001N Cart and checkout customer polish

Status: Completed

Description

Clean up customer-facing Loot Bag and checkout display after the real shipping and fulfillment flow was approved.

Completed Scope

- Loot Bag no longer displays internal collection slugs while preserving collection metadata in cart storage.
- Checkout header no longer shows location-specific tagline copy.
- Checkout summary now presents `+ shipping` as a smaller helper note beside the subtotal estimate.
- Outdated `Orders ship within 4 weeks` copy was replaced with the current short shipping timeline.
- Checkout page form, item rows, summary, loading state, and helper copy were tightened for a more customer-ready experience.

#### SHOP-001O Public order numbers and confirmation redirect

Status: Completed

Description

Phase 6A foundation for customer-facing order confirmation and future order lookup.

Completed Scope

- New pending orders receive a unique customer-facing `public_order_code` in the `BOW-XXXXXX` format.
- Square payment links redirect customers back to `/order-confirmation.html?order=BOW-XXXXXX` after hosted checkout.
- Added a branded order confirmation page that shows the public order number and concise shipping timing copy.
- Internal pending order UUIDs remain used for Square reference and webhook matching, but are not shown as the customer order number.

Future Enhancement

- Phase 6B will add customer order status lookup by public order number.

#### SHOP-001P Customer order lookup

Status: Completed

Description

Phase 6B customer-facing order status lookup by public order number and email.

Completed Scope

- Added `/orders.html` for customers to look up order status.
- Added `POST /api/order-status`, requiring both `public_order_code` and matching customer/shipping email.
- Order lookup maps internal order states to friendly customer-facing status titles and messages.
- Lookup responses expose only safe fields: public order code, friendly status, dates, amounts, and item title/variant/quantity.
- Internal pending order UUIDs, Square IDs, Printify IDs, raw JSON blobs, and error details are not exposed.
- Existing Orders/Track Orders shell links now route to `/orders.html`.

#### SHOP-001Q Customer contact form

Status: Completed

Description

Add a customer-facing contact/support page using Resend email delivery.

Completed Scope

- Added `/contact.html` with a branded form for order, shipping, merch, business, and other messages.
- Added `POST /api/contact` with server-side validation, honeypot spam protection, and lightweight IP rate limiting.
- Contact emails are sent through Resend using `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and `CONTACT_FROM_EMAIL`.
- Contact form email uses the customer email as Reply-To and avoids exposing provider details to the browser.
- Order confirmation and order lookup pages link to the contact form and can prefill the order number.

### 📋 Backlog

#### SHOP-001 Shop and product stabilization

Status: Planned

#### SHOP-001F Printify product performance

Status: Planned

Scope

- Add a backend endpoint for fetching a single Printify product by id.
- Example route:
  `/products/:id`
- Update `product.html` so individual product pages can fetch one product directly instead of fetching the full product list.
- Add lightweight server-side caching for Printify product responses.
- Cache should reduce repeated Printify API calls during normal browsing.
- Cache duration should be short enough to avoid stale product/pricing data, such as 5-15 minutes.
- Preserve Printify as the source of truth for live products, pricing, variants, and availability.
- Do not break existing `/products` behavior used by the shop page.
- Do not change checkout behavior in this ticket.

Reason

Product pages currently fetch all Printify products and then search by id, which can feel slow. A single-product endpoint plus short-lived caching should make product pages feel faster and reduce unnecessary Printify API calls.
