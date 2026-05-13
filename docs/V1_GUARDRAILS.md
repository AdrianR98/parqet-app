# V1 Guardrails

Status: active guardrail documentation  
Scope: v1 data, API-budget, privacy, diagnostics, export and review rules

This document is app-neutral. It governs v1 behavior and review expectations without depending on the current visible product name.

## Purpose

This document locks the v1 guardrails for future UI, data-pipeline, analytics, report and diagnostics work.

It covers:

- separation between provider DTOs, internal analysis models and UI/read models,
- API-budget rules for purpose-specific provider access,
- feature capability and source rules,
- calculation-pipeline boundaries,
- confidence, source, freshness and wording rules,
- privacy, diagnostics and export boundaries,
- review checks for future data-related PRs.

This is documentation-only architecture guidance. It does not introduce new UI, persistence, snapshots, OAuth behavior, provider API calls, charts, reports or production analytics.

## Model Boundaries

v1 has three separate model layers.

| Layer | Purpose | Allowed usage | Forbidden usage |
| --- | --- | --- | --- |
| Provider DTOs / provider API shapes | Parse and tolerate provider responses close to the fetch boundary. | Fetching, validation, diagnostics, normalization input and redacted debug counts. | Direct UI rendering, long-lived app state, exports, logs with raw private values, or app-level calculations that assume raw provider shape stability. |
| Internal analysis models | Normalize, aggregate and calculate portfolio/asset facts from provider data plus safe context. | Canonical calculations, warnings, confidence, source attribution, audit/report projections. | Fetching provider data directly from deep calculation helpers or duplicating route-local calculation chains. |
| UI/read models | Render already-normalized, already-scoped data in product views. | Display, sorting, filtering, chart-mode switches, drilldowns and formatting. | Provider DTO passthrough, provider calls from local UI actions, private raw payload display, or independent analytics logic. |

Provider DTO changes should be contained at the fetch/normalization boundary whenever possible. UI code should consume read models or projections that are intentionally shaped for the view.

## Canonical Normalization And Aggregation

Future v1 work must reuse existing canonical boundaries unless a later ADR explicitly replaces them.

For current pipeline-readiness status, route/read-model replacement evidence and migration gate checks, use `docs/PIPELINE_INVENTORY.md` from #249 together with the #248 decision backlog.

Current canonical modules:

- early shared provider activity context: `src/lib/parqet-assets/build-activity-context.ts`, documented by ADR 0003,
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
6. Existing provider reference fields may be preserved for comparison, but they must be labelled as provider reference values when shown or used diagnostically.

DP-06 cost-basis, PnL and price-source policy is documented in `docs/GLOBAL_ASSET_AGGREGATION.md`. It locks `weighted_average_remaining_cost_basis` as the first app-owned cost-basis method, keeps app-owned PnL/performance blocked or preliminary until validation evidence exists, treats latest trade price as an estimated/stale fallback only and authorizes no FIFO, tax reporting, external price APIs or FX conversion for V1.

DP-08 warning, confidence and blocked-metrics policy is documented in `docs/GLOBAL_ASSET_TYPE_MODEL.md`, `docs/GLOBAL_ASSET_AGGREGATION.md` and `docs/GLOBAL_ASSET_AUDIT_REPORT.md`. It locks stable warning codes with severity, audience, source, affected entity, confidence impact and explicit `blockedMetrics`; separates user-facing and diagnostic warning projections; prefers metric-level confidence over whole-asset blocking; and authorizes no implementation, UI copy implementation, route migration, provider calls or override/write behavior.

DP-09 override/user-decision model policy is documented in `docs/GLOBAL_ASSET_OVERRIDES.md` for #166/#248. It locks decision categories, effect classes, validation gates, no-op behavior for unsupported/disabled decisions, undo/delete/reset requirements and privacy-safe audit boundaries. It authorizes no write/edit UI, no new write API, no durable storage implementation, no provider/API calls for local decision flows and no route/read-model migration.

DP-11 product read-model and migration-gate policy is locked in this document for #248/#259. It defines the Product Read Model as a UI/route-safe projection, not the internal normalization or aggregation model. It authorizes no implementation, route migration, product UI changes, provider/API calls, durable storage decision, schema migration, feature flag implementation or removal of existing calculation paths.

