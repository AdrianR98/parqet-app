# Global Asset Aggregation

Status: Phase 1 aggregation guide

## Purpose

This document describes the Phase-1 Global Asset aggregation layer.

Aggregation means combining multiple `NormalizedActivity` entries into asset-level structures. In this phase, aggregation creates `GlobalAsset` objects, timelines, portfolio breakdowns, preliminary quantity totals and count-only summaries.

This layer does not replace current product routes or UI.

Related documents:

- `docs/adr/0002-global-asset-timeline.md`
- `docs/GLOBAL_ASSET_TYPE_MODEL.md`
- `docs/GLOBAL_ASSET_NORMALIZATION.md`
- `docs/GLOBAL_ASSET_AUDIT_REPORT.md`
- `src/lib/parqet/global-assets/types.ts`
- `src/lib/parqet/global-assets/aggregate.ts`
- `src/lib/parqet/global-assets/audit.ts`

## Input

The builder expects normalized activities:

```ts
buildGlobalAssets(normalizedActivities);
```

It can also consume the result of the normalization pipeline:

```ts
buildGlobalAssetsFromNormalizationResult(normalizationResult);
```

## Output

Aggregation returns:

```ts
{
  assets: [],
  unassignedActivities: [],
  warnings: [],
  summary: {
    inputActivityCount: 0,
    assetCount: 0,
    unassignedActivityCount: 0,
    warningCount: 0,
    blockerCount: 0,
    activeAssetCount: 0,
    closedAssetCount: 0,
    unknownAssetCount: 0,
    mixedCurrencyAssetCount: 0,
    negativeQuantityAssetCount: 0,
  },
}
```

The summary is count-only and must not contain private values.

Aggregation output can be inspected through the guarded local audit report documented in `docs/GLOBAL_ASSET_AUDIT_REPORT.md`.

## Grouping rule

Activities are grouped by:

```text
assetKey.type + ":" + assetKey.value
```

This keeps the model ready for later key types such as WKN, Parqet asset IDs or manual keys.

Activities without `assetKey` are not aggregated into a Global Asset in P1-5. They are returned as `unassignedActivities` and produce warnings.

## Timeline rules

Every aggregated activity becomes one `GlobalAssetTimelineEntry`.

Timeline entries:

- preserve the normalized activity,
- keep portfolio context,
- set `transferGroupId` to `null`,
- set display type from activity type,
- sort by `sortKey` ascending,
- keep stable order when sort keys are equal.

Display type mapping:

| Activity type | Display type |
| --- | --- |
| `buy` | `buy` |
| `sell` | `sell` |
| `dividend` | `dividend` |
| `fees_taxes` | `fees_taxes` |
| `deposit` | `external_inflow` |
| `withdrawal` | `external_outflow` |
| `transfer_in` | `possible_transfer` |
| `transfer_out` | `possible_transfer` |
| `unknown` | `unknown_event` |

No transfer pairing is performed in P1-5/P1-7.

## Portfolio breakdowns

Portfolio breakdowns are grouped by `portfolioId`.

Preliminary quantity effects:

| Activity type | Quantity effect |
| --- | --- |
| `buy` | add |
| `deposit` | add |
| `transfer_in` | add |
| `sell` | subtract |
| `withdrawal` | subtract |
| `transfer_out` | subtract |
| `dividend` | no effect |
| `fees_taxes` | no effect |
| `unknown` | no effect |

This quantity is preliminary. It is not cost basis, performance or final tax logic.

Portfolio breakdown status:

- `active`: tolerance-normalized quantity > 0
- `historical_only`: tolerance-normalized quantity = 0 and activities exist
- `unknown`: tolerance-normalized quantity < 0 or unclear state

## Quantity tolerance

Aggregation uses a small tolerance for status and warning decisions:

```ts
const QUANTITY_EPSILON = 0.000001;
```

Rules:

```text
Math.abs(quantity) < QUANTITY_EPSILON => 0
quantity < -QUANTITY_EPSILON => negative
quantity > QUANTITY_EPSILON => positive
```

This is only meant to remove JavaScript floating-point artifacts such as `-8.326672684688674e-17`.

It must not remove real fractional shares. Real holdings such as `0.30547858`, `0.0397` or `0.0005` remain valid quantities.

## Totals

P1-5/P1-7 calculates these totals:

- `quantity`
- `dividendsNet`
- `fees`
- `taxes`

P1-5/P1-7 intentionally leaves these values null:

- `marketValue`
- `costBasis`
- `unrealizedPnL`

Dividend, fee and tax totals are calculated only when currencies are consistent. Mixed currencies block the affected totals and create warnings. No FX conversion is performed.

## Display metadata

P1-5/P1-7 does not perform metadata enrichment.

Temporary display values:

- `display.name`: asset key value, for example ISIN
- `display.subtitle`: asset key type, for example `ISIN`
- `symbol`: `null`
- `logoUrl`: `null`
- `metadataSource`: `null`

Later user-facing names should come from a dedicated metadata/enrichment step.

## Warning and confidence rules

Aggregation can create warnings for:

- negative position quantity,
- mixed currencies,
- unassigned activities,
- totals blocked by mixed currencies,
- missing portfolio breakdowns,
- empty asset groups.

Near-zero floating-point artifacts do not create negative quantity warnings.

Confidence is derived simply:

- `high`: no warnings
- `medium`: warnings present
- `low`: blocker warning present

If a warning has blocked metrics, confidence is at most `medium`.

This is not the final warning/confidence system.

## Synthetic example

Input conceptually:

```ts
[
  { activityType: "buy", assetIdentity: { assetKey: { type: "isin", value: "DEMO0000000" } } },
  { activityType: "dividend", assetIdentity: { assetKey: { type: "isin", value: "DEMO0000000" } } },
]
```

Output conceptually:

```ts
{
  assets: [
    {
      assetKey: { type: "isin", value: "DEMO0000000" },
      timeline: [/* one entry per activity */],
      portfolioBreakdowns: [/* grouped by portfolioId */],
      totals: {
        quantity: 10,
        marketValue: null,
        costBasis: null,
        unrealizedPnL: null,
        dividendsNet: { amount: 5, currency: "EUR" },
        fees: null,
        taxes: null,
      },
    },
  ],
  unassignedActivities: [],
  summary: {
    assetCount: 1,
  },
}
```

All examples are synthetic and must not be replaced with real Parqet data.

## Non-goals

P1-5/P1-7 do not implement:

- product UI,
- existing dashboard/asset route replacement,
- cost-basis calculation,
- market-value calculation,
- unrealized PnL calculation,
- transfer pairing,
- metadata enrichment,
- FX conversion,
- test framework setup.

## Next step

The next Phase-1 steps should use the audit/report output to inspect transfer handling, warning/confidence refinement and later product integration decisions.
