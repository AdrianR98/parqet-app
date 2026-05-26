# Domain Model Boundaries

This document defines the Phase 1 domain boundaries for the refactor roadmap (Refs #384, Fixes #385). It is documentation-only and establishes naming and ownership before any `AssetSummary` removal, database refactor, or `SecurityLineage` implementation.

## Layer Model

### Provider Layer

- Source: Parqet raw data.
- Rule: treat provider payloads as source records; do not mutate historical facts.

### Activity Layer

- Core model: `NormalizedActivity`.
- Categorization: `ActivityCategory` with allowed values `trade`, `dividend`, `transfer`, `cash`, `fee_tax`, `corporate_action`, `unknown`.
- Rule: normalized records preserve immutable raw activity intent.

### Asset Layer

- Core terms: `Asset` and `GlobalAsset`.
- `Asset` is the long-term domain/app term.
- `GlobalAsset` means one concrete Asset identity across portfolios (ISIN-like canonical identity).
- `Instrument` must be phased out as an app/domain term.

### Event Layer

- Umbrella term: `AssetEvent` for asset/market/reference events.
- Required subtypes: `DividendEvent` and `CorporateActionEvent` remain separate.

### Match Layer

- Models: `DividendMatch`, `CorporateActionMatch`, `TransferMatch`.
- Rule: `TransferMatch` remains separate and is not an `AssetEvent` match.

### Metric Layer

- Target models: `GlobalAssetMetrics`, `SecurityLineageMetrics`.
- Rule: metric calculation belongs to metric/domain services, not UI components.

### ViewModel Layer

- Target models: `GlobalAssetViewModel`, `SecurityLineageViewModel`.
- Rule: UI components consume ViewModels only and must not own metric calculation logic.

## Storage Boundaries

### Browser-local user portfolio cache

- Holds private Parqet-derived user portfolio/activity cache for runtime UX.

### Server-side market-data DB

- Holds public/reference market data and derived reference entities.

### Temporary/generated local artifacts

- Local-only generated artifacts used for development/analysis workflows.
- Not a persistent source-of-truth data store.

## Data Separation Rules

1. Raw Parqet activities remain immutable.
2. Private Parqet user activity data and public/reference market data must remain separated in storage and processing boundaries.
3. `AssetSummary` is deprecated immediately and targeted for complete removal; no new dependencies should be introduced. See `docs/ASSET_SUMMARY_REMOVAL_PLAN.md` for the live removal inventory and slice plan.
4. `SecurityLineage` is the final code term for lineage work and must be used consistently in new roadmap docs.

## Non-goal Reminder

This boundary document does not perform implementation changes: no `AssetSummary` removal, no `Instrument` code rename, no `SecurityLineage` implementation, and no database structure changes.
