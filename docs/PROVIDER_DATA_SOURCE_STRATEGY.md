# Provider Data Source Strategy

Status: DP-02 locked strategy for #248 / #251

Scope: provider source selection, snapshots/read models, local metadata and provider reference values

## Purpose

This document defines which data source category should answer each product question before the Global Asset pipeline feeds or replaces product routes/read models.

It is documentation-only. It does not authorize runtime behavior changes, new provider endpoints, new scopes, route migration, durable storage, UI changes or new calculation logic.

## Decision Summary

Use the narrowest source that can answer the question safely:

- Current holdings/current-state source for current quantity, position/current market value and allocation.
- Activity-history source for timelines, event history, audit trails, transfer review and future cost-basis inputs.
- Snapshot/read-model source for repeated local reads after an explicit successful load.
- Local metadata source for display identity only.
- Provider-reference source for Parqet-computed or Parqet-supplied performance/financial values.
- Blocked/unknown state when the available source cannot answer without misleading precision.

Provider DTOs must stay at the fetch/normalization boundary. Product UI, report exports and browser-local read models must receive app-owned projections/read models, not raw provider responses.

After a successful explicit load, local navigation, filtering, sorting, detail views and report actions must stay snapshot/read-model-backed. They must not trigger hidden provider refreshes.

## Evidence Reviewed

Repository evidence:

- `docs/PIPELINE_INVENTORY.md` classifies current routes/helpers and identifies hidden provider-call risks.
- `docs/adr/0002-global-asset-timeline.md` defines activity history as the Global Asset Timeline foundation and labels Parqet reference fields as reference-only.
- `docs/adr/0005-v1-snapshot-cache.md` defines bounded process-local server snapshots and browser-local read models as the v1 reuse boundary.
- `docs/V1_GUARDRAILS.md` already requires provider/internal/UI model separation, narrow source selection and source/freshness/confidence disclosure.
- `docs/PARQET_API_AUDIT.md` records privacy-safe runtime audit evidence for portfolios and activities. Holdings/assets were not audited in the first runtime audit.
- Tracked code shows current `src/app/api/parqet/assets/route.ts` is snapshot-first for activity-backed asset summaries, while `src/app/api/parqet/activities/route.ts` and `src/app/api/parqet/assets/audit/route.ts` remain provider-backed/deprecated-candidate risks.
- Tracked Global Asset aggregation docs/code currently leave market value, cost basis and unrealized PnL null and mark transfer/FX/metadata integration as unresolved.

Public Parqet OpenAPI evidence checked on 2026-05-13:

- `https://developer.parqet.com/api-spec/current.json` was accessible.
- Verified structural paths: `/user`, `/portfolios`, `/portfolios/{portfolioId}/activities`, `/portfolios/{portfolioId}/holdings`, `/performance`, and write-only holding/quote creation paths.
- Verified `/portfolios/{portfolioId}/activities` supports pagination and filters for `activityType`, `assetType` and `holdingId`.
- Verified activity types include `buy`, `sell`, `dividend`, `interest`, `transfer_in`, `transfer_out`, `fees_taxes`, `deposit` and `withdrawal`.
- Verified `/portfolios/{portfolioId}/holdings` returns holdings with `id`, `activityCount`, `logo`, `nickname`, `asset` and `externalId`, and performance response shapes include holding-level `position`, `performance`, `valuation`, `netAllocations` and chart values.
- Verified `/performance` accepts one to 25 portfolio IDs and interval selection.

OpenAPI was reviewed structurally only. No private provider payloads, tokens, cookies, OAuth codes, `.env*` files, ignored local paths or real portfolio/activity values were inspected.

## Source Categories

### Current Holdings / Current-State

Use this category when the product question is about current provider state:

- current quantity,
- current market value,
- current position value,
- allocation,
- current holdings list,
- provider-known asset/holding identity,
- current-state diagnostics.

Intended provider evidence is `/portfolios/{portfolioId}/holdings` for holding identity/current position shape and `/performance` when current state is available only with provider analytics/performance context. Before product use, a route-specific issue must verify exact response fields, request scope, pagination/limits, freshness semantics and whether current values are provider-computed references or app-owned inputs.

Do not replay all historical activities just to answer a current-state question when a current holdings/snapshot source is available and safe.

### Activity History

Use this category when the product question depends on ordered events:

- activity timeline,
- buy/sell/dividend/fee/tax history,
- transfer review,
- audit trail,
- future cost-basis inputs,
- future average-price inputs,
- future realized-PnL inputs,
- explanation of how a metric was derived.

Activity history must enter the app through provider fetch helpers, portfolio-context enrichment and normalization before aggregation or UI projection. Provider activity DTOs must not pass directly into product UI/read models.

