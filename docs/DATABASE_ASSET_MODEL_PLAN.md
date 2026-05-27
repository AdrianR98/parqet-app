# Database Asset Model Plan (Phase 4)

Status: planning baseline (no schema/runtime changes)
Linked issues: Refs #384, Refs #388, Refs #395, Refs #396, Refs #397, Refs #398
Branch rule: all Phase 4 tasks stay on `refactor/phase-4-database-asset-model` (same branch, no new PR)

## 1) Current DB / market-data inventory

### Table/entity/module inventory

| Current name | Current purpose | Current domain term | Main fields (visible) | Current read/write paths | Current consumers | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `market_instruments` | Core market identity + display metadata + status flags keyed by ISIN | Instrument (legacy) | `id`, `isin` (unique), `name`, `display_name`, `asset_type`, `currency`, `wkn`, `metadata_source`, `name_source`, `display_name_source`, `market_data_status`, successor fields, timestamps | Read/write via `src/lib/market-data/db/repository-core.ts`; upsert in runtime unknown-request path and admin/CLI import flows | `/api/parqet/assets` overlay, `/api/market-data/history`, admin status/instruments/unmapped | Medium |
| `market_symbol_mappings` | Provider symbol binding to instrument | Instrument mapping (legacy) | `instrument_id`, `provider`, `symbol`, `exchange`, `currency`, `is_primary`, `is_active`, `verified_at`, `notes`; unique `(provider,symbol)` and `(instrument_id,provider,symbol)` | Read/write in repository and scripts (`promote`, `transfer`, `add candidate`, manual import) | history API symbol resolution, admin mappings/unmapped/status | High (global uniqueness + provider dependence) |
| `market_prices_daily` | Daily OHLCV history | Instrument price history (legacy) | `instrument_id`, `provider`, `symbol`, `date`, `open/high/low/close/adj_close`, `volume`, `currency`, `source`, `imported_at`; PK `(instrument_id,provider,date)` | Upsert by backfill/incremental/json import; read via history service and admin overviews | `/api/market-data/history`, admin mappings/instruments/status | High (growth + latest query cost) |
| `market_actions` | Generic market actions including dividends/splits | Instrument action history (legacy) | `instrument_id`, `provider`, `symbol`, `action_type`, `date`, `amount`, `ratio`, `currency`, `source`, `imported_at`; PK `(instrument_id,provider,action_type,date)` | Upsert by imports/incremental; read in history service/admin | `/api/market-data/history` (currently dividend-only projection), admin status/instruments/unmapped | High (mixed event semantics) |
| `market_data_runs` | Import run header/provenance | Run/provenance | `id`, `provider`, `run_type`, `status`, `started_at`, `finished_at`, counters, `error_message` | Create/finish in scripts and repository helpers | admin runs | Low |
| `market_data_run_items` | Per-symbol result for a run | Run item/provenance | `run_id`, `instrument_id`, `provider`, `symbol`, `status`, imported counters, first/last date, error | Write in scripts/repo; read in admin runs query | admin runs | Low |
| `market_data_requests` | Runtime queue of unknown ISINs seen in user flow | Request queue | `isin` (unique), metadata snapshots, `seen_count`, `status`, `source`, timestamps | Written best-effort from `/api/parqet/assets` via `recordUnknownMarketDataRequestsFromAssets`; read in admin requests | admin requests + operator workflow | Medium |
| `market_reference_sources` | Metadata source registry (trading universe, imports) | Reference source | `source_key`, `display_name`, `source_type`, file/row metadata | Written by import/sync tooling; read in status summary | admin status | Low |
| `market_reference_instruments` | Imported reference universe rows | Reference instrument (legacy wording) | ISIN/WKN/name/symbol/mnemonic/exchange/MIC/type/category/segment/raw payload | Written by reference import scripts and enrichment helpers | enrichment flows, status reporting | Medium |

### Additional module inventory (non-table)

| Module | Current purpose | Current term use | Risk |
| --- | --- | --- | --- |
| `src/lib/market-data/service.ts` | DB-only history API orchestration; resolves primary mapping, reads daily prices/actions | Instrument-first naming in messages and contracts | Medium |
| `src/lib/market-data/runtime-requests.ts` | Builds unknown-ISIN request candidates from runtime assets | Asset input -> Instrument DB rows | Medium |
| `src/lib/market-data/db/admin-*.ts` + admin routes | Read-only admin filtering/triage/status | Instrument/mapping terminology | Low |
| `scripts/*market-data*.mjs` + `scripts/yfinance/*` | Provider export/import/validation/backfill/update workflows | Instrument terms, provider-centric | Medium |

