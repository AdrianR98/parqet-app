# Global Asset Aggregation

Status: Phase 1 aggregation guide

## Purpose

This document describes the Phase-1 Global Asset aggregation layer.

Aggregation means combining multiple `NormalizedActivity` entries into asset-level structures. In this phase, aggregation creates `GlobalAsset` objects, timelines, portfolio breakdowns, preliminary quantity totals, unresolved decision candidates and count-only summaries.

This layer does not replace current product routes or UI.

Related documents:

- `docs/adr/0002-global-asset-timeline.md`
- `docs/PROVIDER_DATA_SOURCE_STRATEGY.md`
- `docs/GLOBAL_ASSET_TYPE_MODEL.md`
- `docs/GLOBAL_ASSET_NORMALIZATION.md`
- `docs/GLOBAL_ASSET_AUDIT_REPORT.md`
- `docs/GLOBAL_ASSET_OVERRIDES.md`
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
  unresolvedDecisionCandidates: [],
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

Activities without `assetKey` are not aggregated into a Global Asset in P1-5/P1-8. They are returned as `unassignedActivities` and produce warnings.

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

No transfer pairing is performed in P1-8. DP-05 only locks the later safe pairing contract.

## DP-05 transfer handling

DP-05 preserves explicit `transfer_in` and `transfer_out` activities as normalized activity events. Aggregation/read-model logic may treat them as paired only when matching is deterministic:

- same asset identity,
- same absolute quantity,
- compatible portfolio context,
- bounded date window,
- unique 1:1 candidate relationship,
- no conflicting warnings or blockers that make the match unsafe.

`deposit` and `withdrawal` are not security transfer-pairing inputs by default. They may be displayed as external inflow/outflow or audit events, but they must not be used to pair security transfers unless a later decision documents a safe rule.

Transfer status values are:

- `not_transfer`
- `transfer_candidate`
- `paired`
- `unmatched_in`
- `unmatched_out`
- `partial`
- `ambiguous`
- `unsupported`

Ambiguous cases include:

- multiple possible `transfer_in` candidates for one `transfer_out`,
- multiple possible `transfer_out` candidates for one `transfer_in`,
- different, missing or invalid asset identity,
- missing or invalid quantity,
- quantity mismatch or partial quantity match only,
- missing portfolio context,
- uncertain or invalid dates,
- date window too large,
- cross-currency case without an FX rule,
- provider-specific case without a documented safe rule,
- cost-basis information cannot be safely carried forward.

Ambiguous transfers remain visible in audit/read models. They do not authorize automatic correction, user override behavior, provider calls, route migration, cost-basis calculation, PnL calculation, FX conversion or product UI changes.

Metric behavior:

| Behavior | Metrics / fields |
| --- | --- |
| Always visible | audit count, transfer candidate count, warning summaries, activity/audit diagnostics, asset presence when identity is clear |
| Conditionally visible | quantity / position quantity when asset identity and quantity are clear; confidence may be reduced |
| Blocked when ambiguity would mislead | `portfolio_breakdown`, `cost_basis`, `realized_pnl`, `unrealized_pnl`, `performance`, return metrics and dividend yield when transfer history makes the denominator or holding history unsafe |

Transfer warning categories:

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

## DP-07 dividend, fee, tax and currency policy

DP-07 locks a same-currency-only money aggregation policy for dividends, fees and taxes. This section is documentation-only and does not authorize implementation, FX conversion, provider calls, external FX APIs, product UI, PnL/performance calculation or tax-reporting policy.

Dividend, fee and tax fields remain separate source facts. Gross and net dividends may be calculated or aggregated only when source field meaning and currency are clear. Fees and taxes must not be folded into PnL, performance or tax reporting without a later policy.

Dividend fields/categories should be preserved where source data supports them:

- `dividend_gross`
- `dividend_tax`
- `dividend_fee`
- `dividend_net`

Gross/net dividend rules:

- Gross or net must not be inferred when source meaning is unclear.
- If only a clearly net amount exists, preserve it as `dividend_net`.
- If only a clearly gross amount exists, preserve it as `dividend_gross`.
- If amount basis is unclear, preserve it as a labelled `provider_reference` or unknown amount basis and warn.
- If gross, taxes and fees are all clear and same-currency, net may be derived as gross minus tax minus fee.
- If net and taxes/fees are both provided, do not double-subtract.
- Dividend yield and income-return metrics remain blocked or preliminary when holding period, cost basis, currency or denominator is unsafe.

