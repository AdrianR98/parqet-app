# Global Asset Audit Report

Status: Phase 1 audit/report guide

## Purpose

The Global Asset audit report is a guarded development-only inspection path for the isolated Phase-1 Global Asset pipeline.

It runs:

```text
ParqetActivityWithPortfolioContext[]
-> normalizeActivities()
-> buildGlobalAssetsFromNormalizationResult()
-> createGlobalAssetAuditReport()
```

The report exists to validate the new pipeline before any product UI or existing route is replaced.

For terminal-based local usage, see `docs/LOCAL_AUDIT_WORKFLOW.md`.

For user-decision handling and overrides, see `docs/GLOBAL_ASSET_OVERRIDES.md`.

## Route

Local route:

```text
/api/parqet/global-assets/audit
```

The route is hard-blocked in production and requires:

```text
ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true
```

The route must never return raw Parqet payloads.

## Query parameters

Supported parameters:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `includeActivities` | `false` | Includes redacted normalized activities only when explicitly enabled. |
| `includeAssets` | `true` | Includes redacted Global Assets unless explicitly disabled. |
| `includeAmounts` | `false` | Includes money values only when explicitly enabled. |
| `includePortfolioNames` | `false` | Includes real portfolio names only when explicitly enabled. |
| `includeActivityIds` | `false` | Includes source/internal activity IDs only when explicitly enabled. |
| `isin` | empty | Convenience filter for a single ISIN / Global Asset. |
| `assetKeyType` | empty | Explicit asset key type. Currently `isin`. |
| `assetKeyValue` | empty | Explicit asset key value. |
| `portfolioIds` | empty | Comma-separated portfolio IDs. |
| `portfolioId` | empty | Repeatable portfolio ID parameter. |
| `limit` | `20` | Limits returned arrays and nested timelines where practical. |

Defaults are data-saving. Portfolio names are redacted to `Portfolio 1`, `Portfolio 2`, etc. Portfolio IDs are pseudonymized to `portfolio_1`, `portfolio_2`, etc. Holding IDs, activity IDs, source IDs, source-bearing sort keys and amounts are hidden unless explicitly requested.

## Example local calls

Minimal local call:

```text
http://localhost:3000/api/parqet/global-assets/audit
```

Summary-focused report without assets or activities:

```text
http://localhost:3000/api/parqet/global-assets/audit?includeAssets=false&includeActivities=false&limit=5
```

Terminal helper for the same summary-focused report:

```powershell
npm run audit:summary
```

Small report with a low array limit:

```text
http://localhost:3000/api/parqet/global-assets/audit?limit=5
```

Include activities locally, still redacted:

```text
http://localhost:3000/api/parqet/global-assets/audit?includeActivities=true&limit=5
```

Focused ISIN helper:

```powershell
npm run audit:asset -- -Isin US83444M1018
```

Equivalent focused ISIN route:

```text
http://localhost:3000/api/parqet/global-assets/audit?isin=US83444M1018&includeAssets=true&includeActivities=true&limit=100
```

Explicit asset key route:

```text
http://localhost:3000/api/parqet/global-assets/audit?assetKeyType=isin&assetKeyValue=US83444M1018&includeAssets=true&limit=100
```

Include amounts and portfolio names locally:

```text
http://localhost:3000/api/parqet/global-assets/audit?includeAmounts=true&includePortfolioNames=true&limit=5
```

Filter portfolios:

```text
http://localhost:3000/api/parqet/global-assets/audit?portfolioIds=portfolio_demo_1,portfolio_demo_2
```

Do not paste real output into issues, pull requests, docs or screenshots.

## Asset filter behavior

`isin` is a convenience alias for:

```text
assetKeyType=isin&assetKeyValue=<ISIN>
```

Explicit `assetKeyType` and `assetKeyValue` win over `isin` if both are provided. ISIN input is trimmed and uppercased.

When an asset filter is active:

- normalized activities are filtered before aggregation,
- summaries represent the filtered audit output,
- `sources.sourceActivityCount` still shows the full fetched source count,
- `sources.filteredActivityCount` shows the number of matching normalized activities,
- `sources.assetFilterApplied` is `true`.

## Unresolved decision candidates

Unresolved decision candidates identify cases where the app should not automatically repair data.

They appear in:

```text
aggregation.unresolvedDecisionCandidates
summary.unresolvedDecisionCandidateCount
```

They may also appear as warning metadata for `NEGATIVE_POSITION_QUANTITY` warnings.

Initial cause categories:

```text
sell_exceeds_known_position
transfer_in_then_sell_then_sell
duplicate_sell_candidate
missing_inbound_activity
unknown_negative_quantity_case
```

These candidates are diagnostic only. They do not change calculations by themselves. Affected metrics remain blocked until an explicit user decision exists.

## Applied overrides

The first applied override class is:

```text
ignore_activity_for_position
```

When a narrow enabled override matches an activity, the activity remains visible in the timeline, but its position quantity effect is `0`.

Applied overrides appear in:

```text
summary.appliedOverrideCount
aggregation.summary.appliedOverrideCount
aggregation.appliedOverrides
```

If assets/activities are included, redacted timeline entries may also show:

```text
activity.positionOverride.affectsPosition = false
```

Redaction still applies:

- portfolio IDs are pseudonymized by default,
- activity IDs are hidden unless `includeActivityIds=true`,
- amounts are hidden unless `includeAmounts=true`,
- raw payloads are never returned.

With an empty override file, `appliedOverrideCount` should be `0` and behavior should be unchanged.

## Report shape

Top-level fields:

- `generatedAt`
- `environment`
- `sources`
- `normalization`
- `aggregation`
- `warnings`
- `warningsTruncated`
- `summary`
- `privacy`
- `nextSteps`

