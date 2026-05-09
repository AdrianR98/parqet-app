# Global Asset Normalization

Status: Phase 1 normalization guide

## Purpose

This document describes the Phase-1 Global Asset activity normalization layer.

Normalization means converting portfolio-context-enriched Parqet activity data into the app's internal `NormalizedActivity` shape.

This layer does not aggregate assets, calculate cost basis, match transfers or update product UI.

Related documents:

- `docs/adr/0002-global-asset-timeline.md`
- `docs/GLOBAL_ASSET_TYPE_MODEL.md`
- `docs/GLOBAL_ASSET_AGGREGATION.md`
- `src/lib/parqet/global-assets/types.ts`
- `src/lib/parqet/global-assets/normalize.ts`
- `src/lib/parqet/global-assets/aggregate.ts`

## Input

Normalization expects activities already enriched with portfolio context:

```ts
{
  portfolioId: "portfolio_demo_1",
  portfolioName: "Synthetic Portfolio",
  portfolioCurrency: "EUR",
  raw: {
    id: "activity_demo_1",
    type: "buy",
    datetime: "2026-01-01T12:00:00.000Z",
    currency: "EUR",
    shares: 10,
    price: 50,
    amount: 500,
    amountNet: 500,
    fee: 0,
    tax: 0,
    holdingId: "holding_demo_1",
    holdingAssetType: "security",
    asset: {
      assetIdentifierType: "isin",
      isin: "DEMO0000000",
    },
  },
}
```

All examples are synthetic and must not be replaced with real Parqet data.

## Output

Single activity normalization returns:

```ts
{
  activity: NormalizedActivity | null,
  warnings: ReconciliationWarning[],
}
```

List normalization returns:

```ts
{
  activities: NormalizedActivity[],
  results: ActivityNormalizationResult[],
  warnings: ReconciliationWarning[],
  summary: {
    inputCount: number,
    normalizedCount: number,
    rejectedCount: number,
    warningCount: number,
    blockerCount: number,
    duplicateInternalIdCount: number,
  },
}
```

The summary contains counts only and no private values.

The normalized activities can be passed to the aggregation layer:

```ts
buildGlobalAssets(normalizedActivities);
```

## Mapping table

| Target field | Source fields | Rule |
| --- | --- | --- |
| `ids.sourceActivityId` | `raw.id`, `raw.activityId` | String or number converted to string. |
| `ids.internalActivityId` | source id or fallback fields | Uses source id when available; otherwise deterministic fallback. |
| `activityType` | `raw.type` | Known types map directly; unknown/missing maps to `unknown`. |
| `sourceType` | `raw.type` | Preserves original source type when available. |
| `datetime` | `raw.datetime` | Preserves source string; missing becomes `null`. |
| `date` | `raw.datetime` | First 10 chars of ISO-like datetime; otherwise `null`. |
| `sortKey` | `datetime`, `internalActivityId` | `datetime|internalActivityId`, or `unknown-date|internalActivityId`. |
| `assetIdentity.isin` | `raw.asset.isin`, `raw.isin`, `raw.asset.identifier` | Trim and uppercase. |
| `assetIdentity.assetKey` | normalized ISIN | `{ type: "isin", value }` only when length is 12. |
| `assetIdentity.holdingId` | `raw.holdingId`, `raw.holding.id` | Holding context only, not a global asset key. |
| `assetIdentity.holdingAssetType` | `raw.holdingAssetType` | Preserved as source context. |
| `quantity` | `raw.shares`, `raw.quantity` | Numeric strings accepted. |
| `pricePerShare` | `raw.price`, `raw.pricePerShare` | Uses activity currency or portfolio fallback. |
| `activityCurrency` | `raw.currency`, `portfolioCurrency` | Portfolio currency fallback creates an Info warning. |
| `amounts.amount` | `raw.amount` | MoneyValue if amount and currency exist. |
| `amounts.amountNet` | `raw.amountNet` | MoneyValue if amount and currency exist. |
| `amounts.fee` | `raw.fee` | MoneyValue if amount and currency exist. |
| `amounts.tax` | `raw.tax` | MoneyValue if amount and currency exist. |
| `amounts.buyAmountNet` | `raw.buyAmountNet` | MoneyValue if amount and currency exist. |
| `parqetReference.realizedGains` | `raw.realizedGains` | Parqet reference value only. |
| `parqetReference.realizedGainsNet` | `raw.realizedGainsNet` | Parqet reference value only. |
| `parqetReference.buyAmountNet` | `raw.buyAmountNet` | Intentionally duplicated as amount and reference field. |
| `parqetReference.avgHoldingPeriodDays` | `raw.avgHoldingPeriod` | Number in days, reference field only. |

## Warning table

| Code | Severity | Meaning |
| --- | --- | --- |
| `RAW_ACTIVITY_NOT_OBJECT` | Blocker | Raw activity cannot be normalized because it is not an object. |
| `UNKNOWN_ACTIVITY_TYPE` | Warning | Source type is missing or not in the known union. |
| `MISSING_ACTIVITY_ID` | Warning | Source activity id is absent; fallback id is used. |
| `MISSING_DATETIME` | Warning | No datetime field is available. |
| `INVALID_DATETIME` | Warning | Datetime is present but not ISO-like. |
| `MISSING_ISIN` | Warning | No ISIN candidate was found. |
| `INVALID_ISIN` | Warning | ISIN failed the Phase-1 length check. |
| `MISSING_ASSET_KEY` | Warning | No GlobalAssetKey could be derived. |
| `MISSING_CURRENCY` | Warning | No activity or portfolio currency was available. |
| `FALLBACK_PORTFOLIO_CURRENCY_USED` | Info | Portfolio currency was used because activity currency was missing. |
| `MONEY_FIELD_WITHOUT_CURRENCY` | Warning | Amount exists but no currency could be derived. |
| `NUMERIC_PARSE_FAILED` | Warning | A number-like source field could not be parsed. |
| `MISSING_QUANTITY` | Info | Quantity is missing; this can be normal for some activity types. |
| `MISSING_PRICE` | Info | Price is missing; this can be normal for some activity types. |
| `DUPLICATE_INTERNAL_ACTIVITY_ID` | Warning | List normalization detected duplicate internal ids. |

## Hard rejection

The only hard rejection case in P1-4 is a non-object `raw` value.

The following do not reject an activity:

- missing type,
- unknown type,
- missing ISIN,
- invalid ISIN,
- missing datetime,
- missing amount,
- missing quantity,
- missing price.

Those cases produce warnings and keep as much normalized structure as possible.

## Non-goals

P1-4 does not implement:

- Global Asset aggregation,
- transfer pairing,
- cost-basis calculation,
- market value calculation,
- warning/confidence derivation beyond direct normalization warnings,
- product UI,
- product API routes.

Aggregation is documented separately in `docs/GLOBAL_ASSET_AGGREGATION.md`.

## Raw data rule

Raw Parqet payloads may be parsed internally. They must not be exposed fully in UI/API responses and must not be committed to the repository.

## Next step

P1-5 builds the Global Asset aggregation layer on top of `NormalizedActivity`.
