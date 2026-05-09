# Global Assets

This folder contains the Phase-1 boundary for the Global Asset Timeline foundation.

The model is based on:

- `docs/PARQET_API_AUDIT.md`
- `docs/adr/0002-global-asset-timeline.md`
- `docs/GLOBAL_ASSET_TYPE_MODEL.md`
- `docs/GLOBAL_ASSET_NORMALIZATION.md`
- `docs/GLOBAL_ASSET_AGGREGATION.md`
- #57 Phase-1 parent issue
- #64 type-model issue
- #66 normalization issue
- #68 aggregation issue

## Allowed contents in P1-5

- TypeScript types.
- Small type guards / pure predicates.
- Defensive normalization helpers.
- Activity normalization from portfolio-context-enriched raw input to `NormalizedActivity`.
- Global Asset aggregation from `NormalizedActivity[]` to `GlobalAsset[]`.
- Timeline entry construction.
- Portfolio breakdown construction.
- Preliminary quantity and dividend/fee/tax totals.
- Direct warnings and count-only summaries.
- Comments that document invariants and boundaries.

## Non-goals in P1-5

- No product UI.
- No product API route changes.
- No existing dashboard/asset route replacement.
- No cost-basis calculation.
- No market-value calculation.
- No unrealized PnL calculation.
- No transfer pairing.
- No metadata enrichment.
- No FX conversion.
- No raw Parqet payload exposure.

## Key boundary

Raw Parqet activities must be enriched with portfolio context before normalization. The runtime audit did not show an obvious direct portfolio reference in activity payloads.

Normalization converts a single `ParqetActivityWithPortfolioContext` into a `NormalizedActivity` plus warnings. List normalization preserves input order, filters hard-rejected activities and returns count-only summary metadata.

Aggregation converts normalized activities into Global Assets grouped by `assetKey`. It remains isolated and is not wired into product UI/routes in P1-5.

The next implementation steps should focus on audit/report mode, transfer handling, warning/confidence refinement and later product integration decisions.
