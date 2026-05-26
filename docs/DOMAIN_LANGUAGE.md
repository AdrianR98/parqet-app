# Domain Language

This file defines the shared vocabulary for Parqet App planning and implementation prompts.

## Canonical Domain Terms

### Asset

The long-term app/domain term for a concrete tradable identity in the product model.

### GlobalAsset

One concrete `Asset` identity across portfolios, equivalent to an ISIN-like canonical identity used for cross-portfolio joins and aggregation.

### Instrument (phase-out)

`Instrument` is a legacy app/domain term and must be phased out from domain language in favor of `Asset` and `GlobalAsset`.

### AssetSummary (deprecated)

`AssetSummary` is deprecated immediately and targeted for complete removal. Do not introduce new `AssetSummary` usage in docs, prompts, or code.

### SecurityLineage

`SecurityLineage` is the final code term for lineage work that traces identity and relationship transitions over time.

### AssetEvent

Umbrella event term for asset/market/reference events tied to an `Asset` or `GlobalAsset` timeline.

### DividendEvent

A dividend-specific `AssetEvent` subtype that remains separate from other event types.

### CorporateActionEvent

A corporate-action-specific `AssetEvent` subtype that remains separate from dividend events.

### TransferMatch

Transfer reconciliation term that remains separate from `AssetEvent` matching.

### ActivityCategory

Preferred categorization term for normalized activity records.

Allowed categories:

- `trade`
- `dividend`
- `transfer`
- `cash`
- `fee_tax`
- `corporate_action`
- `unknown`

## Target Model Names

Metric models:

- `GlobalAssetMetrics`
- `SecurityLineageMetrics`

View models:

- `GlobalAssetViewModel`
- `SecurityLineageViewModel`

## Boundary Rules

1. UI components must consume ViewModels and must not own metric calculation logic.
2. Raw Parqet activities remain immutable.
3. Private Parqet user activity data and public/reference market data must remain separated.
4. Use these terms consistently in issues, prompts, and docs before implementation refactors begin.
