# Database Asset Model Plan (Phase 4)

Status: planning baseline (no schema/runtime changes)
Linked issues: Refs #384, Refs #388, Refs #395, Refs #396, Refs #397, Refs #398
Branch rule: all Phase 4 tasks stay on `refactor/phase-4-database-asset-model` (same branch, no new PR)

## 1) Current DB / market-data inventory

### Current tables/entities

- `market_instruments`
- `market_symbol_mappings`
- `market_prices_daily`
- `market_actions`
- `market_data_runs`
- `market_data_run_items`
- `market_data_requests`
- `market_reference_sources`
- `market_reference_instruments`

### Current read/write paths

- Repository/data access: `src/lib/market-data/db/repository-core.ts` and admin db modules.
- Runtime read paths:
  - `/api/market-data/history` -> reads daily prices/actions from DB only.
  - `/api/parqet/assets` -> reads instrument metadata/mappings and logs unknown ISIN requests.
- Admin read paths:
  - `/api/admin/market-data/status`
  - `/api/admin/market-data/instruments`
  - `/api/admin/market-data/mappings`
  - `/api/admin/market-data/unmapped`
  - `/api/admin/market-data/requests`
  - `/api/admin/market-data/runs`
- Provider/import workflows: scripts in `scripts/*market-data*.mjs` and `scripts/yfinance/*`.

### Current query/index patterns (visible)

- ISIN identity lookups and joins from `market_instruments`.
- Provider/symbol uniqueness and primary selection in `market_symbol_mappings`.
- Range and latest-date history scans in `market_prices_daily`.
- Mixed action-type scans in `market_actions`.
- Admin CTE summary/coverage queries over instruments, mappings, prices, actions.

### Privacy boundary (current)

- Private user Parqet activity/trade data remains runtime/browser/server cache data.
- Public/reference market data is persisted in server-side market-data DB tables.
- Runtime request logging stores ISIN/reference hints only, not private activity payloads.

## 2) Current data flow

### Provider/import flow into DB

1. Symbol mappings are curated/validated (mainly yfinance).
2. Export scripts fetch public/reference price/action data.
3. Import/backfill/incremental scripts upsert DB tables.
4. Run provenance is stored in run + run-item tables.
5. Admin surfaces review coverage, mapping quality, and import status.

### DB read flow into admin

- Admin endpoints consume repository summary/overview/triage queries for operations and curation.

### DB read flow into API/dashboard/PRM

