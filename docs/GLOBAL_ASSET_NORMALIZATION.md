# Global Asset Normalization

Status: Phase 1 normalization guide

## Purpose

This document describes the Phase-1 Global Asset activity normalization layer.

Normalization means converting portfolio-context-enriched Parqet activity data into the app's internal `NormalizedActivity` shape.

This layer does not aggregate assets, calculate cost basis, match transfers or update product UI.

Related documents:

- `docs/adr/0002-global-asset-timeline.md`
- `docs/PROVIDER_DATA_SOURCE_STRATEGY.md`
- `docs/ASSET_IDENTITY_AND_METADATA.md`
- `docs/GLOBAL_ASSET_TYPE_MODEL.md`
- `docs/GLOBAL_ASSET_AGGREGATION.md`
- `src/lib/parqet/global-assets/types.ts`
- `src/lib/parqet/global-assets/normalize.ts`
- `src/lib/parqet/global-assets/aggregate.ts`

## DP-04 Contract Boundary

This document locks the DP-04 activity normalization contract for #253 before product read models may depend on the Global Asset pipeline.

Product calculations must start from app-owned normalized activities or aggregates derived from them. Provider DTOs and raw provider shapes are fetch/parse/normalization inputs only. They must not pass directly into product UI, browser-local read models, reports or feature-local calculations.

Normalization is provider-call-free by default. It receives already-loaded, portfolio-context-enriched activity input and produces app-owned activity records, warnings, count summaries and safe source/freshness/confidence inputs for later layers.

This contract is documentation-only. It does not implement new warning codes, route migration, transfer pairing, cost basis, PnL, durable storage, read models, provider calls or UI behavior.

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

## Activity type handling

The first production-near normalization coverage must include:

- `buy`
- `sell`
- `dividend`
- `fees_taxes` as the current fee/tax-bearing provider category
- `transfer_in`
- `transfer_out`

The contract also preserves `deposit`, `withdrawal` and `unknown` because provider activity history can include cash, account, transfer-like or unsupported records. These records may remain audit-/warning-only unless a later decision explicitly allows them as security calculation inputs.

Activity direction must come from the normalized `activityType`, not from raw provider field shape. Aggregation must not guess quantity direction from whether a provider field happens to be named `shares`, `quantity`, `amount` or similar.

Direction conventions for later consumers:

| Activity type | Security quantity direction | Calculation status |
| --- | --- | --- |
| `buy` | Positive/inbound. | Candidate input for security quantity and later cost-basis decisions. |
| `sell` | Negative/outbound. | Candidate input for security quantity and later realized-result decisions. |
| `dividend` | No security quantity effect. | Candidate input for dividend totals when amount and currency are usable. |
| `fees_taxes` | No security quantity effect by default. | Candidate input for fee/tax totals when amount and currency are usable. |
| `transfer_in` | Positive/inbound candidate. | Visible as transfer candidate; pairing remains blocked until #254 / DP-05. |
| `transfer_out` | Negative/outbound candidate. | Visible as transfer candidate; pairing remains blocked until #254 / DP-05. |
| `deposit` | No normal security calculation input by default. | Audit/warning-only unless a later cash/security decision allows it. |
| `withdrawal` | No normal security calculation input by default. | Audit/warning-only unless a later cash/security decision allows it. |
| `unknown` | No inferred effect. | Must remain visible in audit/diagnostics with warnings. |

Unknown, new or unsupported provider activity types must not be silently dropped. They should normalize to `activityType: "unknown"` when possible, preserve `sourceType`, stay visible in audit/diagnostics and emit a user-safe warning. If the unknown type affects a metric, the affected metric must be blocked or confidence must be lowered instead of using an implicit default.

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

## Field contract

Required fields for a trustworthy normalized activity:

