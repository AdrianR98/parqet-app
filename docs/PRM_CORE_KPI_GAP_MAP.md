# PRM Core KPI Gap Map

Status: Slice 1 gap map for Core KPI convergence  
Linked issues: Refs #402, Refs #395, Refs #398, Refs #397, Refs #396, Refs #405

## Executive summary

- This document maps the current implementation gaps for the 20 Core KPIs defined in `docs/KPI_CATALOG.md`.
- The current app already has reusable building blocks for quantity, moving-average cost basis, valuation rollups and PRM projection, but the valuation path still uses `latestTradePrice` fallback semantics where the target contract requires an explicit current market-price overlay.
- The highest-risk drift is concentrated in the valuation chain: `position_value` -> `unrealized_pnl` -> `portfolio_value`, plus the Hero `Investiert` card needing explicit open-position-capital semantics instead of a UI-local inference.
- Dashboard must **not** be reverted to the old runtime/cache asset path as the long-term fix. Runtime/cache data can remain comparison or guarded fallback input only.
- PRM is the forward shared KPI source for Dashboard, Asset Table, Asset Detail and Reports.

## Status legend

- `implemented`: current source broadly matches the target KPI contract.
- `partial`: some usable implementation exists, but source coverage, metadata, variants or UI convergence are incomplete.
- `wrong_source`: a KPI is surfaced today, but the current source path or formula does not match the target contract.
- `missing`: no shared KPI implementation/surface exists yet.
- `blocked`: target KPI intentionally depends on a prerequisite that is not available yet.

## Highest-risk gaps

1. `position_value`, `unrealized_pnl` and `portfolio_value` currently inherit `marketPrice ?? latestTradePrice` behavior from `src/lib/calculations/global-asset-metrics.ts`, while aggregation passes `marketPrice: null`.
2. `invested_capital` still depends on moving-average open-basis semantics and does not yet carry variant/settings metadata beyond the documented default.
3. Cost-basis lineage for transfer-like events remains moving-average-only and is still exposed without explicit variant metadata.
4. PRM already carries money metrics plus warnings/blockers, but it still does not expose the full KPI surface or valuation source/freshness metadata needed for trustworthy convergence.
5. Reports inherit the same KPI drift as Dashboard/Asset Table when they read projected PRM values that still originate from the incomplete valuation path.

## Proposed implementation order inside this PR

1. Keep this gap map as the implementation checklist for the branch.
2. Implement `#395` market-price overlay in aggregation/PRM.
3. Converge Dashboard, Asset Table, Asset Detail and Reports onto the same PRM KPI path for the core valuation metrics.
4. Clarify `invested_capital` and `remaining_cost_basis`, including explicit denominator/variant behavior.
5. Preserve forward PRM lineage and explicit fallback metadata while leaving later settings/transfer semantics for follow-up slices.

## KPI map