Fees and taxes remain separate categories. Useful categories may include:

- `buy_fee`
- `sell_fee`
- `dividend_fee`
- `other_fee`
- `withholding_tax`
- `capital_gains_tax`
- `dividend_tax`
- `other_tax`

Taxes are not tax advice. Taxes remain provider/source facts unless a later tax-specific policy defines app-owned treatment. Ambiguous fee/tax fields warn and block affected metrics such as `cost_basis`, `realized_pnl`, net dividend totals or performance.

Closed-position dividend behavior:

- Dividends remain attached to asset history even when current quantity is zero.
- Closed-position assets may contribute historical dividend totals when same-currency safe.
- Current position value and quantity may be zero while historical dividends remain visible.
- Closed assets must not be dropped in a way that loses income history.
- Return and dividend-yield metrics for closed positions remain blocked or preliminary if denominator, holding period, cost basis or currency is unsafe.

Currency and FX rules:

- Only aggregate money values with the same currency.
- Mixed currencies must not be silently summed.
- Missing currency must not default to EUR or portfolio currency.
- Portfolio currency may be context, but it is not automatic conversion.
- Mixed-currency output should use per-currency buckets when possible.
- Single converted totals are blocked without an explicit FX policy.
- No FX conversion, external FX API or provider-side FX dependency is authorized by DP-07.

Future FX policy must define FX source, date basis such as trade date, settlement date, payment date or latest date, freshness, cache/snapshot reuse, retry/rate-limit behavior, rounding precision, audit traceability, whether provider FX fields may be trusted and fallback/block behavior.

Blocked when currency is mixed, missing or no FX policy exists:

- `total_dividend_net`
- `total_dividend_gross`
- `total_fees`
- `total_taxes`
- `income_total`
- `performance`
- return metrics
- `dividend_yield`

Blocked when dividend amount basis is ambiguous:

- `dividend_net`
- `dividend_gross`
- `dividend_yield`
- income return metrics

Diagnostic/audit output remains allowed for per-currency subtotals, audit counts, activity lists, warning summaries and asset-level historical income when single-currency safe. Provider-reference dividend amounts are allowed only when labelled as provider references.

DP-07 warning categories:

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

## Negative quantity classification

When a negative quantity remains after tolerance, aggregation creates unresolved decision candidates.

Initial cause categories:

```text
sell_exceeds_known_position
transfer_in_then_sell_then_sell
duplicate_sell_candidate
missing_inbound_activity
unknown_negative_quantity_case
```

The classifier compares known inbound quantity against known outbound quantity per asset/portfolio.

Examples:

- `sell_exceeds_known_position`: outbound quantity is greater than known inbound quantity.
- `transfer_in_then_sell_then_sell`: a transfer-in quantity is followed by at least two matching sells.
- `duplicate_sell_candidate`: two or more sells have the same quantity and may need user review.
- `missing_inbound_activity`: outbound quantity exists but no inbound quantity is known.
- `unknown_negative_quantity_case`: no more specific cause is detected.

These classifications are diagnostic. They do not repair data and do not unblock metrics.

## Unresolved decision candidates

Unresolved decision candidates are attached to:

- the affected Global Asset,
- aggregation output,
- audit output,
- warning metadata for negative quantity warnings.

They include:

- cause category,
- asset key,
- portfolio reference,
- known inbound quantity,
- known outbound quantity,
- negative quantity,
- suggested future decision types,
- `metricsBlocked: true`.

Affected position and portfolio-breakdown metrics remain blocked until a future explicit user decision exists.

## Totals

P1-8 calculates these totals:

- `quantity`
- `dividendsNet`
- `fees`
- `taxes`

P1-8 intentionally leaves these values null:

- `marketValue`
- `costBasis`
- `unrealizedPnL`

Dividend, fee and tax totals are calculated only when currencies are consistent. Mixed currencies block the affected totals and create warnings. No FX conversion is performed.

DP-07 further restricts money aggregation to same-currency-safe values with clear field meaning. Future read models should prefer per-currency buckets for mixed-currency diagnostics and block converted/single-currency totals until an explicit FX policy exists.

The provider data-source strategy keeps current market value, app-owned cost basis, realized PnL, unrealized PnL and FX as blocked/unknown until a later decision defines their source, freshness, confidence and calculation ownership. Provider-supplied values may be preserved only as labelled provider references.

