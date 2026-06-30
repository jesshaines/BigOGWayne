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