## Purpose-Specific Data Source Rules

v1 must prefer the narrowest data source that can answer the feature question.

The detailed DP-02 mapping for current-state, activity-history, snapshot/read-model, local metadata, provider-reference and blocked/unknown cases lives in `docs/PROVIDER_DATA_SOURCE_STRATEGY.md`.

### Holdings / Performance-Near Data

Use holdings, positions or performance-near provider data when the feature asks for current or provider-computed state, for example:

- current dashboard holdings,
- current market value or allocation,
- provider-owned performance values,
- quick asset detail summary when a loaded holdings/snapshot model already contains enough information,
- diagnostics comparing app calculations against provider reference values.

Rules:

- Prefer already-loaded holdings or snapshot-backed read models before any provider call.
- Use holdings/performance-near data for current-state questions instead of replaying all historical activities only to answer a current-position question.
- If a value is provider-computed, expose that source in diagnostics or UI wording where relevant.
- Do not silently mix provider-computed performance with app-calculated performance in one metric.

### Activity / Timeline Data

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

### Snapshot-Backed Data

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
- Audit routes without `refresh=1` must be snapshot-only/no-provider-call reads and return a clear no-snapshot response when no matching snapshot exists.
- Audit routes with `refresh=1` may run provider-backed only when the route is explicitly designed and gated for provider-backed audit use.

### DP-10 Snapshot/Cache Route Semantics

DP-10 locks v1 snapshot/cache and API-budget route semantics for #248 and #258. This is planning and documentation only; it authorizes no app/runtime code changes, route migration, new endpoints, retry implementation, browser storage implementation, durable storage, OAuth/token changes or provider calls.

Provider/API calls are allowed only through explicit provider-backed refresh/load paths. Normal navigation, filtering, sorting, details, reports and diagnostics must use existing snapshots, browser-local read models or no-data-call behavior.

Route and surface categories:

| Category | Provider/API call policy | Expected behavior | Examples |
| --- | --- | --- | --- |
| `provider_backed_explicit_refresh` | May call provider/API only from an explicit user action or explicit refresh/load route. It must know request scope, bound pagination/retry/concurrency and update snapshot/freshness metadata. It must not be triggered by simply opening a page. | Creates or refreshes a bounded snapshot/read model and records request scope, request count, pagination behavior, retry behavior, rate-limit behavior and snapshot reuse. | Explicit `Aktualisieren`, explicit `Assets laden`, explicit `Portfolios neu laden`, future explicit refresh/load route. |
| `snapshot_first` | Must read an existing snapshot/read model first and must not automatically call provider. | May show stale, missing or scope-mismatch state and may offer an explicit refresh/load action. | Dashboard, Assets page, Activities page, Reports preview. |
| `snapshot_only` | Must never call provider or refresh tokens. | Uses only existing snapshot/read-model data. | Sorting, filtering, column chooser, detail panel, local report layout, local diagnostics view. |
| `browser_local` | Must not call provider. | Uses browser state, local UI state or a browser-held read model; may compare selected UI scope with loaded snapshot scope. | Selected columns, sort order, visible filters, selected portfolios, draft report settings. |
| `no_data_call` | Must use no app data and no provider data. | Renders static, empty or error states without data access. | Help/static content, settings shell, about/static docs, empty/error states. |

Snapshot metadata should be sufficient to compare the loaded data basis with the selected UI/report scope. Structural metadata may include `snapshotId`, `createdAt`, `sourceType`, `sourceScope`, `selectedPortfolioIds`, `activityRange`, `includedAssetKeys`, `providerRequestCount`, `freshnessAt` and `staleAfter` or `expiresAt` when defined.

Scope comparison states:

| Scope state | Meaning | Rule |
| --- | --- | --- |
| `scope_match` | Snapshot fully covers the current UI/report scope. | Complete values may be shown subject to other warning/confidence rules. |
| `scope_subset` | Snapshot contains more data than currently selected. | Local filtering is allowed without provider calls. |
| `scope_missing` | Current UI/report scope needs data not covered by the snapshot. | Do not auto-refresh; affected metrics are blocked or preliminary and explicit refresh/load may be offered. |
| `scope_unknown` | Metadata is insufficient to prove coverage. | Do not treat as complete. |

