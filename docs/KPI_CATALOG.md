# KPI Catalog

Status: target semantics for the first 20 Core KPIs agreed in #402  
Linked issues: Refs #402, Refs #405

This catalog defines the intended KPI meaning before calculation implementation is finished.
It is a target contract, not a claim that every KPI is already correct in the app today.

## How to read this page

- `stable key` is the implementation-facing identifier.
- German labels stay user-facing; English labels stay documentation and technical-facing.
- `source category` means the intended primary source type:
  - `provider_reference`: comes directly from a provider reference value.
  - `app_calculated`: computed from normalized app data.
  - `derived`: derived from one or more other KPIs.
  - `configurable`: meaning or formula depends on a user-selectable variant.
  - `blocked`: intentionally not available until a missing prerequisite exists.
- `SecurityLineage behavior` means whether the KPI can safely survive future security replacements, migrations or mergers.
- `implementation target layer` names where the canonical KPI logic should live.

## Cross-cutting rules

- Current-position KPIs use an `as_of_end_date` interpretation: all history up to the selected end date contributes to the number.
- Period KPIs use an `in_period` interpretation: only activities inside the selected period contribute, unless an `inception` variant is selected.
- PRM is the target shared source for Dashboard, Asset Table, Asset Detail and Reports.
- UI code may choose and format KPIs, but must not own independent financial formulas.
- Mixed-currency scopes stay blocked until explicit FX handling exists.
- Market-value KPIs must prefer a current market price input where available. Falling back to `latestTradePrice` is a current risk, not the target rule.

## 1. Portfolio Value

- stable key: `portfolio_value`
- German label: `Portfoliowert`
- English label: `Portfolio Value`
- short description: Current market value of all active positions in the selected portfolio scope.
- business meaning: Answers "what are my selected holdings worth now?"
- default variant: `market_value_current`
- supported variants: `market_value_current`, `market_value_close_of_end_date`, `market_value_with_price_fallback_policy`
- formula target: Sum of active position values across all selected assets, where `position_value = net_shares * current_market_price`.
- primary inputs: `net_shares`, current market price per asset, asset status, selected portfolio scope.
- source category: `app_calculated`
- display format: `money`
- portfolio scope behavior: Sum active assets inside the selected portfolio set; closed assets contribute `0`.
- time range behavior: `as_of_end_date`; start date does not reset historical basis.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Report in one display currency; block or explicitly convert mixed currencies.
- confidence/freshness/blocker rules: Fresh market price required for `high`; stale price downgrades confidence; missing price blocks the asset unless an explicit fallback variant is chosen.
- UI relevance: `Dashboard Hero`, `Asset Table`, `Asset Detail`, `Reports`
- implementation target layer: `calculations`
- known current gaps: Current aggregation path uses `marketPrice: null` and may effectively fall back to `latestTradePrice` semantics instead of a required market-price input.

## 2. Position Value

- stable key: `position_value`
- German label: `Positionswert`
- English label: `Position Value`
- short description: Current market value of one asset position.
- business meaning: Answers "what is this specific holding worth now?"
- default variant: `market_value_current`
- supported variants: `market_value_current`, `market_value_close_of_end_date`, `market_value_with_price_fallback_policy`
- formula target: `net_shares * current_market_price`
- primary inputs: `net_shares`, current market price for the asset.
- source category: `app_calculated`
- display format: `money`
- portfolio scope behavior: For asset detail, sum only the selected asset across the selected portfolios.
- time range behavior: `as_of_end_date`.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Asset value stays in one valuation currency; mixed-currency composition blocks aggregation.
- confidence/freshness/blocker rules: Same price freshness rules as `portfolio_value`; no silent fallback in the target default.
- UI relevance: `Asset Table`, `Asset Detail`, `Reports`
- implementation target layer: `calculations`
- known current gaps: Current PRM path exposes market value, but the upstream aggregation does not yet require a market overlay before valuing the position.

## 3. Net Shares