| KPI | Stable key | Target meaning summary | Current code source/path if found | Status | Current UI surfaces using it | Target owner | Gap description | Required implementation action | Dependency issue | Recommended slice |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Portfolio Value | `portfolio_value` | Current market value of all active positions in scope. | `src/lib/calculations/global-asset-metrics.ts`; `src/lib/parqet/global-assets/aggregate.ts`; `src/lib/calculations/view-model-aggregates.ts`; `src/app/(app)/dashboard/page.tsx`; `src/lib/reporting.ts` | `implemented` | Dashboard Hero, Reports | `calculations` | Hero/report totals now derive from the same PRM-backed scoped asset rows as the visible table/report rows, but fallback explanation is still metadata-only. | Keep PRM totals canonical and add richer source/freshness explanation later without restoring the runtime cache path as a preferred source. | `#395`, `#398`, `#397` | Slice 3 valuation KPIs |
| Position Value | `position_value` | Current market value of one scoped asset position. | `src/lib/calculations/global-asset-metrics.ts`; `src/lib/parqet/global-assets/aggregate.ts`; `src/lib/view-models/global-asset-view-model-builder.ts`; `src/lib/asset-detail.ts` | `implemented` | Asset Table, Asset Detail, Reports | `calculations` | Dashboard table rows, scoped asset detail metrics and reports now read the same PRM-backed valuation field, with runtime values kept only as explicit fallback when PRM is unavailable. | Keep one canonical PRM metric and expose richer fallback/staleness explanation later through #398. | `#395`, `#398`, `#397` | Slice 3 valuation KPIs |
| Net Shares | `net_shares` | Net quantity still held after buys, sells and transfers. | `src/lib/calculations/global-asset-metrics.ts`; `src/lib/parqet/global-assets/aggregate.ts`; `src/lib/calculations/view-model-aggregates.ts`; `src/lib/asset-detail.ts` | `partial` | Asset Table, Asset Detail, Reports | `calculations` | Quantity math exists and is shared, but transfer-like continuity and future cross-security lineage are still incomplete and only guarded by warnings. | Keep calculations as owner, document/retain blocked-warning behavior, and validate transfer semantics before treating the KPI as fully trusted. | `#396` | Slice 4 invested/cost-basis |
| Remaining Cost Basis | `remaining_cost_basis` | Cost basis still attached to the open position. | `src/lib/calculations/global-asset-metrics.ts`; `src/lib/parqet/global-assets/aggregate.ts`; `src/lib/calculations/view-model-aggregates.ts`; `src/lib/asset-detail.ts`; `src/components/dashboard/asset-table-columns.tsx` | `partial` | Asset Table, Asset Detail | `calculations` | Moving-average basis is present, but transfer/deposit/withdrawal semantics, mixed-currency behavior and explicit variant metadata are incomplete. | Define the selected basis policy explicitly, preserve blocked/preliminary behavior where lineage is incomplete, and surface the chosen variant through PRM. | `#396`, `#397` | Slice 4 invested/cost-basis |
| Average Buy Price | `average_buy_price` | Average acquisition price of the remaining open position. | `src/lib/calculations/global-asset-metrics.ts`; `src/lib/view-models/global-asset-view-model-builder.ts`; `src/lib/calculations/view-model-aggregates.ts`; `src/lib/asset-detail.ts` | `partial` | none found | `calculations` | The helper exists, but it is not a first-class PRM KPI and is not currently converged across surfaces with variant metadata. | Promote it to an explicit PRM-backed KPI only after cost-basis semantics are fixed and variant metadata is available. | `#396`, `#397`, `#405` | Slice 4 invested/cost-basis |
| Unrealized PnL | `unrealized_pnl` | Gain/loss on the still-open position. | `src/lib/calculations/global-asset-metrics.ts`; `src/lib/parqet/global-assets/aggregate.ts`; `src/lib/view-models/global-asset-view-model-builder.ts`; `src/components/dashboard/HeroSection.tsx`; `src/lib/reporting.ts` | `implemented` | Dashboard Hero, Asset Table, Asset Detail, Reports | `calculations` | Shared surfaces now reuse the same PRM-backed unrealized PnL field, while fallback/staleness explanation remains metadata-only for now. | Keep the PRM KPI canonical and layer source/freshness UX later through #398. | `#395`, `#398`, `#397`, `#396` | Slice 3 valuation KPIs |
| Unrealized Return % | `unrealized_return_pct` | Unrealized gain/loss relative to the chosen open-position denominator. | no shared code path found | `missing` | none found | `calculations` | No shared KPI field, denominator metadata or UI surface currently exists. | Add it only after valuation and invested-capital semantics are explicit, then expose the selected denominator variant through PRM for future settings/UI work. | `#395`, `#397`, `#396`, `#405` | Later |
| Total Dividend Net | `total_dividend_net` | Net dividends received after taxes/withholding. | `src/lib/calculations/global-asset-metrics.ts`; `src/lib/parqet/global-assets/aggregate.ts`; `src/lib/parqet/global-assets/product-read-model.ts`; `src/components/dashboard/HeroSection.tsx`; `src/lib/reporting.ts` | `partial` | Dashboard Hero, Asset Table, Asset Detail, Reports | `aggregation` | Net dividend totals are implemented, but mixed-currency cases block totals, gross/net lineage is incomplete, and shared PRM metadata is still thin for downstream explanation. | Keep aggregation as owner, preserve explicit mixed-currency blocking, and converge all consumers on the PRM field plus source/confidence metadata. | `#397`, `#398`, `#405` | Slice 5 UI convergence |
| Total Dividend Gross | `total_dividend_gross` | Gross dividends before taxes/withholding. | no shared code path found | `missing` | none found | `aggregation` | Gross dividend totals are documented as target semantics but are not exposed as a first-class PRM metric. | Add a shared aggregation/PRM gross-dividend metric only after gross/net lineage and currency handling are explicit. | `#397`, `#405` | Later |
| Total Fees | `total_fees` | Total provider-reported fees in scope. | `src/lib/parqet/global-assets/aggregate.ts`; `src/lib/parqet/global-assets/product-read-model.ts` | `partial` | none found | `aggregation` | Asset-level fee totals exist in aggregation/PRM, but portfolio-breakdown coverage is incomplete and no current surface reads the KPI. | Complete aggregation coverage, add PRM metadata, then let downstream surfaces opt in later instead of inventing local sums. | `#397`, `#405` | Later |
| Total Taxes | `total_taxes` | Total provider-reported taxes in scope. | `src/lib/parqet/global-assets/aggregate.ts`; `src/lib/parqet/global-assets/product-read-model.ts` | `partial` | none found | `aggregation` | Asset-level tax totals exist in aggregation/PRM, but coverage is incomplete and no shared UI surface currently consumes them. | Complete tax aggregation coverage, retain blocked/preliminary states for partial data, then expose via PRM for later surfaces/settings. | `#397`, `#405` | Later |
| Total PnL | `total_pnl` | Combined economic result including realized, unrealized and income components. | no shared code path found | `missing` | none found | `calculations` | The KPI is documented but not implemented as a shared PRM metric, and several prerequisite component KPIs are incomplete. | Wait until realized PnL, fee, tax, dividend and valuation semantics are explicit, then compute one configurable KPI in calculations and expose it via PRM. | `#395`, `#397`, `#396`, `#405` | Later |
| Total Return % | `total_return_pct` | Total PnL relative to the selected invested-capital denominator. | no shared code path found | `missing` | none found | `calculations` | Neither the numerator nor denominator policy is implemented as a shared configurable KPI. | Implement only after `total_pnl` and `invested_capital` are canonicalized and variant metadata can travel through PRM. | `#395`, `#397`, `#396`, `#405` | Later |
| Price Return % | `price_return_pct` | Return from price movement only, excluding income. | no shared code path found | `missing` | none found | `calculations` | The KPI is target-only today and has no dedicated PRM representation or surface. | Defer until realized/unrealized components and denominator policy are available as shared calculation outputs. | `#395`, `#397`, `#396`, `#405` | Later |
| Income Return % | `income_return_pct` | Return contribution from dividends only. | no shared code path found | `missing` | none found | `calculations` | No shared numerator/denominator implementation exists, and gross-income support is also missing. | Add after dividend gross/net lineage and invested-capital denominator policy are explicit. | `#397`, `#405` | Later |
| Invested Capital | `invested_capital` | Capital base used as the denominator for return KPIs. | `src/app/(app)/dashboard/page.tsx`; `src/lib/types.ts`; `src/lib/view-models/global-asset-view-model-builder.ts` | `partial` | Dashboard Hero | `calculations` | Hero `Investiert` now explicitly uses scoped open-position `remaining_cost_basis`, but variant/settings support and unresolved transfer semantics are still not modeled as a first-class PRM KPI. | Keep the current default variant explicit, then add configurable variant metadata later through #396/#405. | `#396`, `#397`, `#405` | Slice 4 invested/cost-basis |
| Realized PnL | `realized_pnl` | Profit/loss already locked in by sell-like events. | normalization hints only; no shared KPI output found | `missing` | none found | `calculations` | The catalog and issues assume this KPI, but the current PRM/view-model/report surfaces do not expose a shared realized PnL metric. | Implement a canonical realized PnL calculation with explicit basis-removal semantics before surfacing it through PRM. | `#396`, `#397`, `#405` | Later |
| Realized Return % | `realized_return_pct` | Realized PnL relative to removed realized basis. | no shared code path found | `missing` | none found | `calculations` | Realized denominator tracking is not implemented or surfaced. | Add only after realized PnL and realized removed-basis tracking exist as shared calculations. | `#396`, `#397`, `#405` | Later |
| Cashflow Net | `cashflow_net` | Net investor cash movement for the selected scope. | no shared PRM KPI found | `missing` | none found | `aggregation` | No shared KPI currently exposes cashflow sign-convention semantics, transfer netting or period-aware cash movement. | Add as an aggregation-owned scoped KPI after transfer semantics and sign-convention metadata are explicitly defined. | `#396`, `#397`, `#405` | Later |
| Asset Count | `asset_count` | Distinct asset count for the selected scope and status rule. | `src/lib/parqet/global-assets/product-read-model.ts`; `src/hooks/use-dashboard-data.ts`; `src/components/dashboard/StatsGrid.tsx`; `src/lib/reporting.ts` | `partial` | Reports | `PRM` | Counts exist in PRM summary and cache-driven dashboard/report paths, but variants such as active-only vs history-inclusive are not formalized and current dashboard cards do not read a dedicated PRM KPI contract. | Keep PRM as owner, formalize the variant/status rule, and align downstream screens on the same PRM count semantics. | `#405` | Slice 5 UI convergence |