Freshness states:

| Freshness state | Meaning | Rule |
| --- | --- | --- |
| `fresh` | Within the allowed freshness boundary. | May be used as the current data basis subject to scope and confidence rules. |
| `stale` | Older than the preferred boundary but still safe to show with caveat. | May remain visible as stale/preliminary when safe; do not silently reload. |
| `expired` | Not safe as a complete data basis. | Blocks metrics that would be misleading without a known current data basis. |
| `unknown` | Freshness metadata is missing. | Do not treat as complete; block misleading metrics. |

Source, freshness and confidence must be visible in later read models/reports. Stale, expired, unknown or scope-mismatch states must not trigger hidden provider reloads.

No-snapshot behavior:

- Product views should show an empty/no-snapshot state with an explicit load/refresh action.
- Opening a page must not trigger a hidden full provider load.
- Reports/export previews must not silently fetch missing provider data.
- Diagnostics may show counts/status if already available; otherwise they show a no-snapshot state.

Retry and rate-limit behavior:

- No automatic full-reload retry loops.
- Auth/token refresh is appropriate only for likely auth failures.
- Rate-limit and provider failures must not immediately rerun the expensive activity pipeline.
- Retry count and concurrency must be bounded.
- Provider errors should surface as stale, rate-limit or error state with an explicit retry option.

Durable storage remains deferred. DP-10 allows process-local snapshots and browser-local read models as v1 semantics, but no durable server storage/database work is authorized. Durable storage requires a later ADR or issue, and DP-10 does not reopen OAuth/token storage or database architecture.

### DP-11 Product Read Model And Migration Gate

DP-11 locks the Product Read Model contract and migration-gate policy. Global Asset output may later feed product surfaces only through a UI-safe read model that carries source, freshness, scope, confidence, warnings, blocked metrics and value classification. Internal normalized activities, raw provider payloads and private diagnostic rows must not become product-route output.

The Product Read Model is a projection for routes and UI surfaces. It is not the internal normalization model, the Global Asset aggregation model, a raw audit dump or a provider DTO wrapper.

Product read models may contain:

- metadata: `readModelId`, `snapshotId`, `generatedAt`, `sourceType`, `sourceScope`, `freshnessAt`, `scopeState`, `freshnessState`, selected portfolio scope represented safely, and API-budget metadata such as provider request count when available.
- summary: `assetCount`, `activeAssetCount`, `closedAssetCount`, `warningCount`, `blockerCount`, `blockedMetricCount`, and stale or unknown snapshot state.
- asset-level fields: `assetKey`, display fields with display metadata source, `quantity`, `positionStatus`, portfolio breakdown, safe totals, same-currency-safe income fields, `valueClassification`, `confidence`, `warnings`, `blockedMetrics`, and source/freshness metadata.
- diagnostics: warning summaries, blocked metrics by category, and later redacted comparison hashes or counts.

Product read models must not expose:

- raw provider payloads,
- unredacted activity rows,
- tokens, cookies or OAuth values,
- private exports,
- full debug logs,
- unredacted portfolio or activity IDs unless a later local/debug-only rule explicitly allows it.

DP-11 does not select a first product route. The first migration candidate must be chosen only after #249 inventory and replacement-gate evidence identifies the lowest-risk route or surface.

A first migration candidate must be:

- read-only,
- snapshot/local-first,
- low business risk,
- narrow in output surface,
- easy to compare old/new,
- rollback-capable,
- compatible with the existing UI,
- free of broad UI redesign,
- free of hidden provider calls,
- able to keep the existing calculation path during comparison.

Likely later candidates include diagnostic/read-only report surfaces, an asset summary projection behind a later explicit gate, or a local audit-derived comparison report. The main Dashboard replacement, full AssetTable rewrite, Activities route replacement, PnL/performance-heavy surfaces, and any surface requiring live provider refresh on navigation are not first candidates.