- History API serves DB-only price history.
- Assets API overlays DB reference metadata/mappings on runtime asset models.
- PRM valuation integration is planned in Phase 4 follow-up slices (#395/#397).

## 3) Naming layers (canonical for Phase 4)

Source-of-truth vocabulary: `docs/DOMAIN_LANGUAGE.md`.

### A) Database table names (target)

- `assets`
- `asset_symbol_mappings`
- `asset_daily_prices`
- `dividend_events`
- `corporate_action_events`
- `reference_data_sources`
- `reference_data_import_runs`
- `reference_data_import_run_items`
- `reference_data_request_logs`

### B) Database column names (target style)

- Use `asset_id` (not `instrument_id`).
- Keep normalized technical columns explicit: `provider`, `symbol`, `currency`, `source`, timestamps.
- Price fields remain daily-bar oriented in `asset_daily_prices` (`open`, `high`, `low`, `close`, optional `adj_close`, `volume`).
- Event tables keep explicit event-type fields per table (no generic catch-all required in first target).

### C) Low-level query/repository types

- Repository contracts should migrate to Asset naming (`Asset`, `AssetSymbolMapping`, `AssetDailyPrice`, `DividendEvent`, `CorporateActionEvent`, `ReferenceDataImportRun`).
- Query/helper functions should prefer explicit names such as `getLatestDailyPriceByAssetIsin`.

### D) Domain model names

- Use `Asset` / `GlobalAsset`.
- `AssetEvent` remains domain umbrella term.
- `DividendEvent` and `CorporateActionEvent` remain explicit subtypes.

### E) API/ViewModel names

- Keep `GlobalAssetViewModel` naming for app/domain output.
- Runtime/API contracts must not reintroduce Instrument as target domain term.

### F) Import/script names

- Prefer `reference-data-*` naming over broad `market-data-*` where touched in follow-up implementation.
- Scripts remain operational/provider scoped, but naming should reflect reference-data boundary.

## 4) Current -> target table mapping matrix

| Current | Target direction | Notes |
| --- | --- | --- |
| `market_instruments` | `assets` | Replace legacy Instrument table naming with Asset identity naming. |
| `market_symbol_mappings` | `asset_symbol_mappings` | Preserve provider/symbol mapping semantics with Asset naming. |
| `market_prices_daily` | `asset_daily_prices` | Persisted public/reference daily prices. |
| `market_actions` | split into `dividend_events` + `corporate_action_events` | Event split required; no mandatory unified `asset_events` table in first target. |
| `market_data_runs` | `reference_data_import_runs` | Rename to reference-data import provenance scope. |
| `market_data_run_items` | `reference_data_import_run_items` | Per-item provenance under reference-data import naming. |
| `market_data_requests` | `reference_data_request_logs` | Runtime-discovered unknown asset requests as reference-data queue/log. |
| `market_reference_sources` | `reference_data_sources` | Source registry naming aligned to reference-data scope. |
| `market_reference_instruments` | mapped into `assets` + `reference_data_sources` provenance | Reference instrument rows feed asset identity enrichment; no Instrument target naming. |

## 5) Price concept clarification

- `asset_daily_prices`: persisted public/reference daily provider prices.
- `latestMarketPrice`: derived by query/repository function from `asset_daily_prices` (latest daily row per asset/provider policy).
- `latestTradePrice`: private runtime value derived from Parqet user activities.
- Hard rule: no private user-derived `latestTradePrice` persistence in public/reference DB tables.

### Explicitly not target table now

- `asset_latest_prices` is rejected as a normal persisted target table for this phase.
- Reason: latest market price is derived from `asset_daily_prices`; adding a separate persisted latest-price table is optional later optimization only if query/performance evidence requires it.

## 6) AssetEvent clarification

- `AssetEvent` is a domain/code umbrella term (per `docs/DOMAIN_LANGUAGE.md`).
- Database first target remains explicit event tables:
  - `dividend_events`
  - `corporate_action_events`
- No required `asset_events` DB table in first schema target.

### Optional later direction

- A shared base/event-union table can be considered later only if dedupe, provenance unification, or polymorphic event query pressure makes it necessary.

## 7) Price history scale strategy

### Growth risk

- `asset_daily_prices` remains the main volume driver (`assets * providers * trading days`).

### Primary query patterns

- latest daily price per asset/provider
- date-range history per asset
- admin coverage checks (has prices, latest date)

### Likely index/constraint direction

- uniqueness at `asset_id + provider + date`
- latest-read index on `(asset_id, provider, date desc)`
- provider/symbol/date path for operational diagnostics

### Deduplication + provenance

- idempotent upsert by unique keys
- normalized provider/symbol
- keep provenance columns (`source`, `imported_at`, provider/symbol context)

### Partitioning stance

- Not required now.
- Revisit with explicit thresholds (row count, table size, query latency, maintenance cost).

## 8) Implications for linked issues

### #395 market-price overlay

- Implement repository function/read model for latest market price derived from `asset_daily_prices`.
- Required fields: price amount, currency, date/timestamp, provider/source, freshness classification.
- No provider calls from rendering/UI.
- No silent substitution of `latestTradePrice` as market price.

### #397 currency/FX

- Native price currency lives on persisted daily price/event rows.
- Reporting-currency conversion is a later FX layer concern.
- Mixed-currency aggregates must remain explicit/guarded until FX exists.

### #396 transfer/cost-basis

- Cost basis remains activity-derived domain logic.
- Reference DB may provide corporate-action context inputs only.
- No persistence of private user transfer/trade values in reference tables.

### #398 source/timestamp/confidence

- Provenance fields should be explicit in price/event read models.
- Freshness/staleness/confidence must be query-visible and auditable.

## 9) Phase 4 implementation slices (revised)

### Slice 1: DB/model inventory and naming plan

- Purpose: lock naming and boundary decisions.
- Breakage acceptable: No (docs only).

### Slice 2B: target schema draft using revised table names

- Purpose: draft target schema naming plan with:
  - `assets`
  - `asset_symbol_mappings`
  - `asset_daily_prices`
  - `dividend_events`
  - `corporate_action_events`
  - `reference_data_sources`
  - `reference_data_import_runs`
  - `reference_data_import_run_items`
  - `reference_data_request_logs`
- Breakage acceptable: No runtime breakage; planning/spec only until migration slice is explicitly approved.

### Slice 3: repository/service rewrite to target names

- Purpose: move low-level naming/contracts from Instrument/market_data_* to Asset/reference_data_*.
- Breakage acceptable: No.

### Slice 4: latest market price read model for #395

- Purpose: derive latest market price from `asset_daily_prices` via query/repository function.
- Explicitly not: introducing `asset_latest_prices` as required persisted table.
- Breakage acceptable: No.

### Slice 5: dividend/corporate-action event split

- Purpose: split generic action model into `dividend_events` and `corporate_action_events`.
- Breakage acceptable: controlled migration behavior only.

### Slice 6: indexes/scale/dedupe strategy

- Purpose: enforce uniqueness, optimize latest/history queries, define partition trigger policy.
- Breakage acceptable: No.

### Slice 7: final audit

- Purpose: docs/contracts/tests alignment and final boundary checks.
- Breakage acceptable: No.

## 10) Non-goals

- No schema migration in this task.
- No runtime behavior/code changes in this task.
- No provider calls.
- No `SecurityLineage` implementation.
- No persistence of private user activity/trade prices in public/reference DB tables.
- No Instrument as target naming.
- No required target tables:
  - `asset_latest_prices`
  - `asset_events`

## API budget impact

None in this planning task. No Parqet API, yfinance, OpenFIGI, or other provider calls were executed.

## Privacy/data impact

None in this planning task. No private portfolio payloads/tokens/exports were used.
