# Global Assets

This folder contains the Phase-1 boundary for the Global Asset Timeline foundation.

The model is based on:

- `docs/PARQET_API_AUDIT.md`
- `docs/adr/0002-global-asset-timeline.md`
- `docs/GLOBAL_ASSET_TYPE_MODEL.md`
- `docs/GLOBAL_ASSET_NORMALIZATION.md`
- #57 Phase-1 parent issue
- #64 type-model issue
- #66 normalization issue

## Allowed contents in P1-4

- TypeScript types.
- Small type guards / pure predicates.
- Defensive normalization helpers.
- Activity normalization from portfolio-context-enriched raw input to `NormalizedActivity`.
- Direct normalization warnings and count-only summaries.
- Comments that document invariants and boundaries.

## Non-goals in P1-4

- No Global Asset aggregation.
- No transfer pairing.
- No cost-basis calculation.
- No market-value calculation.
- No warning/confidence derivation beyond direct normalization warnings.
- No product UI.
- No product API route changes.
- No raw Parqet payload exposure.

## Key boundary

Raw Parqet activities must be enriched with portfolio context before normalization. The runtime audit did not show an obvious direct portfolio reference in activity payloads.

Normalization converts a single `ParqetActivityWithPortfolioContext` into a `NormalizedActivity` plus warnings. List normalization preserves input order, filters hard-rejected activities and returns count-only summary metadata.

The next implementation step is P1-5: Global Asset Builder / Aggregation.