A later route-specific migration PR must provide redacted/count-safe old/new comparison evidence for:

- old output count and new output count,
- asset count and active/closed asset count comparison,
- warning/blocker count,
- `blockedMetrics` comparison,
- quantity comparison where safe,
- dividend/income same-currency comparison where safe,
- source/freshness/confidence fields present,
- privacy redaction confirmed,
- provider request count unchanged or reduced,
- no hidden provider calls from navigation, filtering or rendering.

Comparison rules:

- Compare only the same selected scope.
- Compare only same-currency-safe values.
- Keep `provider_reference` and `app_calculated` values separate.
- Do not hide differences; document explainable differences and blockers.
- Do not use private screenshots or raw provider payloads as evidence.

Rollback and compatibility expectations:

- The existing route/calculation path remains available.
- No old code is deleted in the first migration PR.
- Feature flags or compatibility projections may be required later, but DP-11 does not implement them.
- Old/new comparison can be disabled if it causes risk.
- A migrated route can fall back to the old read path.
- No UI schema break is allowed unless explicitly planned in a later issue.
- Migration must be reversible without provider-token or durable-storage changes.

DP-11 depends on #249 inventory/replacement gate evidence, DP-04 normalization contract (#253), DP-05 transfer handling (#254), DP-06 cost-basis/PnL/price policy (#255), DP-07 dividend/fee/tax/currency policy (#256), DP-08 warning/confidence/blocked-metrics model (#257), and DP-10 snapshot/cache/API-budget route semantics (#258).

Gate rules:

- No migration until #249 identifies a lowest-risk route or surface.
- No Product Read Model integration if source, freshness, scope, warnings, `blockedMetrics` or `valueClassification` fields are missing.
- No PnL/performance-heavy route first while those values remain blocked or preliminary.
- No route migration may introduce hidden provider calls.
- No old path removal until comparison and rollback evidence exists.

### DP-12 Synthetic Fixtures And Audit Validation

DP-12 locks the synthetic-fixture and audit-validation strategy for #248/#260. Before Global Asset output may support Product Read Model or route migration, the pure pipeline must be validated with privacy-safe synthetic fixtures covering normalization, aggregation, transfers, currencies, dividends/fees/taxes, `blockedMetrics`, confidence and audit redaction.

DP-12 is planning/documentation only. It authorizes no test setup, fixture files, fixture implementation, app/runtime code changes, provider calls, route migration, private data handling, CI changes or product UI changes. If existing tooling is sufficient later, a focused implementation issue may add pure-function tests with synthetic fixtures. If tooling is insufficient, create a separate focused test-setup issue before implementation. Do not expand test setup opportunistically inside route or product migration PRs.

Pure pipeline functions needing later synthetic fixture coverage:

- `normalizeActivities`
- single-activity normalization
- asset identity derivation
- activity type classification
- money parsing
- quantity parsing
- date parsing
- `buildGlobalAssets` / aggregation
- timeline ordering
- portfolio breakdown calculation
- quantity tolerance handling
- negative quantity classification
- transfer candidate classification
- `blockedMetrics` derivation
- confidence derivation
- audit report shaping
- audit redaction
- Product Read Model projection once implemented

Out of scope for DP-12 fixture strategy:

- Next.js route tests
- React component tests
- OAuth flow tests
- provider fetch layer tests
- real Parqet API behavior tests
- Vercel deployment tests

Migration gate additions from DP-12:

- Relevant synthetic fixtures exist before Product Read Model or route migration.
- Normalization output, aggregation output and audit output match the expected fixture results.
- Unsafe cases set `blockedMetrics`.
- Confidence follows warning, source and freshness rules.
- Audit redaction is validated.
- Pure fixture tests trigger no provider calls and keep `providerRequestCount` at zero.
- Old/new comparison can be redacted/count-only.
- Hidden provider calls are not introduced.

### Local Metadata Data

Use local metadata only for display identity, for example:

- asset display names,
- symbol / ticker fallbacks,
- WKN fallbacks,
- subtitles,
- logo identity fallback.

Rules:

- Local metadata must be maintained through `docs/LOCAL_METADATA_WORKFLOW.md`.
- The asset identity and metadata boundary is documented in `docs/ASSET_IDENTITY_AND_METADATA.md`.
- Local metadata must not fetch provider, Parqet Asset Search, identifier-mapping or external metadata APIs automatically in v1.
- Local metadata must not change calculations, positions, quantities, cost basis, dividends, fees, taxes, performance or warnings.
- Source CSV exports used to generate local metadata should stay local unless they are confirmed free of private portfolio, account, broker, quantity, price, trade and transaction context.
- Generated metadata may be committed only after privacy review and conflict review.
- Missing names should fall back to symbol, WKN or ISIN rather than triggering a hidden metadata lookup.

## Local-First UI Interaction Rules

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

## API Budget Rules

API budget is a project-wide product and architecture rule, not only a debugging preference.

Hard rules:

1. No hidden full fetches through navigation, filtering, sorting, chart-mode switching, reports or detail views.
2. Every provider/API-touching PR must state request impact, cache/snapshot reuse, retry behavior and rate-limit handling.
3. Prefer explicit sync/refresh actions over automatic reloads.
4. Prefer loaded/snapshot data, provider-side filters, pagination and bounded concurrency.
5. Distinguish reducing payload size from reducing provider-call count.
6. Do not retry expensive activity pipelines after known provider rate limits or other known non-auth failures.
7. Token refresh is for likely auth failures only, not for generic data errors.
8. Diagnostics may count requests, scopes and failures, but must not expose raw private payloads.
9. Detail views and reports must declare whether they are read-only projections of loaded data or whether they require an explicit provider refresh.
10. Any proposed automatic background refresh needs an issue-level justification and review against these rules before implementation.
11. Any proposed metadata service, asset-search or identifier-mapping integration must be handled as a separate Research/ADR or Post-V1 feature before implementation.
12. Scope/freshness mismatch, missing snapshots and unknown freshness must be visible and must not trigger hidden provider reloads.

## Source, Freshness And Confidence

Every calculated or provider-derived metric that may be incomplete, stale or ambiguous must carry enough metadata for honest display and diagnostics.

Required concepts:

- `source` / `sourceType`: where the value came from, such as `provider`, `app_calculated`, `local_snapshot`, `manual`, `derived` or `none`.
- `sourceScope`: whether the data basis is portfolio, selected-portfolio, global, asset or report scoped.
- `freshness` / `freshnessAt`: when the source data was loaded, synced or calculated; this is the timestamp of the data basis, not UI render time.
- `snapshotId`: optional stable reference to the loaded data basis.
- `calculationPolicy`: documented policy identifier for app-owned calculations, for example `weighted_average_remaining_cost_basis`.
- `valueClassification`: `provider_reference`, `app_calculated`, `estimated`, `preliminary`, `blocked` or `none`.
- `confidence`: `high`, `medium`, `low` or `unknown`, derived from data completeness, warning severity, freshness, value classification and blocked metric presence.
- `warnings`: user-safe warnings and optional redacted diagnostic hints.
- `blockedMetrics`: explicit list of metrics that must not be shown as complete.

Minimum confidence guidance:

| Confidence | Use when | UI/review implication |
| --- | --- | --- |
| High | Required fields are present, source data is fresh enough for the feature and no material warnings affect the metric. | May be shown as a normal value with source/freshness available in detail or diagnostics. |
| Medium | Minor gaps, stale-but-usable data, provider reference comparison mismatch that does not block the metric, or conservative assumptions are present. | Show a caveat or info indicator when user decisions may depend on the value. |
| Low | A blocker exists, important source/freshness is missing, affected metrics are blocked, or missing identity, portfolio context, transfer, history, currency/FX or data-quality inputs materially affect the metric. | Use caution wording, avoid ranking/optimization decisions, and expose why confidence is low. |
| Unknown | The source situation is insufficient for confidence classification. | Do not present the value as complete; expose the missing source/confidence basis in diagnostics or report output. |

Metrics must be blocked instead of shown when missing data would make the value misleading.
Blocking should be metric-specific where possible. A blocked `cost_basis`, `performance` or `dividend_yield` does not by itself hide safe values such as quantity, per-currency subtotals, audit counts or warning summaries.