| Field group | Required expectation | Missing or invalid behavior |
| --- | --- | --- |
| Provider/source activity id | Preserve stable provider activity ids when available. | Emit missing-id warning. A future implementation may derive a deterministic internal key from redaction-safe fields, but this issue does not implement it. |
| Internal activity id | Every normalized activity needs a stable internal id for ordering and references. | Use provider id when available; fallback ids must be deterministic and privacy-safe. Duplicate internal ids warn. |
| Activity type | Map supported provider type to app-owned `activityType`. | Missing, unknown or unsupported type warns and normalizes to `unknown` when possible. |
| Date/sort fields | Preserve usable source datetime, derive `date` and build `sortKey`. | Missing/invalid date warns and blocks time-dependent metrics where needed. |
| Portfolio context | Carry `portfolioId`, portfolio label context and portfolio currency when known. | Missing portfolio context warns and blocks portfolio breakdown, transfer pairing and portfolio-scoped metrics. |
| Asset identity for security activities | Carry a valid active asset key when available. | Missing/invalid identifier warns and blocks metrics that need security grouping. DP-03 owns identifier policy. |
| Quantity for quantity-bearing security activities | Preserve parsed numeric quantity for buys, sells and transfer candidates. | Missing quantity warns for quantity-bearing activity types. Invalid numeric input becomes `null` plus warning, never automatic `0`. |
| Amount/currency for money-bearing activities | Preserve amount fields only when amount and currency are both usable. | Missing amount or currency warns for money-bearing metrics. Invalid numeric input becomes `null` plus warning, never automatic `0`. |

Optional fields include price per share, fees, taxes, net amount, provider reference realized gains, holding id, holding asset type and provider source type. Optional does not mean ignorable: if a later metric needs one of these fields, missing or invalid data must warn, lower confidence or block that metric.

Warning fields must travel with the normalized activity or normalization result in a machine-readable form:

- stable warning code,
- severity,
- user-safe message category,
- optional redacted debug hint,
- source layer,
- entity references safe enough for diagnostics,
- `blockedMetrics` when the warning makes a metric unsafe to show as complete.

Blocker fields are not separate raw fields. A blocker is a warning with severity `Blocker` and, usually, one or more `blockedMetrics`. Blockers prevent affected metrics from being treated as complete; they do not require dropping the activity unless the raw input cannot be normalized at all.

## Warning table

The current implementation uses uppercase warning codes. DP-04 recommends canonical lowercase snake_case names for future read models and audit output. Until implementation changes are authorized, docs should preserve current names and map them to the recommended canonical names.

Warning-code ownership rules:

- Warning codes are owned by the normalization/audit layer, not UI copy.
- Codes are stable, lowercase snake_case for new canonical names.
- Codes describe data-quality categories, not raw provider values.
- Codes must be user-safe and privacy-safe.
- UI copy may translate or explain a code, but must not invent a different machine-readable code.
- Diagnostics and audit output may show counts, warning codes, types, scopes and redacted debug hints only.

| Code | Severity | Meaning |
| --- | --- | --- |
| `RAW_ACTIVITY_NOT_OBJECT` | Blocker | Raw activity cannot be normalized because it is not an object. |
| `MISSING_PORTFOLIO_CONTEXT` | Warning | Portfolio context required for portfolio-scoped output is missing. |
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

Recommended canonical categories:

| Canonical code | Current related code, if any | Category |
| --- | --- | --- |
| `unknown_activity_type` | `UNKNOWN_ACTIVITY_TYPE` | Source type is missing or not recognized. |
| `unsupported_activity_type` | `UNKNOWN_ACTIVITY_TYPE` | Source type is recognized as not supported for the requested metric. |
| `missing_identifier` | `MISSING_ISIN`, `MISSING_ASSET_KEY` | Security identity is absent. |
| `invalid_identifier` | `INVALID_ISIN` | Security identity candidate is present but invalid for active identity policy. |
| `missing_portfolio_context` | `MISSING_PORTFOLIO_CONTEXT` | Portfolio context needed for portfolio-scoped metrics is absent. |
| `missing_activity_id` | `MISSING_ACTIVITY_ID` | Stable provider activity id is absent. |
| `derived_activity_id` | `MISSING_ACTIVITY_ID` | Internal id was derived from fallback fields. |
| `missing_date` | `MISSING_DATETIME` | Source date/datetime is absent. |
| `invalid_date` | `INVALID_DATETIME` | Source date/datetime cannot be safely interpreted. |
| `invalid_number` | `NUMERIC_PARSE_FAILED` | Numeric source field cannot be parsed and becomes `null`. |
| `missing_quantity` | `MISSING_QUANTITY` | Quantity is absent where a metric needs it. |
| `missing_amount` | none yet | Amount is absent where a metric needs it. |
| `missing_currency` | `MISSING_CURRENCY`, `MONEY_FIELD_WITHOUT_CURRENCY` | Currency is absent where a money value needs it. |
| `currency_mismatch` | aggregation `MIXED_CURRENCIES` | Mixed currency prevents complete totals without a later FX decision. |
| `transfer_unpaired` | aggregation transfer/negative-position warnings | Transfer candidate cannot be paired yet. |
| `cash_or_non_security_activity` | none yet | Cash/account/non-security record is preserved but not a normal security calculation input. |
| `raw_payload_redacted` | audit privacy metadata | Raw provider payload was intentionally excluded or redacted. |