### Visible index/query pattern inventory

- `market_instruments`: unique ISIN lookups dominate (`getInstrumentByIsin`, joins by `id`).
- `market_symbol_mappings`: provider/symbol uniqueness, primary/active selection, verified scans.
- `market_prices_daily`: time-series scans by `(instrument_id, provider, date)` and latest-date queries.
- `market_actions`: scans by `(instrument_id, provider, date)` and action-type filtering.
- Admin overview queries currently materialize broad CTE aggregates without pagination at SQL level, then API-layer filter/slice.

## 2) Current data flow

### Provider/import flow into DB

1. Operator/admin workflow selects mapped symbols (`market_symbol_mappings`, mostly `yfinance`).
2. `scripts/yfinance/export-history.py` fetches prices/actions.
3. JSON import or incremental/backfill scripts call repository upserts.
4. Upserts write `market_prices_daily` + `market_actions`; run provenance written to `market_data_runs` + `market_data_run_items`.
5. Mapping/validation workflows update `market_symbol_mappings` (verified, primary, notes/status).

### DB read flow into admin

- `/api/admin/market-data/status` -> summary CTE counts + reference source counts.
- `/api/admin/market-data/instruments` -> instrument overview with primary mapping and latest/first/last prices.
- `/api/admin/market-data/mappings` -> mapping overview + latest per-symbol close.
- `/api/admin/market-data/unmapped` -> triage list for missing/failed/unverified/legacy/derivative candidates.
- `/api/admin/market-data/requests` -> unknown ISIN queue from runtime sightings.
- `/api/admin/market-data/runs` -> run/run-item operational provenance.

### DB read flow into API/dashboard/PRM

- `/api/market-data/history` reads via `getMarketDataHistory` (DB-only).
- `/api/parqet/assets` reads instrument metadata + primary mappings for overlay and records unknown requests best-effort.
- PRM/dashboard valuation still primarily runtime-derived; market DB currently enriches identity/display and history endpoints, not canonical valuation metrics.

### Privacy boundary

- Private user portfolio/activity data remains in Parqet runtime pipeline and browser/server runtime caches.
- Public/reference market data is stored in server-side market-data DB tables above.
- Runtime unknown-request queue stores only ISIN + lightweight metadata hints, not private activity payloads.

## 3) Target Asset-oriented terminology

Current `Instrument` naming remains for legacy documentation of current state only. Target naming for Phase 4 storage model:

- `asset_identities` (target for `market_instruments`)
- `asset_symbol_mappings` (target for `market_symbol_mappings`)
- `asset_daily_prices` (target for `market_prices_daily`)
- `asset_dividend_events` (split from current generic action table)
- `asset_corporate_action_events` (split for split/merge/capital events)
- optional umbrella `asset_events` read model (normalized event stream view/table if needed)
- `market_import_runs` + `market_import_run_items` (rename of run provenance tables)
- `market_price_observations` (or fields inside daily table) with explicit provenance fields:
  - `price_source_provider`
  - `price_source_symbol`
  - `price_source_exchange`
  - `source_event_time` / `as_of_time`
  - `imported_at`
  - `source_confidence` / `validation_status`

## 4) Price history scale strategy

### Expected growth

- Daily bars scale linearly with `asset_count * provider_count * trading_days`.
- With multi-year retention and expanding universe, `market_prices_daily` becomes dominant table volume.

### Primary query patterns

- latest price per asset/provider/symbol
- range history by asset + period
- admin scans for coverage gaps (has prices / latest date)

### Index and constraint direction

- Keep uniqueness at asset-provider-date granularity (`asset_id`, `provider`, `date`).
- Add/keep latest-read friendly index on `(asset_id, provider, date desc)`.
- Keep provider/symbol/date access path for operational checks.
- Consider partial index for active primary mappings in mapping table.

### Deduplication strategy

- Upserts remain idempotent by unique keys.
- Normalize provider/symbol casing before write.
- Preserve `source` + import timestamp for provenance and debugging.

### Partitioning decision

- Not required in first Phase 4 slice.
- Add partitioning trigger criteria (row count/size/query latency thresholds) and prepare migration path.
- Candidate later strategy: range partition by `date` (year/quarter) with local indexes.

