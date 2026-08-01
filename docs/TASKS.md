# Big OG Wayne Tasks

## Sprint 1 - Homepage V2

### ✅ Completed

- [x] Create PROJECT.md
- [x] Create CODING_STANDARDS.md
- [x] Repository review
- [x] Homepage implementation plan

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

#### SHOP-001L Product page fulfillment policy polish

Status: Completed

Description

Clarify product-page fulfillment, cancellation, and returns policy copy now that checkout and Printify fulfillment are connected.

Completed Scope

- Product pages now show made-to-order cancellation copy with a customer-facing 12-hour cancellation window.
- Product pages separate production/fulfillment timing from standard US shipping timing.
- Product pages explain that delivery timing is estimated, not guaranteed.
- Product pages note that made-to-order items cannot be returned or exchanged for wrong size, wrong color, or change of mind.
- Product pages link to Printify refund and return policy guidance for damaged items or manufacturing issues.
- Related-products grid background no longer creates a mismatched blank block when fewer related cards are shown.

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