## KPI status counts

- `implemented`: 3
- `partial`: 9
- `wrong_source`: 0
- `missing`: 8
- `blocked`: 0

## Notes to preserve during implementation

- Dashboard must not be reverted to the old runtime/cache path as the long-term fix.
- Runtime/cache calculations may remain fallback, comparison or validation inputs, but not a permanent competing KPI truth path.
- PRM remains the forward shared KPI source, and view-model/UI layers should only select, shape and explain KPIs rather than owning financial formulas.

## Extended KPI implementation phases

Status: the same branch, `feat/prm-core-kpi-convergence`, continues KPI work beyond the first 20 Core KPIs.
Important: Currency/FX remains deferred to [#397](https://github.com/AdrianR98/parqet-app/issues/397); settings remain deferred to [#405](https://github.com/AdrianR98/parqet-app/issues/405).

Technical foundation status:

- PRM/API-ready metric objects now exist for the ready-now extended KPI slice without changing Dashboard or Asset Detail UI.
- `gross_buy_volume`, `gross_sell_volume`, `portfolio_weight`, `top_5_concentration`, `top_10_concentration`, `herfindahl_index` and `allocation_by_asset_type` should still be treated as `partial` whenever mixed-currency scope prevents an unconverted final value.
- `dividend_count`, `last_dividend_date`, `data_confidence_score`, `market_price_freshness`, `metadata_completeness_score` and `warning_count` now have technical PRM foundations and remain UI-unexposed until a later surface pass.
- Current PRM summary metrics are snapshot-scope metrics; later UI local rescoping must recompute/rescope them instead of reusing snapshot-wide summary values after a local portfolio-selection change.

### Next ready implementation tranche

These candidates are documented as `ready_now` in `docs/KPI_CATALOG.md` and can be implemented without new provider calls, DB schema changes or FX conversion:

- `dividend_count`
- `last_dividend_date`
- `gross_buy_volume`
- `gross_sell_volume`
- `buy_count`
- `sell_count`
- `portfolio_weight`
- `allocation_by_asset_type`
- `top_5_concentration`
- `top_10_concentration`
- `herfindahl_index`
- `data_confidence_score`
- `market_price_freshness`
- `metadata_completeness_score`
- `warning_count`

### History-price tranche

These candidates should wait for an explicit history-price implementation pass and stable return-series semantics:

- `volatility_30d`
- `volatility_1y`
- `max_drawdown`
- `best_day`
- `worst_day`
- `sharpe_ratio`

### Dividend-income tranche

These candidates depend primarily on stronger dividend-event modeling, payout-history semantics or annualization policy:

- `dividend_yield_on_cost`
- `current_dividend_yield`
- `annualized_dividend_income`
- `dividend_growth_1y`
- `dividend_growth_3y`
- `payout_frequency`

### FX-gated tranche

These candidates are materially sensitive to mixed-currency scopes or reporting-currency policy and should remain deferred until [#397](https://github.com/AdrianR98/parqet-app/issues/397):

- `dividend_yield_on_cost`
- `current_dividend_yield`
- `annualized_dividend_income`
- `dividend_growth_1y`
- `dividend_growth_3y`
- `fees_ratio`
- `tax_ratio`
- `net_cashflow_invested`
- `gross_buy_volume`
- `gross_sell_volume`
- `average_order_size`
- `portfolio_weight`
- `allocation_by_asset_type`
- `allocation_by_country`
- `allocation_by_sector`
- `top_5_concentration`
- `top_10_concentration`
- `herfindahl_index`
- `volatility_30d`
- `volatility_1y`
- `max_drawdown`
- `best_day`
- `worst_day`
- `sharpe_ratio`

### SecurityLineage-gated tranche

These candidates should not claim fully durable cross-security continuity until later SecurityLineage work exists:

- `dividend_yield_on_cost`
- `current_dividend_yield`
- `annualized_dividend_income`
- `dividend_growth_1y`
- `dividend_growth_3y`
- `portfolio_weight`
- `top_5_concentration`
- `top_10_concentration`
- `herfindahl_index`
- `volatility_30d`
- `volatility_1y`
- `max_drawdown`
- `best_day`
- `worst_day`
- `sharpe_ratio`

### Later / nice-to-have tranche

These candidates are worth documenting now but should stay behind more foundational slices:

- `fees_ratio`
- `tax_ratio`
- `average_order_size`
- `allocation_by_country`
- `allocation_by_sector`
- `payout_frequency`

## Extended KPI tranche notes

- The branch continues one-branch KPI convergence work; no new branch/PR split is intended for the catalog itself.
- `ready_now` here means source data and current architecture look sufficient for a future implementation slice, not that UI/settings behavior is already available.
- `blocked_until_fx` means the KPI may be meaningful conceptually, but should not be presented as financially final until the FX boundary and blocked/preliminary policy from [#397](https://github.com/AdrianR98/parqet-app/issues/397) are implemented.
- `configurable_later` means the KPI or its variants should be catalog-backed first and surfaced in the future settings model from [#405](https://github.com/AdrianR98/parqet-app/issues/405), not hard-coded ad hoc in UI components.