- stable key: `net_shares`
- German label: `Stückzahl`
- English label: `Net Shares`
- short description: Net quantity still held after buys, sells and transfers.
- business meaning: Answers "how many units do I currently own?"
- default variant: `settled_quantity`
- supported variants: `settled_quantity`, `economic_quantity`
- formula target: `bought + deposits + transfer_in - sold - withdrawals - transfer_out`
- primary inputs: Normalized activity quantities and position-affecting overrides.
- source category: `app_calculated`
- display format: `quantity`
- portfolio scope behavior: Recompute from scoped activities for the selected asset or sum scoped asset quantities for portfolio views.
- time range behavior: `as_of_end_date`.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Not applicable to the numeric quantity itself.
- confidence/freshness/blocker rules: Negative quantity or unresolved transfer history downgrades confidence and can block derived KPIs.
- UI relevance: `Asset Table`, `Asset Detail`, `Reports`
- implementation target layer: `calculations`
- known current gaps: Negative quantity warnings exist, but cross-security continuity is not yet modeled.

## 4. Remaining Cost Basis

- stable key: `remaining_cost_basis`
- German label: `Verbleibende Kostenbasis / Einstand`
- English label: `Remaining Cost Basis`
- short description: Cost basis still attached to the currently open position.
- business meaning: Answers "how much acquisition cost is still tied to the units I still hold?"
- default variant: `moving_average_open_basis`
- supported variants: `moving_average_open_basis`, `tax_lot_open_basis`
- formula target: Prior remaining basis plus buy-like acquisition cost minus removed basis from sell-like events.
- primary inputs: Buy/deposit amounts, sell/withdrawal quantities, transfer handling, quantity history.
- source category: `app_calculated`
- display format: `money`
- portfolio scope behavior: Computed per scoped position, then aggregated for portfolio totals only when currency rules permit.
- time range behavior: `as_of_end_date`.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Basis requires a consistent valuation currency or explicit FX conversion.
- confidence/freshness/blocker rules: Missing acquisition amounts, unresolved transfers or mixed currencies block `high` confidence.
- UI relevance: `Asset Table`, `Asset Detail`, `Reports`
- implementation target layer: `calculations`
- known current gaps: Current implementation is moving-average oriented and does not yet document tax-lot alternatives or cross-security carry-forward rules.

## 5. Average Buy Price

- stable key: `average_buy_price`
- German label: `Durchschnittlicher Einstandskurs`
- English label: `Average Buy Price`
- short description: Average acquisition price of the remaining open position.
- business meaning: Answers "what is my average entry price for the units I still hold?"
- default variant: `moving_average_open_price`
- supported variants: `moving_average_open_price`, `tax_lot_weighted_open_price`
- formula target: `remaining_cost_basis / net_shares`
- primary inputs: `remaining_cost_basis`, `net_shares`.
- source category: `derived`
- display format: `money`
- portfolio scope behavior: Valid primarily per asset; portfolio-level display is not a hero KPI and should be avoided unless explicitly defined as weighted average.
- time range behavior: `as_of_end_date`.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Same as remaining cost basis.
- confidence/freshness/blocker rules: Block when `net_shares <= 0`; inherit confidence from cost-basis and quantity lineage.
- UI relevance: `Asset Table`, `Asset Detail`, `Reports`
- implementation target layer: `calculations`
- known current gaps: Current helper exists, but UI parity and variant metadata are not consistently surfaced from PRM.

## 6. Unrealized PnL

- stable key: `unrealized_pnl`
- German label: `Unrealisierter Gewinn-Verlust`
- English label: `Unrealized PnL`
- short description: Gain or loss on the still-open position.
- business meaning: Answers "how much would I gain or lose if I marked the open position to market now?"
- default variant: `net_of_open_basis`
- supported variants: `net_of_open_basis`, `gross_before_costs`
- formula target: `position_value - remaining_cost_basis`
- primary inputs: `position_value`, `remaining_cost_basis`.
- source category: `derived`
- display format: `money`
- portfolio scope behavior: Sum asset-level unrealized PnL across the selected scope.
- time range behavior: `as_of_end_date`.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Requires aligned valuation currency.
- confidence/freshness/blocker rules: Block when either value or cost basis is blocked; stale price reduces freshness.
- UI relevance: `Dashboard Hero`, `Asset Table`, `Asset Detail`, `Reports`
- implementation target layer: `calculations`
- known current gaps: PRM exposes unrealized PnL, but it inherits the current market-price fallback risk from `position_value`.