The public OpenAPI confirms activity pagination and filters, so later implementation should use provider-side filters and bounded concurrency where possible. Response-size filtering must not be described as provider-call reduction unless it actually reduces upstream requests.

### Snapshot / Read Model

Use this category for repeated local reads after successful explicit load:

- route navigation,
- local filtering,
- local sorting,
- local search,
- detail page open,
- report preview/export,
- diagnostics over the last loaded state,
- local chart range/mode changes over already-loaded points.

Snapshot/read-model data is the default for normal in-app reuse. Missing, empty-scope, stale or scope-mismatch states must be explicit local states. They must not silently trigger a full provider fetch.

Expected behavior:

- missing snapshot: show a clear no-data/no-snapshot message and an explicit refresh/load action where appropriate,
- empty loaded scope: show an empty state tied to the selected scope,
- stale snapshot: show stale freshness and let the user explicitly refresh,
- scope mismatch: explain selected scope versus loaded scope and avoid hidden reload,
- refresh failure: preserve safe stale/local state when possible and show the redacted failure category.

### Local Metadata

Use this category only for display identity:

- display name,
- symbol/ticker,
- WKN,
- subtitle,
- logo identity fallback,
- local display diagnostics.

Local metadata must not change calculations, quantities, cost basis, dividends, fees, taxes, performance, warnings, confidence or blocked metrics. It must not trigger Parqet, asset-search, identifier-mapping, market-data or external metadata calls in v1.

### Provider Reference Values

Provider-computed or provider-supplied values are provider references unless a later ADR/issue explicitly promotes them into an app-owned metric.

Provider references include, at minimum:

- Parqet activity reference fields such as `realizedGains`, `realizedGainsNet`, `buyAmountNet` and `avgHoldingPeriodDays`,
- performance response values such as provider performance, realized/unrealized gains, dividends, fees, taxes, valuation, allocation and chart values,
- current holding position fields when treated as provider current-state output.

Provider references may be useful for comparison, diagnostics, reconciliation and source-labelled UI. They must not be silently mixed with app-calculated metrics in the same number.

### Blocked / Unknown / Not Yet Supported

Use blocked/unknown state when a metric would require assumptions not yet decided or not supported by current evidence:

- cost basis,
- average price,
- realized PnL,
- unrealized PnL,
- transfer pairing,
- mixed-currency/FX conversion,
- tax treatment beyond provider/activity fields,
- dividend gross/net rules beyond available source fields,
- current values when no current-state source or snapshot exists,
- reports that would combine provider references and app calculations without source labels.

Blocked metrics must carry enough context for future UI/read-model work: `source`, `freshness`, `confidence`, `warnings` and `blockedMetrics`.

## Product Question Mapping

| Product question | Intended source category | Strategy |
| --- | --- | --- |
| Current quantity | Current holdings/current-state first; snapshot/read model after explicit load | Use provider current-state or a loaded current-state snapshot. Do not derive solely from full history unless the route explicitly needs a history-based reconciliation view. |
| Current market value | Current holdings/current-state or provider reference | Treat provider-supplied current value as provider reference/current-state. App-calculated market value remains blocked until price/FX ownership is decided. |
| Allocation | Current holdings/current-state or provider reference | Prefer current holdings/performance allocation or loaded allocation read model. Label freshness and provider/reference source. |
| Provider performance references | Provider reference | Use `/performance`-like provider output only as labelled provider reference unless later promoted by ADR. |
| Activity timeline | Activity history, then snapshot/read model | Normalize activities and project timeline entries from loaded activity history. Local timeline interactions use the snapshot/read model. |
| Buy/sell/dividend/fee/tax history | Activity history | Use normalized activity history with source/freshness/warnings. |
| Transfers | Activity history | Preserve `transfer_in` and `transfer_out`; use deposits/withdrawals conservatively. Pairing remains blocked until a transfer decision is implemented. |
| Cost basis | Blocked/unknown; future activity-history calculation input | Activity history supplies inputs, but app-owned cost basis is not durable until method, fees, transfers and FX are decided. |
| Average price | Blocked/unknown; future activity-history or provider-reference comparison | Do not present as app-owned without a calculation decision. Provider values may be comparison references only. |
| Realized PnL | Blocked/unknown or provider reference | Parqet-supplied realized gains are provider references. App-owned realized PnL needs cost-basis and sale treatment decisions. |
| Unrealized PnL | Blocked/unknown or provider reference/current-state | Provider-supplied unrealized/performance values are references. App-owned unrealized PnL needs current price, cost basis and FX decisions. |
| Dividends | Activity history for event totals; provider reference for performance summaries | Activity fields can support conservative loaded-history totals when currency is consistent. Provider performance dividends remain references. |
| Fees | Activity history for event totals; provider reference for performance summaries | Preserve fee fields. Block or lower confidence when currency/source fields are missing. |
| Taxes | Activity history for event totals; provider reference for performance summaries | Preserve tax fields. Do not infer tax semantics beyond available source fields. |
| Currency / FX | Blocked/unknown unless source currency is enough | Preserve activity/portfolio currencies. No external FX conversion or display-currency calculation is approved here. Mixed currency blocks affected metrics. |
| Metadata display | Local metadata plus loaded provider/read-model identity | Local metadata can improve labels only. It must not alter calculations or trigger metadata calls. |
| Reports | Snapshot/read model and labelled provider references/app calculations | Reports must be reproducible from the chosen snapshot/read model and include source/freshness/caveats. Opening/exporting a report must not fetch provider data. |
| Diagnostics/audit | Snapshot/read model by default; provider-backed only by explicit guarded audit refresh | Diagnostics should prefer counts, scopes, freshness, warnings and redacted categories. Raw payloads and private values remain forbidden. |