The combined summary is count-only and contains no private values.

Returned arrays include truncation flags, for example:

- `normalization.activitiesTruncated`
- `normalization.warningsTruncated`
- `aggregation.assetsTruncated`
- `aggregation.unassignedActivitiesTruncated`
- `aggregation.warningsTruncated`
- `aggregation.unresolvedDecisionCandidatesTruncated`
- `aggregation.appliedOverridesTruncated`
- `aggregation.timelinesTruncated`
- top-level `warningsTruncated`

## DP-05 transfer audit expectations

DP-05 transfer handling is documentation-only here and does not implement transfer pairing in the audit route. Later aggregate audit/read-model output should be able to expose transfer facts without raw provider payloads or private portfolio data.

Aggregate audit/read-model output should be able to expose:

- `transferStatus`
- candidate count
- paired count
- unmatched count
- ambiguous count
- partial count
- warning codes
- `blockedMetrics`
- confidence
- safe source/freshness metadata

Single transfer candidate diagnostics may expose:

- `normalizedActivityId`
- `activityType`
- safe asset identity
- quantity
- date bucket
- portfolio context category
- `transferStatus`
- `matchCandidateCount`
- `ambiguityReason`
- `blockedMetrics`

Diagnostic output must keep unmatched, partial and ambiguous transfer candidates visible. It must also keep affected metrics blocked when transfer ambiguity would make portfolio breakdown, cost basis, PnL, performance, return metrics or dividend yield misleading.

## DP-06 calculation-policy audit expectations

DP-06 is documentation-only here and does not implement cost-basis, PnL, price-source or performance calculations in the audit route. Later audit/read-model output should prove when values are `provider_reference`, `app_calculated`, `estimated`, `preliminary`, `blocked` or `none`.

Before app-owned cost basis, realized PnL, unrealized PnL, market value, performance or return metrics are implemented, validation evidence must include:

- synthetic fixtures for buys, sells, partial sells, fees and taxes,
- fixture for sell without buy / negative position,
- fixture for mixed currency,
- fixture for DP-05 transfer ambiguity,
- comparison report against current Global Asset output,
- explicit `provider_reference` versus `app_calculated` audit output,
- proof that calculation helpers do not trigger provider calls,
- `blockedMetrics` coverage for unsafe cases.

Audit output for DP-06 should be able to expose, without raw provider payloads or private portfolio data:

- calculation method, for example `weighted_average_remaining_cost_basis`,
- value classification,
- price-source category and freshness/staleness,
- fee/tax inclusion decision or ambiguity warning,
- blocked metric names and user-safe reasons,
- provider-reference comparison values when available and safely redacted.

Latest trade price must be labelled as estimated/stale fallback only. It must not be reported as current market price.
## DP-07 dividend, fee, tax and currency audit expectations

DP-07 dividend, fee, tax and currency handling is documentation-only here and does not implement read-model output, FX conversion, provider calls, product UI, performance/PnL calculation or tax-reporting policy.

Later audit/read-model output should be able to expose:

- `currency`
- `moneyFieldType`
- gross/net/source basis
- fee/tax category
- value classification
- per-currency totals
- `blockedMetrics`
- warning codes
- source/freshness/confidence
- `closedPositionIncome` flag

Converted or single-currency totals must be blocked when currency is mixed, missing or no FX policy exists. Affected blocked metrics include `total_dividend_net`, `total_dividend_gross`, `total_fees`, `total_taxes`, `income_total`, `performance`, return metrics and `dividend_yield`.

Dividend gross/net metrics must be blocked when amount basis is ambiguous. A labelled provider-reference dividend amount may remain visible as a provider reference, but must not be promoted into gross/net dividend totals.

Diagnostic output should not block per-currency subtotals, audit counts, activity lists, warning summaries or asset-level historical income when single-currency safe. Closed-position dividend income should remain visible with a `closedPositionIncome` flag or equivalent warning/context marker.

DP-07 warning categories for future audit/read-model output:

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

## Privacy rules

- Raw payloads are never returned.
- ISINs are included by default because they are central to the audit.
- Portfolio names are redacted by default.
- Portfolio IDs are pseudonymized by default.
- Holding IDs are redacted by default.
- Activity IDs are redacted by default.
- Sort keys are rebuilt so they do not leak source activity IDs by default.
- Amounts are redacted by default.
- Query parameters can opt into more detail for local debugging only.

## Quantity tolerance

The aggregation layer uses a small tolerance for status and warning decisions:

```ts
const QUANTITY_EPSILON = 0.000001;
```

This only removes floating-point artifacts near zero. It does not remove real fractional shares.

Examples:

```text
-8.326672684688674e-17 -> 0
0.30547858 remains 0.30547858
0.0005 remains 0.0005
```

## Parqet reauthorization note

Parqet Connect authorization can be scoped to the portfolios granted during the OAuth consent flow. If portfolios were added, renamed or appear to be missing, revoke the integration in Parqet and connect again through:

```text
http://localhost:3000/api/auth/start
```

Then select all current portfolios during consent.

## avgHoldingPeriod unit

Observed Parqet activity payloads can expose `avgHoldingPeriod` as a large millisecond value. The normalization layer stores `avgHoldingPeriodDays`, so obvious millisecond values are converted to days.

## Non-goals

P1-9 does not implement:

- product dashboard integration,
- product UI,
- existing route replacement,
- cost-basis calculation,
- market-value calculation,
- unrealized PnL calculation,
- transfer pairing,
- metadata enrichment,
- FX conversion,
- persistence API,
- broad reclassification,
- synthetic manual quantity adjustments,
- test framework setup.

## Next step

Use this report to inspect Global Asset output locally. Later Phase-1 work should add persistence/UI for decisions, refine transfer handling and decide when the isolated pipeline becomes productive.
