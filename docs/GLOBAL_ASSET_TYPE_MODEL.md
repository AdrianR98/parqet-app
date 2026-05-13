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

DP-06 keeps provider-derived realized gains, performance values, market values and position values as `provider_reference` unless the app independently recalculates and verifies the value. Provider reference fields may support audit comparison, but they must not be relabelled as app-owned cost basis, PnL or performance.

## Value classification

Calculation, audit and read-model layers should use these value classifications consistently:

- `provider_reference`: value comes from the provider or provider-side calculation; the app displays it as reference only.
- `app_calculated`: value was calculated by the app using a documented method.
- `estimated`: value uses fallbacks such as `latest_trade_price` or incomplete freshness.
- `preliminary`: value is structurally calculated but depends on not-yet-validated rules or evidence.
- `blocked`: value must not be shown as complete because it would be misleading.
- `none`: no value is available.

DP-06 authorizes `weighted_average_remaining_cost_basis` as the first app-owned cost-basis method, but it does not authorize implementation in this type-model document. FIFO, tax-specific reporting, external price APIs and FX conversion remain out of scope for V1.

Price-source classification should preserve:

- `provider_price`: preferred when freshness/source metadata is available.
- `provider_position_value`: may support market value but remains `provider_reference` when isolated price is unknown.
- `latest_trade_price`: estimated/stale fallback only, never current market price.
- `manual_snapshot` / `local_snapshot`: reserved unless later explicitly allowed.
- `none`: no usable price; market value and unrealized PnL are blocked.
## Dividend, fee, tax and currency model

DP-07 locks the planning policy for dividend, fee, tax and currency handling. This document update is documentation-only and does not change `src/lib/parqet/global-assets/types.ts`.

Future model/read-model fields should preserve separate dividend, fee and tax facts when source data supports them:

- `dividend_gross`
- `dividend_tax`
- `dividend_fee`
- `dividend_net`
- fee categories such as `buy_fee`, `sell_fee`, `dividend_fee` and `other_fee`
- tax categories such as `withholding_tax`, `capital_gains_tax`, `dividend_tax` and `other_tax`

Gross and net dividends must not be inferred when source meaning is unclear. A clearly net-only source amount should remain `dividend_net`; a clearly gross-only source amount should remain `dividend_gross`. An unclear amount basis should remain a labelled provider reference or unknown basis with a warning. When gross, taxes and fees are all clear and same-currency, net may be derived as gross minus tax minus fee. When net and taxes/fees are both provided, the model must avoid double-subtraction.

Fees and taxes are source facts, not hidden PnL, performance or app-owned tax-reporting treatment. Taxes are not tax advice and remain provider/source facts unless a later tax-specific policy defines app-owned treatment.

Money aggregation is same-currency-only. Missing currency must not default to EUR or portfolio currency, and portfolio currency is context only. Mixed-currency output may expose per-currency buckets, but single converted totals, FX conversion and provider-side FX dependency are blocked until a later FX policy defines source, date basis, freshness, cache/snapshot reuse, retry/rate-limit behavior, rounding precision, audit traceability, provider-FX trust and fallback/block behavior.

Closed-position dividends remain attached to asset history even when current quantity is zero. Closed-position assets may contribute historical dividend totals when single-currency safe, while current quantity and current position value may remain zero. Return, performance and dividend-yield metrics stay blocked or preliminary when denominator, holding period, cost basis, source basis or currency is unsafe.

## Timeline entries

`GlobalAssetTimelineEntry` wraps a normalized activity and adds display/audit concerns:

- display type,
- transfer group id,
- warnings,
- stable sort key.

The display type is separate from the normalized activity type. For example, a `deposit` activity may later display as `external_inflow` or `possible_transfer` depending on later logic.

## Transfer model

DP-05 locks a conservative transfer-candidate model. Transfers remain explicit normalized activity events and must not be collapsed into implicit quantity corrections.

The model prepares transfer types:

- `TransferCandidate`
- `TransferGroup`
- `TransferStatus`

Allowed transfer statuses:

- `not_transfer`: the activity is not a security transfer candidate.
- `transfer_candidate`: an explicit `transfer_in` or `transfer_out` that is eligible for later matching review.
- `paired`: one inbound and one outbound transfer candidate match deterministically.
- `unmatched_in`: an inbound transfer candidate has no safe outbound counterpart.
- `unmatched_out`: an outbound transfer candidate has no safe inbound counterpart.
- `partial`: only part of the quantity can be related to another candidate.
- `ambiguous`: more than one interpretation remains possible or required context is unsafe.
- `unsupported`: the case needs a documented rule that does not exist yet.

A pair may be marked `paired` only when all of these are true:

- same asset identity,
- same absolute quantity,
- compatible portfolio context,
- bounded date window,
- unique 1:1 candidate relationship,
- no conflicting warnings or blockers make the match unsafe.