## DP-06 calculation policy

DP-06 locks a conservative calculation policy for cost basis, PnL and price sources. This is planning/documentation only and does not authorize implementation, route migration, product UI changes, provider/API calls, external price APIs, FX conversion, cache/storage changes or a performance engine.

The first app-owned cost-basis method is `weighted_average_remaining_cost_basis`. App-owned realized PnL, unrealized PnL, performance and return metrics remain blocked or preliminary until validation evidence proves that activity history, transfers, currency, fees/taxes and price sources are safe.

Provider-derived realized gains, performance values, market values and position values remain `provider_reference` unless independently recalculated and verified by the app.

Cost-basis policy:

- A buy increases quantity and remaining cost basis when amount, quantity and currency are reliable.
- A sell reduces quantity and remaining cost basis proportionally using the current weighted average.
- Remaining cost basis belongs only to the remaining open position.
- FIFO is not V1-first and remains optional/Post-V1.
- No tax-specific cost-basis or tax-reporting policy is authorized.

Realized PnL policy:

- App-owned `realized_pnl` may only be shown when the sell can be matched against reliable app-owned cost basis.
- Parqet/provider realized gains remain `provider_reference` until independently recalculated and validated by the app.
- A sell without reliable previous buys, missing proceeds, invalid quantity, mixed currency, transfer ambiguity or fee/tax ambiguity blocks `realized_pnl`.

Unrealized PnL policy:

- `unrealized_pnl` depends on remaining cost basis and a usable market value or price source.
- If `cost_basis` is blocked, `unrealized_pnl` is blocked.
- If the price source is missing, unsafe or stale beyond allowed fallback semantics, `unrealized_pnl` is blocked or marked estimated/preliminary.
- Latest trade price is not a current market price. It is an estimated/stale fallback only.

Market value and price-source hierarchy:

1. `provider_price`
2. `provider_position_value`
3. `latest_trade_price`
4. `manual_snapshot` / `local_snapshot` only if later explicitly allowed
5. `none`

Price-source semantics:

- `provider_price`: preferred when freshness and source metadata are available.
- `provider_position_value`: may support market value but remains `provider_reference` when isolated price is unknown.
- `latest_trade_price`: fallback only; mark estimated/stale/preliminary and never present as current market price.
- `none`: blocks `market_value` and `unrealized_pnl`.
- DP-06 authorizes no external price or FX APIs.

Fee and tax policy:

- Buy fees may increase cost basis only when the source field meaning is clear.
- Sell fees may reduce proceeds or be tracked as realized-result impact only when the source field meaning is clear.
- Taxes remain separate and must not be folded into cost basis unless a later tax-specific decision explicitly allows it.
- Dividend taxes belong to dividend gross/net policy, not security cost basis.
- Ambiguous fee/tax fields warn and block affected metrics such as `cost_basis`, `realized_pnl` or `performance`.

Blocked metric rules:

| Metric | Block when |
| --- | --- |
| `cost_basis` | missing buy/sell amount; invalid quantity; missing or mixed currency; unknown activity type affects quantity or amount; transfer ambiguity affects position history; fee/tax ambiguity affects cost basis; negative position from inconsistent history; sell exists without reliable earlier buy history |
| `realized_pnl` | `cost_basis` is blocked; sell has no reliable cost basis; transfer ambiguity affects sold quantity basis; mixed currency exists without FX rule; sell proceeds are missing or invalid; fees/taxes are ambiguous |
| `unrealized_pnl` | remaining cost basis is blocked; usable price or position value is missing; only stale `latest_trade_price` exists and estimate display is not allowed; mixed currency exists without FX rule |
| `performance` / return metrics | realized or unrealized PnL is blocked; cashflow rules are missing; transfer ambiguity affects holding history; price source is stale or missing; mixed currency exists without FX rule |

## Display metadata

P1-8 does not perform metadata enrichment.

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

Negative quantity warnings may include machine-readable cause metadata.

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

P1-8 does not implement:

- product UI,
- existing dashboard/asset route replacement,
- cost-basis calculation,
- market-value calculation,
- unrealized PnL calculation,
- transfer pairing,
- metadata enrichment,
- FX conversion,
- override application,
- persistence API,
- test framework setup.

## Next step

The next Phase-1 steps should use the audit/report output to apply narrow user-confirmed overrides, inspect transfer handling, refine warning/confidence behavior and later decide product integration timing.