## Wording Rules

UI and report wording must distinguish facts, provider reference values, app calculations and estimates.

Use wording like:

- `Calculated from loaded activities` for app calculations derived from normalized activity history.
- `Provider reference value` for provider-supplied analytics or performance-near values.
- `Estimated` only when a documented approximation is intentionally used.
- `Preliminary` for values produced before a required future step, such as transfer matching or full history loading.
- `Based on last loaded snapshot` for snapshot-backed values.
- `Incomplete data` or `Not enough data` when a metric is blocked.
- `Data quality warning` for values affected by normalization, identity, portfolio-context, transfer, currency or freshness warnings.

Avoid wording that implies certainty when confidence is not high:

- Do not call low-confidence values `final`, `exact`, `complete`, `verified` or `official`.
- Do not present provider reference values as app calculations.
- Do not present app calculations as official provider values.
- Do not hide freshness or source when a value is stale, mixed-source, estimated or preliminary.

## Privacy, Diagnostics And Export Rules

- Never show tokens, cookies, OAuth codes, authorization headers or raw provider payloads in UI, logs, diagnostics, exports, examples or screenshots.
- Diagnostics must be redacted and count/scope-oriented.
- User-facing warnings must explain impact without raw provider fields, raw payloads, activity rows, activity IDs, portfolio IDs, stack traces, tokens, cookies or private exports.
- Diagnostic warnings may include technical categories, counts, source/freshness metadata, safe asset keys where already allowed, date buckets and redacted portfolio labels, but must not include raw payloads or private source rows.
- Exports must include only visible, loaded and safe report/read-model fields.
- Private debug data and hidden technical identifiers must not be exported.
- Local reference files and real portfolio data must stay in ignored local paths.
- Local metadata source CSV files must not be committed unless they are reviewed and confirmed to contain no private portfolio, account, broker, quantity, price, trade or transaction context.
- If private data appears in a diff, the PR is blocked.

## Feature Capability Matrix

| Feature | Primary data source | Loaded/snapshot data sufficient? | Provider call allowed? | Freshness / confidence notes |
| --- | --- | --- | --- | --- |
| Dashboard | Holdings/performance-near read model first; normalized activity aggregates only for metrics that need history. | Yes for navigation, allocation display, sorting and already-loaded summary cards. | Only through explicit refresh/sync or initial authorized load, scoped as narrowly as available. | Current-state values should show provider/snapshot freshness. Historical derived metrics need activity confidence. |
| Asset Detail | Snapshot/read model plus Global Asset aggregate for selected asset. | Yes when selected asset details are already present. | Allowed only by explicit scoped load/refresh for missing selected asset data. | Source should distinguish provider current values from app timeline-derived values. |
| Asset Detail Chart/Timeline | Normalized activities and timeline entries for the selected asset. | Yes for chart-mode, range and zoom changes over loaded points. | Allowed only for explicit load-more/refresh of missing timeline scope. | Timeline-derived metrics are preliminary when transfers, fees, taxes or full history are incomplete. |
| Activities | Normalized activity list from the canonical activity context. | Yes for local filtering, sorting, grouping and pagination over loaded activities. | Allowed only for explicit scoped activity load or refresh. | Show activity source scope, last load time and normalization warnings. |
| Global Timeline | Normalized activity timeline across selected portfolios/assets. | Yes after the selected scope is loaded. | Allowed only for explicit scope changes that require loading missing data. | Confidence depends on asset identity, portfolio context and complete activity range. |
| Reports | Snapshot/read models and canonical aggregates; reports should be reproducible from the chosen snapshot. | Yes for preview, layout changes and section toggles. | Allowed only through an explicit report data refresh, not by opening/exporting the report. | Report output must include source and freshness summary plus caveats for estimated/preliminary values. |
| Settings/Diagnostics | Redacted diagnostics, request counts, sync metadata and warning summaries. | Yes for viewing and filtering existing diagnostics. | Allowed only for explicit test connection, sync, refresh or diagnostic run actions. | Never expose raw private payloads. Diagnostics may show counts, scopes, timestamps, categories and redacted error hints. |
| Fees analytics | Normalized activities with fee/tax fields; future aggregate helpers. | Yes after relevant activity scope is loaded. | Allowed only for explicit scoped activity refresh if fields are missing. | DP-07 keeps fees/taxes as separate source facts. Block or mark low confidence when fee/tax meaning or currencies are missing. |
| Dividend analysis | Normalized dividend activities and asset/portfolio context. | Yes after relevant dividend/activity scope is loaded. | Allowed only for explicit scoped load/refresh. | DP-07 allows only same-currency-safe gross/net dividend handling. Block converted totals and yield/return metrics when withholding tax, amount basis, currency, denominator or full history is unsafe. |
| Trading statistics | Normalized buy/sell activities, ordering, portfolio context and possibly transfer status. | Yes after complete relevant activity scope is loaded. | Allowed only for explicit scoped activity refresh. | Transfer ambiguity, missing portfolio context or partial history lowers confidence or blocks metrics. |
| Rebalancing | Holdings/current allocation snapshot, target settings and optional pending activity context. | Yes for recommendations from current snapshot plus local targets. | Allowed only for explicit refresh of holdings/current allocation. | Must show snapshot time and avoid implying live market precision if data is stale. |
| Local metadata display | Local/generated metadata plus already-loaded read models. | Yes for display names, symbols, WKNs, subtitles and logo identity fallback. | No provider or external metadata calls in v1. | Metadata improves identity display only and must not alter calculations or confidence by itself. |