## 7. Unrealized Return %

- stable key: `unrealized_return_pct`
- German label: `Unrealisierte Rendite`
- English label: `Unrealized Return %`
- short description: Unrealized gain or loss relative to remaining cost basis.
- business meaning: Answers "how far up or down is my open position in percentage terms?"
- default variant: `pct_of_remaining_cost_basis`
- supported variants: `pct_of_remaining_cost_basis`, `pct_of_invested_capital`
- formula target: `unrealized_pnl / remaining_cost_basis`
- primary inputs: `unrealized_pnl`, `remaining_cost_basis`.
- source category: `configurable`
- display format: `percentage`
- portfolio scope behavior: Compute from summed scoped numerators and denominators, not from averaging row percentages.
- time range behavior: `as_of_end_date`.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Same as unrealized PnL.
- confidence/freshness/blocker rules: Block when denominator is `<= 0` or when unrealized PnL is blocked.
- UI relevance: `Dashboard Hero`, `Asset Table`, `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `calculations`
- known current gaps: Variant metadata is not yet exposed in PRM; denominator policy is not yet configurable.

## 8. Total Dividend Net

- stable key: `total_dividend_net`
- German label: `Netto-Dividenden gesamt`
- English label: `Total Dividend Net`
- short description: Sum of dividends after withholding and provider-reported taxes.
- business meaning: Answers "how much dividend cash actually reached the investor?"
- default variant: `lifetime_net`
- supported variants: `lifetime_net`, `period_net`, `by_portfolio_net`
- formula target: Sum `amountNet`, falling back to gross amount only when net is unavailable and the variant allows it.
- primary inputs: Normalized dividend activities, gross amount, net amount, selected period.
- source category: `app_calculated`
- display format: `money`
- portfolio scope behavior: Sum scoped dividend activities; closed assets may still contribute if the selected period includes their payouts.
- time range behavior: Default `inception`; `period_net` uses only dividends inside the selected period.
- SecurityLineage behavior: `supported`
- currency/FX assumptions: Block mixed currencies unless explicit FX conversion is enabled.
- confidence/freshness/blocker rules: Missing dividend currency or mixed currencies downgrades or blocks totals; provider net amount beats fallback gross.
- UI relevance: `Dashboard Hero`, `Asset Table`, `Asset Detail`, `Reports`
- implementation target layer: `aggregation`
- known current gaps: Current code sums net dividends, but mixed-currency handling blocks some totals and PRM does not yet expose gross/net lineage side by side.

## 9. Total Dividend Gross

- stable key: `total_dividend_gross`
- German label: `Brutto-Dividenden gesamt`
- English label: `Total Dividend Gross`
- short description: Sum of dividends before taxes or withholding.
- business meaning: Answers "how much income was generated before deductions?"
- default variant: `lifetime_gross`
- supported variants: `lifetime_gross`, `period_gross`, `gross_with_estimated_tax_gap_flag`
- formula target: Sum dividend gross amounts before taxes.
- primary inputs: Normalized dividend gross amounts, dividend currency, selected period.
- source category: `app_calculated`
- display format: `money`
- portfolio scope behavior: Sum scoped dividend activities regardless of current asset status.
- time range behavior: Default `inception`; period variant sums only in-range dividends.
- SecurityLineage behavior: `supported`
- currency/FX assumptions: Same mixed-currency rule as net dividends.
- confidence/freshness/blocker rules: Block or downgrade when only net values exist and gross cannot be reconstructed safely.
- UI relevance: `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `aggregation`
- known current gaps: Gross dividend totals are not exposed as a first-class PRM metric today.

## 10. Total Fees

