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
