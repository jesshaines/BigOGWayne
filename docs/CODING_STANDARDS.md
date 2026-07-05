# Big OG Wayne Coding Standards

These standards apply to every future change made to this project.

---

# Philosophy

This is a living project.

Favor small, safe improvements over massive rewrites.

Protect existing functionality.

Build for long-term maintainability.

---

# General Rules

Do not change behavior unless requested.

Preserve existing functionality.

Make the smallest reasonable change.

Avoid unnecessary complexity.

Avoid introducing dependencies without approval.

Never remove features without approval.

---

# HTML Standards

Use semantic HTML.

Keep sections clearly commented.

Use descriptive IDs.

Avoid duplicate IDs.

Avoid inline styles whenever practical.

Group related markup together.

---

# CSS Standards

Reuse existing variables.

Avoid duplicated rules.

Keep responsive rules together.

Remove unused CSS when features are removed.

Prefer reusable utility classes.

Avoid !important unless absolutely necessary.

---

# JavaScript Standards

Avoid global variables where practical.

Prefer configuration objects.

Avoid duplicated business logic.

Keep functions focused.

Document complex logic.

Favor reusable helper functions.

User-facing content (headlines, stories, badges, featured releases, social links, and collection metadata) should live in configuration objects whenever practical instead of being hardcoded into templates.

---

# Components

Whenever possible:

One responsibility per component.

Examples:

Header

Hero

Featured Release

Collections

About

Follow the Movement

Footer

Loot Bag

---

# Accessibility

Every image should have alt text.

Buttons should have accessible labels.

Maintain keyboard accessibility.

Maintain focus states.

Preserve screen reader compatibility.

---

# Performance

Lazy-load non-critical images.

Optimize large assets.

Avoid unnecessary JavaScript.

Reuse existing code before creating new code.

---

# Git Workflow

One feature per branch.

One logical feature per commit.

Write descriptive commit messages.

Never commit broken code.

---

# Commit Message Examples

feat(homepage): add Featured This Month section

fix(cart): preserve quantity when refreshing

refactor(css): remove unused shop styles

docs(project): update roadmap

---

# Pull Requests

Every PR should explain:

What changed

Why it changed

Testing performed

Known risks

---

# AI Instructions

Before modifying code:

Understand the existing implementation.

Preserve working functionality.

Prefer refactoring over rewriting.

Do not remove functionality without explicit approval.

Follow PROJECT.md.

Ask for clarification if requirements conflict.

Never make assumptions about business rules.

---

# Definition of Done

The feature is complete when:

It works.

It is responsive.

It preserves existing functionality.

There are no console errors.

There are no accessibility regressions.

The code is cleaner than before.

The project remains easy to maintain.