- stable key: `total_fees`
- German label: `Gebühren gesamt`
- English label: `Total Fees`
- short description: Sum of provider-reported fees linked to selected activities.
- business meaning: Answers "how much did trading and booking costs reduce performance?"
- default variant: `lifetime_fees`
- supported variants: `lifetime_fees`, `period_fees`, `include_dividend_fees`
- formula target: Sum normalized fee amounts over the selected scope.
- primary inputs: Activity fee amounts, activity classification, selected period.
- source category: `app_calculated`
- display format: `money`
- portfolio scope behavior: Sum fees from all scoped activities, including closed positions if in range.
- time range behavior: Default `inception`; period variant uses in-range activities only.
- SecurityLineage behavior: `supported`
- currency/FX assumptions: Block mixed-currency totals unless converted explicitly.
- confidence/freshness/blocker rules: Missing fee currency or ambiguous activity mapping downgrades confidence.
- UI relevance: `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `aggregation`
- known current gaps: Current asset and breakdown PRM fields exist but are usually `null`; fee totals are not yet complete in the shared KPI surface.

## 11. Total Taxes

- stable key: `total_taxes`
- German label: `Steuern gesamt`
- English label: `Total Taxes`
- short description: Sum of provider-reported taxes linked to selected activities.
- business meaning: Answers "how much tax reduced cash received or net performance?"
- default variant: `lifetime_taxes`
- supported variants: `lifetime_taxes`, `period_taxes`, `include_withholding`
- formula target: Sum normalized tax amounts over the selected scope.
- primary inputs: Activity tax amounts, selected period.
- source category: `app_calculated`
- display format: `money`
- portfolio scope behavior: Sum taxes across all scoped activities.
- time range behavior: Default `inception`; period variant uses in-range activities only.
- SecurityLineage behavior: `supported`
- currency/FX assumptions: Same mixed-currency rule as fees.
- confidence/freshness/blocker rules: Downgrade when tax treatment is partial or when only net payout is known.
- UI relevance: `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `aggregation`
- known current gaps: Current PRM fields exist but tax totals are not yet complete in the shared KPI surface.

## 12. Total PnL

- stable key: `total_pnl`
- German label: `Gesamtgewinn-Verlust`
- English label: `Total PnL`
- short description: Combined lifetime or period profit and loss including realized, unrealized and income components according to the selected variant.
- business meaning: Answers "what is my total economic result?"
- default variant: `net_after_fees_taxes_including_income`
- supported variants: `net_after_fees_taxes_including_income`, `gross_before_fees_taxes`, `price_only`, `income_only`
- formula target: `realized_pnl + unrealized_pnl + total_dividend_net - total_fees - total_taxes` for the default variant.
- primary inputs: `realized_pnl`, `unrealized_pnl`, `total_dividend_net`, `total_fees`, `total_taxes`.
- source category: `configurable`
- display format: `money`
- portfolio scope behavior: Sum scoped component metrics in one reporting currency.
- time range behavior: Default `inception`; period variants include only in-range realized and income components while unrealized stays `as_of_end_date`.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Block mixed currencies unless explicit conversion exists.
- confidence/freshness/blocker rules: Block when any required component for the selected variant is blocked.
- UI relevance: `Dashboard Hero`, `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `calculations`
- known current gaps: Total PnL is not yet a shared first-class PRM metric and depends on incomplete realized, fee and tax coverage.

## 13. Total Return %

- stable key: `total_return_pct`
- German label: `Gesamtrendite`
- English label: `Total Return %`
- short description: Total PnL expressed relative to the selected invested-capital denominator.
- business meaning: Answers "what total return did I achieve, including open value and income?"
- default variant: `net_after_fees_taxes_including_income_pct`
- supported variants: `net_after_fees_taxes_including_income_pct`, `gross_pct`, `price_only_pct`, `income_only_pct`
- formula target: `total_pnl / invested_capital`
- primary inputs: `total_pnl`, `invested_capital`.
- source category: `configurable`
- display format: `percentage`
- portfolio scope behavior: Compute from summed scoped numerators and denominators.
- time range behavior: Same period semantics as `total_pnl`, with denominator defined by the selected invested-capital variant.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Same as total PnL.
- confidence/freshness/blocker rules: Block when denominator is missing, zero or blocked.
- UI relevance: `Dashboard Hero`, `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `calculations`
- known current gaps: Both numerator and denominator policies still need explicit PRM metadata and settings support.