Deposit and withdrawal activities are not security transfer-pairing inputs by default. They remain visible as cash/account-style or audit events unless a later cash/security decision explicitly changes that rule.

Unmatched, partial, duplicate, missing-context, date-uncertain, cross-currency and multi-candidate cases remain ambiguous. Ambiguous transfers stay visible in audit/read models but block affected metrics where ambiguity would mislead.

No transfer matching is implemented by this documentation change.

The model allows transfer groups to contain multiple activity IDs because partial transfers may exist.

Transfer ambiguity reasons include:

- multiple possible `transfer_in` candidates for one `transfer_out`,
- multiple possible `transfer_out` candidates for one `transfer_in`,
- different asset identity,
- missing or invalid asset identity,
- missing or invalid quantity,
- quantity mismatch,
- partial quantity match only,
- missing portfolio context,
- uncertain or invalid dates,
- date window too large,
- cross-currency case without an FX rule,
- provider-specific case without a documented safe rule,
- cost-basis information cannot be safely carried forward.

## DP-08 warnings, confidence and blocked metrics

DP-08 locks the canonical warning, confidence and blocked-metrics model for later read-model and audit output. This section is documentation-only and does not authorize implementation, UI copy implementation, route migration, provider calls, override/write behavior or product UI changes.

Canonical warning categories use stable machine-readable codes. Each category should support:

| Field | Semantics |
| --- | --- |
| `code` | Stable machine-readable warning code, for example `mixed_currency`. |
| `severity` | `info`, `warning` or `blocker`. |
| `audience` | `user`, `diagnostic` or `both`. |
| `source` | `normalization`, `aggregation`, `audit`, `read_model`, `provider_reference` or `local_policy`. |
| `affectedEntity` | `asset`, `activity`, `portfolio`, `metric`, `report` or `global`. |
| `blockedMetrics` | Metrics that must not be shown as complete. |
| `confidenceImpact` | `none`, `reduce_to_medium`, `reduce_to_low` or `metric_blocked`. |
| `messageKey` | Future UI-safe translation key, not final UI copy. |
| `debugHint` | Redacted technical hint for audit/development only, without raw payloads. |

User-facing warnings and diagnostic warnings are separate projections of the same canonical warning category:

- User-facing warnings must be understandable and explain impact without exposing raw or private data.
- User-facing warnings must not include raw provider fields, raw payloads, activity rows, activity IDs, portfolio IDs, stack traces, tokens, cookies or private exports.
- Diagnostic warnings may include technical categories, counts, source/freshness metadata, safe asset keys where already allowed, date buckets and redacted portfolio labels.
- Diagnostic warnings must still avoid raw payloads and private source rows.

Severity policy:

- `info`: no metric is blocked; context only, for example stale snapshot notice or closed-position income context.
- `warning`: values may remain visible but confidence is reduced, or the value is estimated/preliminary.
- `blocker`: one or more metrics listed in `blockedMetrics` must not be shown as complete.
- `blocker` does not hide the whole asset by default; it blocks specific metrics.

Transfer-related warning codes:

- `transfer_unpaired`
- `transfer_ambiguous`
- `transfer_partial`
- `transfer_duplicate_candidate`
- `transfer_quantity_mismatch`
- `transfer_asset_mismatch`
- `transfer_missing_portfolio_context`
- `transfer_date_uncertain`
- `transfer_cost_basis_unknown`
- `transfer_cross_currency_unsupported`

DP-07 warning codes for future read-model/audit output:

- `missing_currency`
- `mixed_currency`
- `fx_policy_missing`
- `dividend_amount_basis_unknown`
- `dividend_gross_net_ambiguous`
- `money_field_without_currency`
- `fee_tax_basis_unknown`
- `tax_treatment_not_app_owned`
- `closed_position_income_present`
- `currency_conversion_blocked`

Confidence is represented as:

- `high`
- `medium`
- `low`
- `unknown`

Confidence is derived from warning severity, source completeness, freshness, value classification and blocked metric presence. Confidence may exist at report, asset and metric level. Metric-level confidence is preferred over all-or-nothing asset confidence.

Confidence derivation policy:

- `high`: no relevant warnings, source/freshness complete enough and no blocked metrics.
- `medium`: non-blocking warnings, estimated/preliminary values or restricted freshness.
- `low`: blocker exists, important source/freshness is missing or affected metrics are blocked.
- `unknown`: source situation is insufficient for confidence classification.

There is no user/manual override in P1-4 or DP-08.

## Raw data rule

Raw Parqet payloads may be processed internally by normalization code, but they must not be exposed fully in UI/API responses and must not be committed to the repository.

All examples in this document are synthetic.

## Next step

P1-5 should build the Global Asset aggregation layer on top of `NormalizedActivity`.
