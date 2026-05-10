# AssetTrace v1 Guardrails

Status: active guardrail documentation  
Scope: AssetTrace App v1 documentation and review rules  
Related issues: Refs #179, #186, #187, #188, #189, #190, #199

## Purpose

This document locks the first AssetTrace-v1 guardrails batch before larger UI or data-pipeline pull requests are implemented.

It covers:

- separation between Parqet provider data, internal AssetTrace analysis models and UI/read models,
- API-budget rules for purpose-specific provider access,
- feature capability and source rules,
- calculation-pipeline boundaries,
- confidence, source, freshness and wording rules for analytics,
- review checks for future data-related PRs.

This is documentation-only architecture guidance. It does not introduce new UI, persistence, snapshots, OAuth behavior, Parqet API calls, charts, reports or production analytics.

## Model boundaries

AssetTrace v1 has three separate model layers.

| Layer                               | Purpose                                                                                        | Allowed usage                                                                               | Forbidden usage                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider DTOs / Parqet API shapes   | Parse and tolerate Parqet Connect responses close to the fetch boundary.                       | Fetching, validation, diagnostics, normalization input and redacted debug counts.           | Direct UI rendering, long-lived app state, exports, logs with raw private values, or app-level calculations that assume raw provider shape stability. |
| Internal AssetTrace analysis models | Normalize, aggregate and calculate portfolio/asset facts from provider data plus safe context. | Canonical calculations, warnings, confidence, source attribution, audit/report projections. | Fetching provider data directly from deep calculation helpers or duplicating route-local calculation chains.                                          |
| UI/read models                      | Render already-normalized, already-scoped data in product views.                               | Display, sorting, filtering, chart-mode switches, drilldowns and formatting.                | Provider DTO passthrough, provider calls from local UI actions, private raw payload display, or independent analytics logic.                          |

The separation implements #186. Provider DTO changes should be contained at the fetch/normalization boundary whenever possible. UI code should consume read models or projections that are intentionally shaped for the view.

## Canonical normalization and aggregation

Future AssetTrace v1 work must reuse the existing canonical boundaries unless a later ADR explicitly replaces them.

Current canonical modules:

- early shared Parqet activity context: `src/lib/parqet-assets/build-activity-context.ts`, documented by ADR 0003,
- early activity filtering/normalization/override/reconciliation chain under `src/lib/parqet-assets/`, documented by ADR 0003,
- Global Asset Timeline type model: `src/lib/parqet/global-assets/types.ts`,
- Global Asset normalization: `src/lib/parqet/global-assets/normalize.ts`,
- Global Asset aggregation: `src/lib/parqet/global-assets/aggregate.ts`,
- guarded Global Asset audit/report helpers: `src/lib/parqet/global-assets/audit.ts`.

Rules for new calculations:

1. Start from normalized activities, existing aggregated Global Asset output, or explicit snapshot/read models; do not start from raw provider DTOs in UI or feature code.
2. Add missing normalization fields at the canonical normalization boundary before adding feature-local parsing.
3. Add shared aggregation helpers next to the existing Global Asset aggregation layer when multiple features need the same result.
4. Keep view-specific projection code thin: it may filter, sort and format existing model fields, but it must not re-derive cost basis, positions, dividends, fees, taxes, performance, transfer status or confidence independently.
5. If a feature needs a calculation that conflicts with an existing model, create or update an ADR before implementation.
6. Existing Parqet reference fields may be preserved for comparison, but they must be labelled as provider reference values when shown or used diagnostically.

These rules implement #189 and reinforce ADR 0002 and ADR 0003.

## Purpose-specific Parqet data source rules

AssetTrace v1 must prefer the narrowest data source that can answer the feature question. This implements #187.

### Holdings / performance-near data

Use holdings, positions or performance-near provider data when the feature asks for current or provider-computed state, for example:

- current dashboard holdings,
- current market value or allocation,
- provider-owned performance values,
- quick asset detail summary when a loaded holdings/snapshot model already contains enough information,
- diagnostics comparing AssetTrace calculations against provider reference values.

Rules:

- Prefer already-loaded holdings or snapshot-backed read models before any provider call.
- Use holdings/performance-near data for current-state questions instead of replaying all historical activities only to answer a current-position question.
- If a value is provider-computed, expose that source in diagnostics or UI wording where relevant.
- Do not silently mix provider-computed performance with AssetTrace self-calculated performance in one metric.

### Activity / timeline data

Use activity/timeline data only when the feature needs event history, for example:

- asset timeline entries,
- buy/sell/dividend/fee/tax history,
- transfer candidate detection,
- cost-basis or realized-gain calculations that require transaction order,
- audit trails and explanations for how a metric was derived,
- global timeline views.

Rules:

- Activity data must be normalized before aggregation or UI projection.
- Activity fetches must be scoped by explicit user intent and by available provider filters when possible.
- Timeline data may be stale or incomplete; confidence and freshness must travel with derived metrics.
- Activity pipelines must not be triggered by local-only UI interactions such as sorting, chart-mode switching or opening a details panel that can be satisfied from loaded data.

### Snapshot-backed data

Prefer snapshot-backed or already-loaded read models when the feature needs stable repeated reads, for example:

- dashboard navigation,
- asset detail switching,
- sorting/filtering/searching within a loaded dataset,
- chart range changes that can be derived from loaded timeline points,
- report previews,
- diagnostics summaries of the last explicit sync.

Rules:

- Snapshot-backed data should include freshness metadata: source, last successful sync/load time and known warnings.
- A stale snapshot should be labelled stale rather than silently refreshed through a hidden full fetch.
- Explicit refresh/sync actions may update bounded v1 snapshots, but omitted refresh options must remain snapshot/local-first and must not trigger provider fetches.

## Local-only UI interaction rules

The following interactions must remain strictly local after required data is loaded:

- route navigation between views that can use the current loaded/snapshot state,
- table sorting,
- table filtering and text search,
- grouping and ungrouping,
- chart mode changes,
- chart zoom/range changes when points are already loaded,
- opening or closing detail drawers/modals,
- expanding rows,
- selecting columns,
- toggling display currency when no provider conversion call is explicitly requested,
- report layout or section toggles,
- diagnostics filters over already-loaded diagnostic records.

These interactions must not trigger hidden full portfolio, holdings, activity, analytics or report fetches. If a local interaction truly needs missing provider data, the UI must make that explicit through a user-initiated load/refresh action with scope and expected freshness visible.

## API budget rules

API budget is a project-wide product and architecture rule, not only a debugging preference.

Hard rules:

1. No hidden full fetches through navigation, filtering, sorting, chart-mode switching, reports or detail views.
2. Every Parqet/API-touching PR must state request impact, cache/snapshot reuse, retry behavior and rate-limit handling.
3. Prefer explicit sync/refresh actions over automatic reloads.
4. Prefer loaded/snapshot data, provider-side filters, pagination and bounded concurrency.
5. Distinguish reducing payload size from reducing provider-call count.
6. Do not retry expensive activity pipelines after known provider rate limits or other known non-auth failures.
7. Token refresh is for likely auth failures only, not for generic data errors.
8. Diagnostics may count requests, scopes and failures, but must not expose raw private payloads.
9. Detail views and reports must declare whether they are read-only projections of loaded data or whether they require an explicit provider refresh.
10. Any proposed automatic background refresh needs an issue-level justification and review against these rules before implementation.

## Confidence, source and freshness rules

Every calculated or provider-derived metric that may be incomplete, stale or ambiguous must carry enough metadata for honest display and diagnostics. This implements #190.

Required concepts:

- `source`: where the value came from, such as `provider`, `assettrace_calculated`, `snapshot`, `user_override` or `mixed`.
- `freshness`: when the source data was loaded, synced or calculated; include stale/unknown state when exact time is unavailable.
- `confidence`: `high`, `medium` or `low`, derived from data completeness, warnings and calculation assumptions.
- `warnings`: user-safe warnings and optional redacted debug hints.
- `blockedMetrics`: explicit list of metrics that must not be shown as complete.

Minimum confidence guidance:

| Confidence | Use when                                                                                                                                                                                  | UI/review implication                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| High       | Required fields are present, source data is fresh enough for the feature and no material warnings affect the metric.                                                                      | May be shown as a normal value with source/freshness available in detail or diagnostics.     |
| Medium     | Minor gaps, stale-but-usable data, provider reference comparison mismatch that does not block the metric, or conservative assumptions are present.                                        | Show a caveat or info indicator when user decisions may depend on the value.                 |
| Low        | Missing identity, missing portfolio context, ambiguous transfers, partial activity history, missing currency/fx context or unresolved data-quality warnings materially affect the metric. | Use caution wording, avoid ranking/optimization decisions, and expose why confidence is low. |

Metrics must be blocked instead of shown when the missing data would make the value misleading. Examples: portfolio-specific performance without portfolio context, transfer-adjusted cost basis before transfer matching exists, or fee analytics without fee/tax fields for the relevant activity range.

## Wording rules for analytics safety

UI and report wording must distinguish facts, provider reference values, AssetTrace calculations and estimates.

Use wording like:

- `Calculated from loaded activities` for AssetTrace calculations derived from normalized activity history.
- `Provider reference value` for Parqet-supplied analytics or performance-near values.
- `Estimated` only when a documented approximation is intentionally used.
- `Preliminary` for values produced before a required future step, such as transfer matching or full history loading.
- `Based on last loaded snapshot` for snapshot-backed values.
- `Incomplete data` or `Not enough data` when a metric is blocked.
- `Data quality warning` for values affected by normalization, identity, portfolio-context, transfer, currency or freshness warnings.

Avoid wording that implies certainty when confidence is not high:

- Do not call low-confidence values `final`, `exact`, `complete`, `verified` or `official`.
- Do not present provider reference values as AssetTrace calculations.
- Do not present AssetTrace calculations as official Parqet values.
- Do not hide freshness or source when a value is stale, mixed-source, estimated or preliminary.

## Feature capability matrix

This matrix implements #188 and guides v1 sequencing from #199.

