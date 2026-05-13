# Global Asset Type Model

Status: Phase 1 type-model guide

## Purpose

This document explains the Phase-1 Global Asset Timeline type model.

The type model defines the TypeScript boundary for normalization, aggregation, transfer handling, warning/confidence and audit-report work. It does not implement business logic.

Related documents:

- `docs/PARQET_API_AUDIT.md`
- `docs/adr/0002-global-asset-timeline.md`
- `docs/ASSET_IDENTITY_AND_METADATA.md`
- `docs/GLOBAL_ASSET_NORMALIZATION.md`
- `src/lib/parqet/global-assets/types.ts`
- `src/lib/parqet/global-assets/normalize.ts`

## Boundaries

The model is intentionally isolated under:

```text
src/lib/parqet/global-assets/types.ts
```

It does not modify `src/lib/types.ts`.

Allowed in the type-model layer:

- type definitions,
- small type guards,
- comments documenting invariants.

The normalization layer may map contextual raw input into `NormalizedActivity`, but it must not aggregate assets or calculate portfolio/global totals.

Not included in the type model or normalization layer:

- global asset builder,
- transfer pairing,
- cost-basis calculation,
- warning derivation beyond direct normalization warnings,
- confidence derivation,
- product UI,
- product API route changes.

## Core idea

Raw Parqet activities are not used directly by later Global Asset aggregation.

A fetch layer must first attach portfolio context, producing:

```ts
const contextualActivity = {
  portfolioId: "portfolio_demo_1",
  portfolioName: "Synthetic Portfolio",
  portfolioCurrency: "EUR",
  raw: {},
};
```

Then the normalization step converts that contextual activity into `NormalizedActivity`.

## Asset identity

`asset.isin` is the primary observed global asset identity from the runtime audit.

The type model uses an object-based key:

```ts
const assetKey = {
  type: "isin",
  value: "DEMO0000000",
};
```

The key union also prepares later fallbacks:

- `wkn`
- `parqet_asset_id`
- `manual`

Only `isin` is actively supported by the current audit and ADR.

The durable DP-03 identity boundary is documented in `docs/ASSET_IDENTITY_AND_METADATA.md`. WKN, Parqet asset ID, holding ID, `externalId`, ticker/symbol, names, local metadata and manual keys are not active calculation keys unless a later issue explicitly changes that policy.

If a valid ISIN is present, `assetKey` should be derivable from it. Activities without an `assetKey` may still be normalized, but warnings/blockers must handle them.

## Money values

Money-like fields use `MoneyValue`:

```ts
const money = {
  amount: 123.45,
  currency: "EUR",
};
```

Money fields are optional/nullable at the parent field level. Inside `MoneyValue`, both `amount` and `currency` are required.

## Normalized activity example

Synthetic example only:

```ts
const normalizedActivity = {
  ids: {
    sourceActivityId: "activity_demo_1",
    internalActivityId: "source:activity_demo_1",
  },
  activityType: "buy",
  sourceType: "buy",
  datetime: "2026-01-01T12:00:00.000Z",
  date: "2026-01-01",
  sortKey: "2026-01-01T12:00:00.000Z|source:activity_demo_1",
  assetIdentity: {
    assetKey: { type: "isin", value: "DEMO0000000" },
    isin: "DEMO0000000",
    assetIdentifierType: "isin",
    holdingId: "holding_demo_1",
    holdingAssetType: "security",
  },
  portfolioContext: {
    portfolioId: "portfolio_demo_1",
    portfolioName: "Synthetic Portfolio",
    portfolioCurrency: "EUR",
  },
  quantity: 10,
  pricePerShare: {
    amount: 50,
    currency: "EUR",
  },
  activityCurrency: "EUR",
  amounts: {
    amount: { amount: 500, currency: "EUR" },
    amountNet: { amount: 500, currency: "EUR" },
    fee: { amount: 0, currency: "EUR" },
    tax: { amount: 0, currency: "EUR" },
  },
  parqetReference: null,
};
```

## Normalization result

Single activity normalization returns:

```ts
{
  activity: normalizedActivity,
  warnings: [],
}
```

List normalization also returns a count-only summary. The summary must not include private values.

Detailed mapping rules are documented in `docs/GLOBAL_ASSET_NORMALIZATION.md`.

## Parqet reference fields

The model preserves these fields as reference data only:

- `realizedGains`
- `realizedGainsNet`
- `buyAmountNet`
- `avgHoldingPeriodDays`

They are not self-owned app calculations. Future cost-basis and realized-gain decisions require separate implementation work or ADR updates.

## Timeline entries

`GlobalAssetTimelineEntry` wraps a normalized activity and adds display/audit concerns:

- display type,
- transfer group id,
- warnings,
- stable sort key.

The display type is separate from the normalized activity type. For example, a `deposit` activity may later display as `external_inflow` or `possible_transfer` depending on later logic.

## Transfer model

The model prepares transfer types:

- `TransferCandidate`
- `TransferGroup`
- `TransferStatus`

No transfer matching is implemented in P1-4.

The model allows transfer groups to contain multiple activity IDs because partial transfers may exist.

## Warnings and confidence

Warnings use:

- code,
- severity,
- UI-capable message,
- optional debug message,
- source,
- entity references,
- blocked metrics.

Confidence is represented as:

- `high`
- `medium`
- `low`

Confidence is derived from warnings in later logic. There is no user/manual override in P1-4.

## Raw data rule

Raw Parqet payloads may be processed internally by normalization code, but they must not be exposed fully in UI/API responses and must not be committed to the repository.

All examples in this document are synthetic.

## Next step

P1-5 should build the Global Asset aggregation layer on top of `NormalizedActivity`.
