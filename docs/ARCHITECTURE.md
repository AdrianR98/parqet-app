# Architecture

Status: active architecture status

## Scope

This document records the current architecture position and links to the detailed pipeline-readiness evidence. Phase 0 established the operating baseline; current architecture work keeps existing product routes stable while the Global Asset pipeline-readiness decisions are resolved.

This document does not authorize app implementation changes, route migration, new provider calls or durable storage.

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

## Pipeline Guardrail

Do not create a second activity or asset pipeline before Phase 1 decides otherwise.

Any task touching auth, API contracts, tokens, activity data, asset projections, persistence, caching or the shared pipeline requires the appropriate Codex mode and explicit review. Risky first tasks in these areas require `Voll`.

## Pipeline-Readiness Status

Pipeline-readiness planning is coordinated in #248. The completed inventory and replacement-gate checklist from #249 is documented in `docs/PIPELINE_INVENTORY.md`.

That inventory is the current evidence baseline for:

- provider-call classification,
- snapshot/cache behavior,
- replacement status for current route/read-model paths,
- hidden provider-call and private-data risks,
- first migration candidate evidence,
- route/read-model replacement-gate checks.

No production route/read-model migration is ready by default. Follow-up decision/planning issues #251 through #260 must lock the affected data-source, identity, normalization, transfer, valuation, warning, cache, read-model and validation decisions before implementation.

## Architecture Decisions Still Needed

- Provider data-source strategy and Parqet API contract verification (#251; DP-02 strategy documented in `docs/PROVIDER_DATA_SOURCE_STRATEGY.md`).
- Asset identity and metadata boundary (#252).
- Activity normalization contract and warning codes (#253).
- Transfer pairing and ambiguity model (#254).
- Cost basis, PnL and price-source policy (#255).
- Dividend, fee, tax and currency policy (#256).
- Warning, confidence and blocked-metrics model (#257).
- Snapshot cache and API-budget route semantics (#258).
- Product read-model contract and route migration order (#259).
- Synthetic pipeline fixtures and audit validation strategy (#260).

## Documentation Relationship

- `docs/PROJECT_PRODUCT_BRIEF.md` describes the product idea and open Phase-1 product questions.
- `docs/PROJECT_STATUS.md` tracks current status, risks and next steps.
- `docs/PIPELINE_INVENTORY.md` tracks the current pipeline inventory and replacement-gate evidence from #249.
- `docs/PROVIDER_DATA_SOURCE_STRATEGY.md` records the DP-02 provider data-source strategy for #248/#251.
- `docs/adr/0001-collaboration-operating-system.md` records the collaboration operating system decision.
- `docs/adr/0002-global-asset-timeline.md` records the Global Asset Timeline architecture decision.
- `docs/adr/0005-v1-snapshot-cache.md` records the v1 snapshot cache and durable storage boundary.

Older implementation-focused docs may exist and should be reconciled through focused issues. Cleanup must preserve history and report stale closed-issue text as follow-up instead of rewriting it directly.