## 14. Price Return %

- stable key: `price_return_pct`
- German label: `Kursrendite`
- English label: `Price Return %`
- short description: Return from price movement only, excluding dividend income.
- business meaning: Answers "how much of the return came from the price change itself?"
- default variant: `price_only_after_costs_pct`
- supported variants: `price_only_after_costs_pct`, `price_only_before_costs_pct`
- formula target: `(realized_pnl + unrealized_pnl - fee_adjustments - tax_adjustments_if_variant_requires) / invested_capital`
- primary inputs: `realized_pnl`, `unrealized_pnl`, variant-specific cost adjustments, `invested_capital`.
- source category: `configurable`
- display format: `percentage`
- portfolio scope behavior: Compute from scoped totals, not row-average percentages.
- time range behavior: Period-aware for realized components; unrealized piece remains `as_of_end_date`.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Same as total return.
- confidence/freshness/blocker rules: Block when price valuation or denominator is blocked.
- UI relevance: `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `calculations`
- known current gaps: Not yet represented as a dedicated PRM metric or settings-backed variant.

## 15. Income Return %

- stable key: `income_return_pct`
- German label: `Ertragsrendite`
- English label: `Income Return %`
- short description: Return contribution from dividend income only.
- business meaning: Answers "how much of the return came from income instead of price movement?"
- default variant: `dividend_net_pct`
- supported variants: `dividend_net_pct`, `dividend_gross_pct`
- formula target: `selected_dividend_total / invested_capital`
- primary inputs: `total_dividend_net` or `total_dividend_gross`, `invested_capital`.
- source category: `configurable`
- display format: `percentage`
- portfolio scope behavior: Compute from summed scoped income and denominator.
- time range behavior: Dividend component is period-aware; denominator follows the selected invested-capital variant.
- SecurityLineage behavior: `supported`
- currency/FX assumptions: Same mixed-currency rule as dividend totals.
- confidence/freshness/blocker rules: Block when dividend source or denominator is blocked.
- UI relevance: `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `calculations`
- known current gaps: Gross-income variant is not yet available and denominator policy is still undecided in code.

## 16. Invested Capital

- stable key: `invested_capital`
- German label: `Investiertes Kapital`
- English label: `Invested Capital`
- short description: Capital base used as the default denominator for return KPIs.
- business meaning: Answers "how much capital should the return be measured against?"
- default variant: `open_position_capital_base`
- supported variants: `open_position_capital_base`, `lifetime_committed_capital`, `average_invested_capital`
- formula target: Default target equals remaining capital still tied to the selected return scope; future variants may use lifetime or average capital definitions.
- primary inputs: `remaining_cost_basis`, realized capital removals, selected period, variant policy.
- source category: `configurable`
- display format: `money`
- portfolio scope behavior: Sum scoped capital bases using one reporting currency.
- time range behavior: Variant-dependent; default is `as_of_end_date`, while average-capital variants are period-aware.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Same as cost basis.
- confidence/freshness/blocker rules: Must expose the denominator variant clearly; block when basis lineage is incomplete.
- UI relevance: `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `calculations`
- known current gaps: The target denominator policy is not yet implemented or exposed consistently; default may equal remaining cost basis until richer variants arrive.

## 17. Realized PnL

- stable key: `realized_pnl`
- German label: `Realisierter Gewinn-Verlust`
- English label: `Realized PnL`
- short description: Profit or loss already locked in by sell-like events.
- business meaning: Answers "how much gain or loss has already been realized?"
- default variant: `gross_trade_realized`
- supported variants: `gross_trade_realized`, `net_after_fees_taxes_realized`
- formula target: `sale_proceeds - removed_cost_basis`, with optional fee/tax adjustments by variant.
- primary inputs: Sell-like activity proceeds, removed cost basis, variant-specific fee and tax adjustments.
- source category: `app_calculated`
- display format: `money`
- portfolio scope behavior: Sum realized results from scoped sell-like activities.
- time range behavior: Default `inception`; period variant uses only realized events inside the selected period.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Realized results require consistent currency or explicit FX conversion.
- confidence/freshness/blocker rules: Block when proceeds or removed basis cannot be reconstructed safely.
- UI relevance: `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `calculations`
- known current gaps: Normalization reads realized gain fields, but realized PnL is not yet a complete shared KPI across PRM surfaces.