### Latest-price cache/read model

- Add explicit latest-price read model (table or SQL view/materialized view) keyed by asset/provider.
- Use it for overlay/valuation reads to avoid repeated `max(date)` scans.
- Refresh on ingest (transactional upsert hook or scheduled refresh), never via UI-triggered provider calls.

## 5) Market-price overlay implications (#395)

### Required DB read contract

Create a dedicated repository function/read model for "latest market price per Asset/ISIN" returning:

- `assetId` / `isin`
- `priceAmount`
- `priceCurrency`
- `priceDate` and optional `priceTimestamp`
- `provider` / `source`
- freshness classification (`fresh`, `stale`, `missing`, `unknown`)

### PRM valuation field requirements

PRM valuation overlay should consume explicit fields only:

- price amount
- currency
- date/timestamp
- provider/source
- freshness/staleness classification

### Guardrails

- No provider calls from UI/rendering.
- No silent `latestTradePrice -> marketPrice` substitution.
- Missing market price must remain explicit (`missing`/`stale`) and auditable.

## 6) Currency/FX implications (#397)

- Native market price currency remains stored at price/event level (`currency`) and optionally asset identity default currency.
- Future reporting-currency conversion should live in a separate FX layer/read model, not by mutating native price history.
- Until FX is implemented:
  - keep mixed-currency metrics explicitly labeled,
  - block or mark aggregates that would imply converted totals,
  - avoid pseudo-conversion using latest trade currency assumptions.

## 7) Transfer/cost-basis implications (#396)

- Cost basis remains activity-derived domain logic (Phase 3 boundaries), not market-price-table derived.
- DB may need reference corporate-action metadata (split ratios/effective dates/successor hints) to support consistent transfer/cost-basis interpretation.
- Transfer matching itself stays activity-derived; market DB should provide only reference context inputs.

## 8) Phase 4 implementation slices (same branch/PR thread)

### Slice 1: DB/model inventory and naming plan

- Purpose: lock current inventory + target asset terminology and boundaries.
- Likely files: `docs/DATABASE_ASSET_MODEL_PLAN.md`, `docs/PROJECT_STATUS.md`, optional boundary docs.
- Risk: Low.
- Verification: targeted `rg` inventory + doc review.
- Breakage acceptable: No (docs only).

### Slice 2: repository/query naming cleanup

- Purpose: introduce Asset-oriented repository naming and adapter layer while preserving behavior.
- Likely files: `src/lib/market-data/db/repository*.ts`, `types-core.ts`, admin db modules.
- Risk: Medium.
- Verification: targeted typecheck/tests for touched modules.
- Breakage acceptable: No.

### Slice 3: latest market price read model / overlay interface

- Purpose: establish canonical latest-price query contract for #395.
- Likely files: market-data repository/service/history overlay modules, PRM integration adapters.
- Risk: High.
- Verification: query-level tests + route contract checks.
- Breakage acceptable: No.

### Slice 4: event model split direction (`DividendEvent` / `CorporateActionEvent` / `AssetEvent`)

- Purpose: separate event semantics from generic `market_actions`.
- Likely files: schema planning docs + repository/event read-model modules.
- Risk: High.
- Verification: backfill/dedup checks + event projection tests.
- Breakage acceptable: Controlled internal breakage only behind migration plan.

### Slice 5: indexes/scale/dedupe strategy

- Purpose: optimize growth path and latest-price reads.
- Likely files: migration plans (future), repository SQL, admin status metrics.
- Risk: Medium-High.
- Verification: explain-plan/perf checks in staging data.
- Breakage acceptable: No for runtime contracts; migration windows planned.

### Slice 6: docs/tests/final audit

- Purpose: close Phase 4 with aligned docs, naming, and validation coverage.
- Likely files: docs + tests around market-data repository/service contracts.
- Risk: Medium.
- Verification: full targeted verification suite for touched areas.
- Breakage acceptable: No.

## 9) Non-goals

- No `SecurityLineage` implementation.
- No UI lineage toggle.
- No global Instrument rename outside DB/market-data scope unless explicitly planned.
- No provider calls from rendering/UI routes.
- No private user activity persistence in market-data reference tables.

## API budget impact

None in this planning task. No Parqet API, yfinance, OpenFIGI, or other provider calls were executed.

## Privacy/data impact

None in this planning task. No private portfolio payloads/tokens/exports were used.