| Feature                     | Primary data source                                                                                            | Loaded/snapshot data sufficient?                                                  | Provider call allowed?                                                                          | Freshness / confidence notes                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Dashboard                   | Holdings/performance-near read model first; normalized activity aggregates only for metrics that need history. | Yes for navigation, allocation display, sorting and already-loaded summary cards. | Only through explicit refresh/sync or initial authorized load, scoped as narrowly as available. | Current-state values should show provider/snapshot freshness. Historical derived metrics need activity confidence.       |
| Asset Detail                | Snapshot/read model plus Global Asset aggregate for selected asset.                                            | Yes when selected asset details are already present.                              | Allowed only by explicit scoped load/refresh for missing selected asset data.                   | Source should distinguish provider current values from AssetTrace timeline-derived values.                               |
| Asset Detail Chart/Timeline | Normalized activities and timeline entries for the selected asset.                                             | Yes for chart-mode, range and zoom changes over loaded points.                    | Allowed only for explicit load-more/refresh of missing timeline scope.                          | Timeline-derived metrics are preliminary when transfers, fees, taxes or full history are incomplete.                     |
| Activities                  | Normalized activity list from the canonical activity context.                                                  | Yes for local filtering, sorting, grouping and pagination over loaded activities. | Allowed only for explicit scoped activity load or refresh.                                      | Show activity source scope, last load time and normalization warnings.                                                   |
| Global Timeline             | Normalized activity timeline across selected portfolios/assets.                                                | Yes after the selected scope is loaded.                                           | Allowed only for explicit scope changes that require loading missing data.                      | Confidence depends on asset identity, portfolio context and complete activity range.                                     |
| Reports                     | Snapshot/read models and canonical aggregates; reports should be reproducible from the chosen snapshot.        | Yes for preview, layout changes and section toggles.                              | Allowed only through an explicit report data refresh, not by opening/exporting the report.      | Report output must include source and freshness summary plus caveats for estimated/preliminary values.                   |
| Settings/Diagnostics        | Redacted diagnostics, request counts, sync metadata and warning summaries.                                     | Yes for viewing and filtering existing diagnostics.                               | Allowed only for explicit test connection, sync, refresh or diagnostic run actions.             | Never expose raw private payloads. Diagnostics may show counts, scopes, timestamps, categories and redacted error hints. |
| Fees analytics              | Normalized activities with fee/tax fields; future aggregate helpers.                                           | Yes after relevant activity scope is loaded.                                      | Allowed only for explicit scoped activity refresh if fields are missing.                        | Block or mark low confidence when fee/tax fields or currencies are missing.                                              |
| Dividend analysis           | Normalized dividend activities and asset/portfolio context.                                                    | Yes after relevant dividend/activity scope is loaded.                             | Allowed only for explicit scoped load/refresh.                                                  | Mark preliminary if withholding tax, currency or full history is incomplete.                                             |
| Trading statistics          | Normalized buy/sell activities, ordering, portfolio context and possibly transfer status.                      | Yes after complete relevant activity scope is loaded.                             | Allowed only for explicit scoped activity refresh.                                              | Transfer ambiguity, missing portfolio context or partial history lowers confidence or blocks metrics.                    |
| Rebalancing                 | Holdings/current allocation snapshot, target settings and optional pending activity context.                   | Yes for recommendations from current snapshot plus local targets.                 | Allowed only for explicit refresh of holdings/current allocation.                               | Must show snapshot time and avoid implying live market precision if data is stale.                                       |

## Review checklist for future PRs

Future AssetTrace data, analytics, report, UI or diagnostics PRs must be reviewed against these checks:

- No duplicate calculation pipeline: calculations reuse the canonical normalization/aggregation layers or explain an ADR-backed exception.
- No Provider DTOs directly in UI where avoidable: UI receives read models/projections, not raw Parqet responses.
- No private raw data in UI, logs, diagnostics, exports, examples, fixtures or screenshots.
- No automatic provider calls from local UI actions such as navigation, filtering, sorting, chart-mode switching, report opening or detail expansion.
- API budget impact is documented for every Parqet/API-touching change, including request count/scope, cache or snapshot reuse, retry behavior and rate-limit handling.
- Source, freshness, confidence and warnings are attached to calculated, provider-derived, estimated, preliminary or data-quality-limited values.
- Wording does not overstate certainty and does not mix provider reference values with AssetTrace calculations without disclosure.
- Feature code does not read or persist `.env`, tokens, cookies, OAuth codes, private exports or real portfolio/activity data.
- Diagnostics are redacted and count/scope-oriented.
- Changelog and architecture/data docs are updated when behavior, architecture or durable guardrails change.

## Snapshot/Freshness terms

- `snapshot`: bounded process-local in-memory server reuse or browser-local read model created only after an explicit load/refresh path. It is non-durable and may disappear across deploys, cold starts, server restarts or browser cache resets.
- `freshness`: safe metadata such as `loadedAt`, `updatedAt`, `status`, `source`, `stale`, scope count/fingerprint and redacted error category.
- `source=provider`: data was produced by an explicit provider load/refresh.
- `source=snapshot` or `source=local_derived`: data was reused locally without a new provider call.

Normal UI surfaces must prefer snapshot/local-derived data or clear empty states over hidden full provider refreshes. Tokens, cookies, authorization headers and raw provider payloads must not be exposed in UI, diagnostics or exports; filtered/normalized activity data may be retained only within bounded v1 snapshot/read-model reuse paths.