## 18. Realized Return %

- stable key: `realized_return_pct`
- German label: `Realisierte Rendite`
- English label: `Realized Return %`
- short description: Realized PnL relative to the capital removed by realized exits.
- business meaning: Answers "what percentage return has already been locked in?"
- default variant: `pct_of_removed_cost_basis`
- supported variants: `pct_of_removed_cost_basis`, `net_pct_after_fees_taxes`
- formula target: `realized_pnl / realized_cost_basis_removed`
- primary inputs: `realized_pnl`, removed cost basis from sell-like events.
- source category: `configurable`
- display format: `percentage`
- portfolio scope behavior: Compute from scoped realized totals and realized basis totals.
- time range behavior: `in_period` or `inception` depending on selected variant.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Same as realized PnL.
- confidence/freshness/blocker rules: Block when realized-basis denominator is missing or zero.
- UI relevance: `Asset Detail`, `Reports`, `Settings-configurable`
- implementation target layer: `calculations`
- known current gaps: Realized denominator tracking is not yet exposed as a shared PRM metric.

## 19. Cashflow Net

- stable key: `cashflow_net`
- German label: `Netto-Cashflow`
- English label: `Cashflow Net`
- short description: Net cash movement between investor and selected holdings.
- business meaning: Answers "did this scope consume cash or return cash to the investor?"
- default variant: `investor_cash_delta`
- supported variants: `investor_cash_delta`, `capital_contribution_sign_reversed`
- formula target: `sell_proceeds + dividends_net - buys - deposits - fees - taxes - withdrawals_if_variant_requires_sign_normalization`
- primary inputs: Buy, sell, dividend, fee, tax, deposit and withdrawal cash amounts.
- source category: `configurable`
- display format: `money`
- portfolio scope behavior: Sum scoped external cash movements; transfers between selected portfolios net to zero if both sides are in scope.
- time range behavior: Strongly period-aware; default view should respect the selected period.
- SecurityLineage behavior: `supported`
- currency/FX assumptions: Mixed-currency cashflows require explicit FX conversion or stay blocked.
- confidence/freshness/blocker rules: Sign convention must be shown clearly; unresolved transfer pairing downgrades confidence.
- UI relevance: `Reports`, `Settings-configurable`
- implementation target layer: `aggregation`
- known current gaps: No shared PRM cashflow KPI exists yet and sign-convention metadata is not surfaced.

## 20. Asset Count

- stable key: `asset_count`
- German label: `Anzahl Assets`
- English label: `Asset Count`
- short description: Number of distinct assets represented in the selected scope.
- business meaning: Answers "how many holdings are included in this view?"
- default variant: `active_assets_only`
- supported variants: `active_assets_only`, `all_assets_with_history`, `closed_assets_only`
- formula target: Count distinct asset identities matching the selected status rule.
- primary inputs: Aggregated asset identity, scoped asset status, selected scope.
- source category: `derived`
- display format: `count`
- portfolio scope behavior: Count distinct assets after portfolio filtering; do not double-count the same asset across selected portfolios.
- time range behavior: Default `as_of_end_date`; history variant counts assets with any activity in range.
- SecurityLineage behavior: `gated`
- currency/FX assumptions: Not applicable.
- confidence/freshness/blocker rules: Unresolved asset identity collisions or future security replacements can change the count and should lower confidence.
- UI relevance: `Dashboard Hero`, `Reports`, `Settings-configurable`
- implementation target layer: `PRM`
- known current gaps: PRM summary already counts assets, but the target status variants and SecurityLineage-aware counting rules are not yet documented in code.