## Review Checklist For Future PRs

- Run or reference `docs/V1_API_BUDGET_QA_CHECKLIST.md` for v1 release-readiness triage and provider-call-safe UI flow review.
- No duplicate calculation pipeline: calculations reuse canonical normalization/aggregation layers or explain an ADR-backed exception.
- No Provider DTOs directly in UI where avoidable: UI receives read models/projections, not raw provider responses.
- No private raw data in UI, logs, diagnostics, exports, examples, fixtures or screenshots.
- No automatic provider calls from local UI actions such as navigation, filtering, sorting, chart-mode switching, report opening or detail expansion.
- API Budget Impact is documented for every provider/API-touching change, including request count/scope, cache or snapshot reuse, retry behavior and rate-limit handling.
- Source, freshness, confidence and warnings are attached to calculated, provider-derived, estimated, preliminary or data-quality-limited values.
- Wording does not overstate certainty and does not mix provider reference values with app calculations without disclosure.
- Feature code does not read or persist `.env`, tokens, cookies, OAuth codes, private exports or real portfolio/activity data.
- Local metadata PRs must confirm source CSV privacy, generated-file review, conflict review and no provider-call behavior change.
- Diagnostics are redacted and count/scope-oriented.
- Changelog and architecture/data docs are updated when behavior, architecture or durable guardrails change.

Hidden reload risks to check in later PR review:

- page mount, route navigation, filter change, sort change, column toggle, detail panel open, report preview/export, settings open, warning panel open and portfolio selection changes without explicit refresh,
- hydration or `useEffect` loops, server component render paths and server routes called from render paths,
- stale, missing-snapshot or scope-mismatch detection that silently reloads provider data,
- risky patterns such as `useEffect(() => fetch(...), [])`, fetch-on-mount, automatic retry around the activity pipeline, token refresh on non-auth errors and silent reload after stale detection.

## Snapshot/Freshness Terms

- `snapshot`: bounded process-local in-memory server reuse or browser-local read model created only after an explicit load/refresh path. It is non-durable and may disappear across deploys, cold starts, server restarts or browser cache resets.
- `freshness`: safe metadata such as `loadedAt`, `updatedAt`, `status`, `source`, `stale`, scope count/fingerprint and redacted error category.
- `source=provider`: data was produced by an explicit provider load/refresh.
- `source=snapshot` or `source=local_derived`: data was reused locally without a new provider call.

Normal UI surfaces must prefer snapshot/local-derived data or clear empty states over hidden full provider refreshes. Tokens, cookies, authorization headers and raw provider payloads must not be exposed in UI, diagnostics or exports; filtered/normalized activity data may be retained only within bounded v1 snapshot/read-model reuse paths.
