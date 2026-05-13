# Architecture

Status: Phase-0 architecture note

## Scope

This document records the architecture position for Phase 0 only. Phase 1 must decide the target architecture for shared data flow, route boundaries, persistence and caching.

Phase 0 does not change app implementation logic.

## Current Architecture Shape

The repository is a Next.js App Router application with:

- React UI routes for portfolio-oriented views,
- API route handlers for auth and Parqet data access,
- local library code for Parqet data handling,
- documentation describing dashboard, activities, assets, reconciliation warnings and overrides.

Existing documentation indicates this intended data direction:

```text
Parqet API
-> authorized portfolios and activities
-> normalized security activities
-> overrides
-> reconciliation warnings
-> asset/dashboard/activity projections
```

DP-02 provider source selection is documented in `docs/PROVIDER_DATA_SOURCE_STRATEGY.md`. Future route/read-model migration must use the narrowest safe source for each product question: current holdings/current-state for current positions and allocation, activity history for timelines and event-derived inputs, snapshots/read models for repeated local reads, local metadata for display identity only and provider-reference values for Parqet-computed financial/performance output.

## Phase-0 Guardrail

Do not create a second activity or asset pipeline before Phase 1 decides otherwise.

Any task touching auth, API contracts, tokens, activity data, asset projections, persistence, caching or the shared pipeline requires the appropriate Codex mode and explicit review. Risky first tasks in these areas require `Voll`.

## Phase-1 Architecture Decisions Needed

- Canonical shared activity context boundary.
- Route handler responsibilities versus shared library responsibilities.
- API response compatibility expectations.
- Product read-model contract that carries source, freshness, confidence, warnings and blocked metrics.
- Override persistence strategy.
- Cache ownership and invalidation model.
- Test strategy for pipeline, metadata and reconciliation logic.
- ADRs needed for pipeline, persistence and caching decisions.

## Documentation Relationship

- `docs/PROJECT_PRODUCT_BRIEF.md` describes the product idea and open Phase-1 product questions.
- `docs/PROJECT_STATUS.md` tracks current status, risks and next steps.
- `docs/PIPELINE_INVENTORY.md` inventories current provider/data boundaries and replacement-gate evidence.
- `docs/PROVIDER_DATA_SOURCE_STRATEGY.md` records the DP-02 provider data-source strategy for #248/#251.
- `docs/adr/0001-collaboration-operating-system.md` records the collaboration operating system decision.

Older implementation-focused docs may exist and should be reconciled in later architecture work. Phase 0 does not delete product architecture history except obsolete duplicated governance prompt files.
