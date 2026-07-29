# Big OG Wayne Website

Version: 2.0
Project Lead: Jessica Haines
Artist: Big OG Wayne

---

# Vision

The Big OG Wayne website is the official home of the artist and brand.

The goal is not simply to sell merchandise.

The goal is to turn visitors into fans by showcasing Wayne's music, personality, and story while providing an easy path to follow his work and represent the brand through merchandise.

The website should feel like the home of a recording artist—not an online merch store.

---

# Brand Direction

Big OG Wayne is evolving.

While humor is still part of the brand, the music is becoming more authentic, serious, and story-driven.

The website should reflect that growth.

The homepage should highlight the current era of the artist while continuing to celebrate previous releases.

---

# Core Principles

1. Music comes first.

2. Merchandise supports the music.

3. The website should tell a story.

4. Every page should strengthen the Big OG Wayne brand.

5. Preserve existing functionality whenever possible.

6. Favor incremental improvements over large rewrites.

---

# Current Sprint

## Sprint 1 — Homepage V2

### Goals

- Preserve the existing Hero section.
- Remove Featured Collection.
- Remove Browse the Loot.
- Add Featured This Month.
- Feature the newest release (currently Streetwise).
- Add REP BIG OG WAYNE.
- Add collection stories.
- Add Follow the Movement.
- Improve mobile spacing.
- Preserve all existing shopping functionality.

---

# Homepage Philosophy

The homepage should answer three questions within ten seconds.

1. Who is Big OG Wayne?

2. What should I listen to right now?

3. How do I become part of the movement?

The store should feel like a natural extension of the music—not the primary focus.

---

## Homepage Success Metrics

A successful homepage should encourage visitors to:

1. Watch the featured release.
2. Listen on their preferred music platform.
3. Follow Big OG Wayne on social media.
4. Explore the featured collection.
5. Purchase merchandise.
---

# Featured Release

Current Release:

Streetwise

The homepage should eventually become data-driven so future featured releases can be updated without modifying HTML.

---

# Collections

Priority Order

1. Streetwise (Featured)

2. No Bluff

3. Stinky Pinky

Each collection should have:

- Story
- Collection artwork
- Merchandise
- Music connection

---
## Development Workflow

1. Create or select a feature branch.
2. Start the local server with `npm start`.
3. Review changes on `http://localhost:3000`.
4. Commit and push the feature branch.
5. Verify changes on the Render preview environment.
6. After approval, merge into `main`.
7. Production deploys automatically via Render.
---

# Follow the Movement

Primary goals:

Increase

- Spotify listeners
- TikTok followers
- YouTube subscribers
- Instagram followers
- Merchandise sales

The website should direct visitors toward official platforms instead of attempting to replace them.

---

# Future Pages

Music

Videos

The Vault

About

Press Kit

Contact

Tour Dates (future)

---

# Long-Term Technical Goals

- Data-driven homepage
- Reusable components
- Shared header
- Shared loot bag
- Cleaner CSS
- Better performance
- Better accessibility
- Better SEO

---

# Fulfillment Configuration

Printify remains the source of truth for live products, variants, pricing, and submitted fulfillment orders.

Optional fulfillment environment variables:

- `PRINTIFY_DEFAULT_SHIPPING_METHOD`: defaults to `1` for standard shipping.
- `PRINTIFY_SEND_SHIPPING_NOTIFICATION`: defaults to `true`; set to `false` to disable Printify shipment emails.

---

# Non-Negotiables

Preserve working functionality.

Do not rewrite working code simply for style.

Every major change should improve maintainability.

Keep the existing visual identity unless intentionally redesigned.

Featured releases should eventually be editable in under five minutes.

---

# Development Workflow

Plan first.

Implement second.

Test third.

Commit fourth.

Deploy last.

Never skip testing.

## Documentation

Project documentation lives in the `/docs` folder.

PROJECT.md
Project vision and roadmap

CODING_STANDARDS.md
Development standards

TASKS.md
Current work items and backlog

DECISIONS.md
Major product and technical decisions