Warning versus blocker versus info behavior:

- `Info` records a safe normalization note that does not by itself reduce confidence or block a metric.
- `Warning` records a data-quality gap or unsupported category. It should lower confidence when the gap affects interpretation.
- `Blocker` records a gap that would make one or more metrics misleading. Affected metrics must be listed in `blockedMetrics`.
- Missing required fields in security-relevant activities should warn, lower confidence or block affected metrics.
- Unknown/new activity types should warn and remain visible rather than being dropped.
- Invalid numeric values must become `null` plus warning, not `0`.
- Missing/invalid dates must warn and block time-dependent metrics where needed.

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

## Stable IDs and ordering

Stable provider activity IDs should be preserved when available in `ids.sourceActivityId`.

`ids.internalActivityId` is the app-owned activity key used for references, ordering tie-breakers and audit links. It should prefer the stable provider activity ID. If the provider activity ID is missing, a future implementation may derive a deterministic internal key from redaction-safe fields such as normalized type/date/portfolio/asset/quantity/amount categories. DP-04 does not implement or approve a specific fallback algorithm.

Fallback IDs must not include raw provider payloads, tokens, cookies, account details, unredacted portfolio names, real activity rows or other private data in docs, UI, logs, exports, issue comments or PR bodies.

`sortKey` must be stable and deterministic. It should combine a usable source datetime with `internalActivityId`. If datetime is missing or invalid, normalization may use an `unknown-date` prefix, but time-dependent metrics must warn and block where ordering would be misleading.

`date` is a normalized calendar date string for grouping and display when safely derivable. It is not a replacement for the original source datetime and must not imply precision that the source did not provide.

## Unit, quantity, amount and currency rules

Quantities represent security units/shares for security-like activities. They must remain numeric values or `null`; missing or invalid quantities must not become `0` automatically. Direction is determined by normalized activity type and later aggregation rules.

Amounts represent money-like provider fields as `MoneyValue` only when both numeric amount and currency are usable. Invalid amount fields become `null` plus warning. Missing amount fields may be acceptable for some activity types, but any metric that needs that amount must warn, lower confidence or block.

Currency is preserved from the activity when available. Portfolio currency may be used as a fallback only with an explicit info/warning category. Mixed currencies must not be silently summed. No FX conversion is authorized by this normalization contract.

Fees and taxes remain separate money fields where available. Dividend, fee and tax totals may only be considered complete when the relevant amount and currency inputs are present and consistent. Provider-computed realized gains or performance-like values remain labelled provider references unless a later decision promotes them.

## Source, freshness and confidence exposure

Normalization should expose enough context for later read models to carry:

- `source`: provider, provider_reference, app_calculated, snapshot, local_metadata, user_override, mixed or none as appropriate in later layers,
- `freshness`: loaded/calculated timestamp or stale/unknown state from the source snapshot/read model,
- `confidence`: high, medium or low derived from warnings and blockers in later layers,
- `warnings`: stable user-safe warning codes with optional redacted hints,
- `blockedMetrics`: explicit affected metrics that must not be shown as complete.

Normalization itself does not own final read-model freshness or confidence. It must preserve the warning, source and blocked-metric inputs needed for aggregation and read-model layers to derive them consistently with `docs/PROVIDER_DATA_SOURCE_STRATEGY.md` and `docs/V1_GUARDRAILS.md`.

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

Raw Parqet payloads may be parsed internally at the fetch/parse/normalization boundary. They must not be exposed fully in UI/API responses and must not be committed to the repository.

Raw provider payloads must not be included in docs, UI, logs, exports, issue comments or PR bodies. Diagnostics and audit output must use redacted counts, activity types, warning codes, blocked metric names, safe source/freshness metadata and privacy-safe debug hints only.

Provider DTOs must stay at the boundary. Product UI/read models consume normalized activities, aggregates or deliberate projections, not raw provider DTOs.

## Next step

Later implementation prerequisites before product read models may depend on this contract:

- implement or map canonical lowercase warning codes without breaking current audit evidence,
- define metric-specific warning/blocker behavior with #257 / DP-08,
- define transfer pairing with #254 / DP-05 before treating transfers as complete,
- define product read-model/cache projection and migration order before route replacement,
- compare old/current activity outputs with Global Asset normalized output using synthetic fixtures or redacted local audit summaries,
- keep normalization provider-call-free by default and document any later provider/data behavior separately.
