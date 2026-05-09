# Global Asset Type Model

Status: Phase 1 type-model guide

## Purpose

This document explains the Phase-1 Global Asset Timeline type model.

The type model defines the TypeScript boundary for later normalization, aggregation, transfer handling, warning/confidence and audit-report work. It does not implement business logic.

Related documents:

- `docs/PARQET_API_AUDIT.md`
- `docs/adr/0002-global-asset-timeline.md`
- `src/lib/parqet/global-assets/types.ts`

## Boundaries

The model is intentionally isolated under:

```text
src/lib/parqet/global-assets/types.ts
```

It does not modify `src/lib/types.ts`.

Allowed in P1-3:

- type definitions,
- small type guards,
- comments documenting invariants.

Not included in P1-3:

- normalization pipeline,
- global asset builder,
- transfer pairing,
- cost-basis calculation,
- warning derivation,
- confidence derivation,
- product UI,
- product API route changes.

## Core idea

Raw Parqet activities are not used directly by later Global Asset aggregation.

A future fetch layer must first attach portfolio context, producing:

```ts
const contextualActivity = {
  portfolioId: "portfolio_demo_1",
  portfolioName: "Synthetic Portfolio",
  portfolioCurrency: "EUR",
  raw: {},
};
```

Then a future normalization step converts that contextual activity into `NormalizedActivity`.

## Asset identity

`asset.isin` is the primary observed global asset identity from the runtime audit.

The type model uses an object-based key:

```ts
const assetKey = {
  type: "isin",
  value: "DEMO00000000",
};
```

The key union also prepares later fallbacks:

- `wkn`
- `parqet_asset_id`
- `manual`

Only `isin` is actively supported by the current audit and ADR.

If a valid ISIN is present, `assetKey` should be derivable from it. Activities without an `assetKey` may still be normalized, but later warnings/blockers must handle them.

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
    internalActivityId: "internal_demo_1",
  },
  activityType: "buy",
  sourceType: "buy",
  datetime: "2026-01-01T12:00:00.000Z",
  date: "2026-01-01",
  sortKey: "2026-01-01T12:00:00.000Z|activity_demo_1",
  assetIdentity: {
    assetKey: { type: "isin", value: "DEMO00000000" },
    isin: "DEMO00000000",
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

No transfer matching is implemented in P1-3.

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

Confidence is derived from warnings in later logic. There is no user/manual override in P1-3.

## Raw data rule

Raw Parqet payloads may be processed internally by future normalization code, but they must not be exposed fully in UI/API responses and must not be committed to the repository.

All examples in this document are synthetic.

## Next step

P1-4 should implement the normalization pipeline that converts `ParqetActivityWithPortfolioContext` into `NormalizedActivity`.