## Endpoint Assumptions And Unknowns

Durable assumptions from public OpenAPI structure:

- Portfolio list is available through `/portfolios` with portfolio metadata.
- Activity history is available per portfolio through `/portfolios/{portfolioId}/activities`.
- Activity retrieval supports pagination and filters that later implementations should use where safe.
- Holdings/current-state structure is available through `/portfolios/{portfolioId}/holdings`.
- Performance/provider analytics structure is available through `/performance`.
- OAuth scopes shown by the OpenAPI are `portfolio:read` and `portfolio:write`; this strategy does not authorize new scopes.

Unknowns that require runtime audit or route-specific implementation evidence before endpoint assumptions become product-durable:

- Exact freshness semantics for holdings, positions, quotes and performance values.
- Whether holdings response fields are sufficient for all current quantity/current value/allocation needs across supported asset types.
- Whether `/performance` values should be requested per selected scope, full authorized scope or narrower asset/holding scope.
- Pagination or size limits beyond the published activity limit and performance portfolio limit.
- Rate-limit behavior and retry-after details for holdings/performance endpoints.
- Whether current holdings and performance values are consistently available for securities, cash, crypto, commodities, custom assets and real estate.
- How provider values behave for missing quotes, stale quotes, closed holdings, deleted holdings, negative cash, transfers and mixed currencies.
- Whether any endpoint returns fields that look current-state-like but are provider-computed performance references and must be labelled accordingly.

## API Budget Expectations For Later Implementation

Every later implementation issue that touches provider data must state:

- provider endpoint and request count/scope,
- selected portfolio, holding, asset, date or activity filters,
- pagination behavior and bounded concurrency,
- cache/snapshot reuse path,
- explicit user action that may trigger provider work,
- hidden reload risk and how it is prevented,
- retry classification,
- rate-limit behavior,
- token-refresh behavior for likely auth failures only,
- response-size reduction versus provider-call reduction,
- diagnostics that report scope/count/failure category without private values.

No later route may use normal navigation, filtering, sorting, report opening, export, detail open or chart-mode changes as a hidden reason to refresh provider data.

## Read-Model Requirements For Future Work

Future read models that expose calculated, provider-derived, estimated or blocked values must include:

- `source`: provider, provider_reference, app_calculated, snapshot, local_metadata, user_override, mixed or none,
- `freshness`: loaded/calculated timestamp, source status, stale/missing/scope state and safe scope metadata,
- `confidence`: high, medium or low,
- `warnings`: user-safe warning codes/messages with optional redacted debug hints,
- `blockedMetrics`: explicit list of metrics not safe to show as complete,
- provider-call classification: provider-backed, snapshot-first, snapshot-only, browser-local or no data call,
- API-budget impact,
- privacy/data impact,
- old/new comparison evidence before route migration.

Old/new comparison before migration should cover at least: asset counts, active/closed/unknown counts, safe quantity totals, warning/blocker counts, provider-call count, refresh behavior, privacy/redaction behavior and display identity. Cost basis, PnL, transfers, dividends, fees, taxes and FX are compared only when their ownership is implemented.

## ADR Note

This strategy is durable DP-02 guidance, but it does not by itself choose a production storage model, cost-basis method, transfer-pairing algorithm, FX source or product read-model contract. A narrow ADR should be added later only if a follow-up issue promotes this strategy into a route migration contract or resolves one of those durable architecture decisions.

## Related Issues

- Refs #248
- Refs #249
- Fixes #251
- Related: #252, #253, #258, #259, #260
