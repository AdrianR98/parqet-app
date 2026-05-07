# Project Product Brief

Status: Phase-0 brief

## Product Idea

Parqet App helps inspect and reason about Parqet portfolio data in a local Next.js application. The product direction is to provide portfolio, asset and activity views with transparent data-quality handling, including reconciliation warnings and reviewable overrides.

The app should support careful analysis of authorized Parqet data without hiding uncertainty or silently mutating raw imported data.

## Current Product Constraints

- Parqet Connect remains the intended data source.
- Real portfolio data, private exports, screenshots and API responses must not be committed.
- The existing activity/asset pipeline direction must not be forked before Phase 1 decides otherwise.
- Phase 0 does not introduce new product behavior.

## Phase-1 Questions

- What is the precise shared activity/asset context boundary?
- Which route handlers should own projections, and which should only call shared services?
- What API contracts must be preserved while pipeline logic is consolidated?
- What persistence model is acceptable for overrides beyond the current local approach?
- Which data-quality warnings are blocking, informational or explicitly acceptable?
- What test strategy should be introduced first for pipeline and metadata logic?
- Which user-facing routes are core enough to need smoke coverage later?

## Non-Goals For Phase 0

- No dashboard redesign.
- No new Parqet API features.
- No OAuth or token storage changes.
- No new activity creation flow.
- No Vitest or Playwright setup.
- No real data fixtures.
