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
- Keep normalized technical columns explicit: `provider`, `provider_symbol`, `currency`, `source_run_id`, timestamps.
- Price fields remain daily-bar oriented in `asset_daily_prices`.
- Event tables remain explicit (`dividend_events`, `corporate_action_events`) with type-specific columns.

### C) Low-level query/repository types

- Repository contracts migrate to Asset naming (`AssetRow`, `AssetSymbolMappingRow`, `AssetDailyPriceRow`, `DividendEventRow`, `CorporateActionEventRow`, `ReferenceDataImportRunRow`).
- Query/helper functions should use explicit names such as `getLatestDailyPriceByAsset` and `listDailyPricesByAssetRange`.

### D) Domain model names

- Use `Asset` / `GlobalAsset` as primary domain terms.
- `AssetEvent` remains domain umbrella term.
- `DividendEvent` and `CorporateActionEvent` remain explicit domain subtypes.

### E) API/ViewModel names

- Keep `GlobalAssetViewModel` naming for app/domain output.
- Runtime/API contracts must not reintroduce Instrument as target domain term.

### F) Import/script names

- Prefer `reference-data-*` naming over broad `market-data-*` where scripts/modules are touched in follow-up implementation.

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
| `market_reference_instruments` | staged into `assets` enrichment inputs | Reference rows feed asset identity enrichment; no Instrument target naming. |

## 5) Price concept clarification

- `asset_daily_prices`: persisted public/reference daily provider prices.
- `latestMarketPrice`: derived by query/repository function from `asset_daily_prices` (latest daily row per asset/provider policy).
- `latestTradePrice`: private runtime value derived from Parqet user activities.
- Hard rule: no private user-derived `latestTradePrice` persistence in public/reference DB tables.

### Explicitly not target table now

- `asset_latest_prices` is rejected as a normal persisted target table for this phase.
- Reason: latest market price is derived from `asset_daily_prices`; separate storage is optional later optimization only with measured query/perf evidence.

## 6) AssetEvent clarification

- `AssetEvent` is a domain/code umbrella term (per `docs/DOMAIN_LANGUAGE.md`).
- Database first target remains explicit event tables:
  - `dividend_events`
  - `corporate_action_events`
- No required `asset_events` DB table in first schema target.

### Optional later direction

- Shared base/event-union table can be considered later only if dedupe, provenance unification, or polymorphic event query pressure requires it.

## 7) Target schema draft

### 7.1 `assets`

Proposed columns:

- `id` (uuid, pk)
- `asset_key_type` (text, not null) 
- `asset_key_value` (text, not null)
- `isin` (text, nullable)
- `wkn` (text, nullable)
- `display_name` (text, nullable)
- `asset_type` (text, nullable)
- `currency` (text, nullable)
- `exchange` (text, nullable)
- `created_at` (timestamptz, not null, default now)
- `updated_at` (timestamptz, not null, default now)

Constraints and keys:

- Primary key: `id`.
- Unique: `(asset_key_type, asset_key_value)`.
- Unique where present: `isin` (partial unique index on non-null ISIN).
- Nullable: `isin`, `wkn`, `display_name`, `asset_type`, `currency`, `exchange`.

Relationships:

- `assets.id` referenced by:
  - `asset_symbol_mappings.asset_id`
  - `asset_daily_prices.asset_id`
  - `dividend_events.asset_id`
  - `corporate_action_events.asset_id`
  - `reference_data_import_run_items.asset_id` (nullable)

Notes:

- `asset_key_*` allows stable identity even when ISIN is missing/invalid/legacy.
- `isin` remains first-class for current overlays and admin workflows.

### 7.2 `asset_symbol_mappings`

Proposed columns:

- `id` (uuid, pk)
- `asset_id` (uuid, not null, fk -> `assets.id`)
- `provider` (text, not null)
- `provider_symbol` (text, not null)
- `exchange` (text, nullable)
- `currency` (text, nullable)
- `is_primary` (boolean, not null, default false)
- `is_active` (boolean, not null, default true)
- `verified_at` (timestamptz, nullable)
- `created_at` (timestamptz, not null, default now)
- `updated_at` (timestamptz, not null, default now)

Uniqueness strategy:

- Unique mapping identity: `(provider, provider_symbol, coalesce(exchange,''))`.
- Additional guard: `(asset_id, provider, provider_symbol, coalesce(exchange,''))`.
- Optional policy index for one active primary per `(asset_id, provider)` via partial unique index on `is_primary=true and is_active=true`.

### 7.3 `asset_daily_prices`

Proposed columns:

- `id` (uuid, pk)
- `asset_id` (uuid, not null, fk -> `assets.id`)
- `provider` (text, not null)
- `price_date` (date, not null)
- `price_timestamp` (timestamptz, nullable)
- `open_price` (numeric, nullable)
- `high_price` (numeric, nullable)
- `low_price` (numeric, nullable)
- `close_price` (numeric, not null)
- `adjusted_close_price` (numeric, nullable)
- `volume` (numeric, nullable)
- `currency` (text, nullable)
- `source_run_id` (uuid, nullable, fk -> `reference_data_import_runs.id`)
- `created_at` (timestamptz, not null, default now)
- `updated_at` (timestamptz, not null, default now)

Constraints and indexes:

- Unique: `(asset_id, provider, price_date)`.
- Index (latest lookup): `(asset_id, provider, price_date desc)`.
- Index (range history): `(asset_id, price_date)`.
- Optional operational index: `(provider, price_date desc)` for provider backfill audits.

Scale strategy:

- Designed for 100k to multi-million rows with append/upsert pattern.
- Keep latest query index and bounded range queries as default.
- Partitioning deferred until thresholds are exceeded (table size, vacuum pressure, query latency).

`latestMarketPrice` derivation:

- Derived by repository function selecting latest row per asset/provider policy from `asset_daily_prices`.
- No required `asset_latest_prices` table in first target.

### 7.4 `dividend_events`

Proposed columns:

- `id` (uuid, pk)
- `asset_id` (uuid, not null, fk -> `assets.id`)
- `provider` (text, not null)
- `ex_date` (date, nullable)
- `pay_date` (date, nullable)
- `record_date` (date, nullable)
- `declaration_date` (date, nullable)
- `amount` (numeric, nullable)
- `currency` (text, nullable)
- `source_run_id` (uuid, nullable, fk -> `reference_data_import_runs.id`)
- `confidence` (text or numeric enum-scale, nullable)
- `created_at` (timestamptz, not null, default now)
- `updated_at` (timestamptz, not null, default now)

Constraints/indexes:

- Dedup unique candidate: `(asset_id, provider, ex_date, amount, coalesce(currency,''))` where `ex_date` is not null.
- Index for timeline reads: `(asset_id, ex_date desc)`.

Boundary note:

- This table stores public/reference dividend events only.
- Private Parqet dividend activities remain in runtime activity model and are not persisted here.

### 7.5 `corporate_action_events`

Proposed columns:

- `id` (uuid, pk)
- `asset_id` (uuid, not null, fk -> `assets.id`)
- `provider` (text, not null)
- `action_type` (text, not null) 
- `effective_date` (date, nullable)
- `announced_date` (date, nullable)
- `ratio_from` (numeric, nullable)
- `ratio_to` (numeric, nullable)
- `cash_component` (numeric, nullable)
- `currency` (text, nullable)
- `successor_asset_id` (uuid, nullable, fk -> `assets.id`)
- `source_run_id` (uuid, nullable, fk -> `reference_data_import_runs.id`)
- `confidence` (text or numeric enum-scale, nullable)
- `created_at` (timestamptz, not null, default now)
- `updated_at` (timestamptz, not null, default now)

Constraints/indexes:

- Dedup unique candidate: `(asset_id, provider, action_type, effective_date, coalesce(successor_asset_id::text,''))`.
- Index timeline: `(asset_id, effective_date desc)`.
- Index successor traversal: `(successor_asset_id)`.

Action direction support:

- Supports split/reverse-split via `ratio_from`/`ratio_to`.
- Supports merger/spin-off linkage via `successor_asset_id` and optional cash component.

### 7.6 `reference_data_sources`

Proposed columns:

- `id` (uuid, pk)
- `provider` (text, not null)
- `source_name` (text, not null)
- `source_type` (text, not null)
- `source_reference` (text, nullable) 
- `priority` (integer, nullable)
- `reliability` (text or numeric scale, nullable)
- `created_at` (timestamptz, not null, default now)
- `updated_at` (timestamptz, not null, default now)

Constraints/indexes:

- Unique: `(provider, source_name)`.

### 7.7 `reference_data_import_runs`

Proposed columns:

- `id` (uuid, pk)
- `source_id` (uuid, not null, fk -> `reference_data_sources.id`)
- `import_type` (text, not null)
- `status` (text, not null)
- `started_at` (timestamptz, nullable)
- `finished_at` (timestamptz, nullable)
- `requested_by` (text, nullable)
- `parameters_json` (jsonb, nullable)
- `summary_json` (jsonb, nullable)
- `created_at` (timestamptz, not null, default now)

Constraints/indexes:

- Index by operational recency: `(created_at desc)`.
- Index by status: `(status, created_at desc)`.
- Index by source: `(source_id, created_at desc)`.

### 7.8 `reference_data_import_run_items`

Proposed columns:

- `id` (uuid, pk)
- `run_id` (uuid, not null, fk -> `reference_data_import_runs.id`)
- `asset_id` (uuid, nullable, fk -> `assets.id`)
- `provider_symbol` (text, nullable)
- `item_type` (text, not null)
- `status` (text, not null)
- `message` (text, nullable)
- `raw_payload_reference` (text, nullable)
- `raw_payload_hash` (text, nullable)
- `created_at` (timestamptz, not null, default now)

Constraints/indexes:

- Index by run: `(run_id, created_at)`.
- Index by status: `(status, created_at desc)`.
- Optional dedupe guard: `(run_id, item_type, coalesce(provider_symbol,''), coalesce(raw_payload_hash,''))`.

### 7.9 `reference_data_request_logs`

Proposed columns:

- `id` (uuid, pk)
- `source_id` (uuid, nullable, fk -> `reference_data_sources.id`)
- `provider` (text, not null)
- `request_type` (text, not null)
- `request_key` (text, not null)
- `status` (text, not null)
- `requested_at` (timestamptz, not null)
- `duration_ms` (integer, nullable)
- `error_message` (text, nullable)
- `response_hash` (text, nullable)
- `cache_key` (text, nullable)

Constraints/indexes:

- Index by recency: `(requested_at desc)`.
- Index by lookup key: `(provider, request_type, request_key, requested_at desc)`.
- Optional bounded dedupe/log-compaction policy by `(provider, request_type, request_key, response_hash)`.

## 8) Index strategy (critical)

- `assets`: unique identity index `(asset_key_type, asset_key_value)` and partial unique `isin`.
- `asset_symbol_mappings`: unique provider symbol identity and active-primary policy index.
- `asset_daily_prices`: unique `(asset_id, provider, price_date)` plus `(asset_id, provider, price_date desc)` for #395 latest lookup.
- `dividend_events`: `(asset_id, ex_date desc)` and dedupe candidate unique keys.
- `corporate_action_events`: `(asset_id, effective_date desc)` and successor index.
- Operational tables: recency/status indexes for run/run-items/request logs.

## 9) Dedupe strategy

- Normalize provider and symbols before writes.
- Use deterministic upsert keys for prices/events.
- Keep `source_run_id` and hashes/references for replay diagnostics.
- Treat dividend/corporate-action dedupe keys separately to avoid mixed-semantics collisions.

## 10) Migration strategy (no migration execution in this task)

High-level staged strategy:

1. Create target tables in parallel with current tables.
2. Backfill `assets` from `market_instruments` using ISIN-first identity.
3. Backfill mapping table (`asset_symbol_mappings`) by joining old `instrument_id -> assets.id`.
4. Backfill price history (`asset_daily_prices`) preserving provider/date/value and provenance (run id mapping where possible).
5. Split `market_actions` into `dividend_events` and `corporate_action_events` based on `action_type` mapping rules.
6. Backfill `reference_data_sources`, `reference_data_import_runs`, `reference_data_import_run_items`, `reference_data_request_logs` from current operational tables.
7. Add compatibility read adapters; cut over repository queries.
8. Deprecate old tables only after parity checks.

## 11) Backfill strategy for `asset_id`

- Primary keying path: `market_instruments.isin` -> `assets.isin`.
- Fallback path for non-standard identity: populate `asset_key_type`/`asset_key_value` from best available stable identifier.
- For symbol-only rows, map via `market_symbol_mappings` with deterministic provider+symbol+exchange policy.
- Maintain mapping ledger during migration (`old_instrument_id` -> `new_asset_id`) for reversible validation.

## 12) Data retention strategy

- `reference_data_import_runs`: keep medium-term operational history (for audit/incident timelines).
- `reference_data_import_run_items`: retain detailed rows for shorter window than runs; archive or purge by age/volume thresholds.
- `reference_data_request_logs`: shortest retention window with aggregation/compaction; keep error/slow-request tails longer.
- `asset_daily_prices`, `dividend_events`, `corporate_action_events`: long-lived reference dataset (subject to provider/data-quality policies).

## 13) Privacy boundary (target)

- No private Parqet user activities or per-user trade prices in target reference-data tables.
- `latestTradePrice` remains runtime/private calculation context.
- Only public/reference provider-derived data is persisted in target schema tables.

## 14) Risks and open decisions

Key risks:

- Identity drift for non-ISIN assets during backfill.
- Ambiguous symbol mappings across exchanges/providers.
- Action split quality from generic `market_actions.action_type` values.
- Query performance regressions during dual-write/dual-read transition.

Open decisions:

- Exact enum constraints for `asset_key_type`, `import_type`, `status`, `action_type`, `confidence`.
- Whether request logs store payload hashes only or payload references in external storage.
- Partition threshold triggers for `asset_daily_prices` and event tables.

## 15) Required before #395 vs can wait

Required before #395 market-price overlay:

- `assets` and `asset_symbol_mappings` identity/mapping baseline.
- `asset_daily_prices` table shape and unique/index strategy.
- Repository function contract for latest market price derived from `asset_daily_prices`.
- Provenance/freshness fields needed by valuation overlay output.

Can wait until later slices:

- Full `dividend_events` and `corporate_action_events` enrichment completeness.
- Expanded retention/archiving automation.
- Optional polymorphic event-base design discussion.
- Any optimization table equivalent to `asset_latest_prices` (only if later performance evidence demands it).

## 16) Implications for linked issues

### #395 market-price overlay

- Implement latest-market-price read model from `asset_daily_prices` only.
- Required fields: price amount, currency, date/timestamp, provider/source, freshness/staleness classification.
- No provider calls from rendering/UI.
- No silent substitution of `latestTradePrice` as market price.

### #397 currency/FX

- Native price currency lives on persisted daily price/event rows.
- Reporting-currency conversion remains a later FX layer concern.
- Mixed-currency aggregates remain explicit/guarded until FX implementation.

### #396 transfer/cost-basis

- Cost basis remains activity-derived domain logic.
- Reference DB provides corporate-action context inputs only.
- No persistence of private user transfer/trade values in reference tables.

### #398 source/timestamp/confidence

- Provenance fields (`source_run_id`, provider/source references, timestamps, confidence) are first-class in the schema draft.

## 17) Phase 4 implementation slices (revised)

### Slice 1: DB/model inventory and naming plan

- Purpose: lock naming and boundary decisions.
- Breakage acceptable: No (docs only).

### Slice 2B: target schema draft using revised table names

- Purpose: define concrete target schema shape for:
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

## 18) Non-goals

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

## 19) Implementation status: first schema slice (PR #399)

- Implemented as additive migration: `006_asset_reference_data_schema.sql`.
- Added target tables and indexes for:
  - `assets`
  - `asset_symbol_mappings`
  - `asset_daily_prices`
  - `dividend_events`
  - `corporate_action_events`
  - `reference_data_sources`
  - `reference_data_import_runs`
  - `reference_data_import_run_items`
  - `reference_data_request_logs`
- Explicitly not created:
  - `asset_latest_prices`
  - `asset_events`

Intentional transition/breakage note:

- Legacy tables (`market_*`) are intentionally retained in this slice.
- Runtime/API/admin repository code still reads legacy tables until Slice 3 query rewrite and cutover.
- During transition, dual-schema coexistence is expected; this is intentional and documented.

## 20) Implementation status: Slice 4 latestMarketPrice read contract (PR #399)

Implemented repository functions (Asset-oriented, new schema):

- `findAsset(input)`:
  - resolves `assets` identity by:
    - `{ isin }`, or
    - `{ assetKeyType, assetKeyValue }`
- `findLatestMarketPriceByAssetKey(input)`:
  - derives latest market price from `asset_daily_prices`
  - key input: `assetKeyType + assetKeyValue` (optional provider filter)
- `findLatestMarketPricesByAssetKeys(input)`:
  - bulk latest-market-price read for many keys
  - returns a keyed snapshot map for efficient multi-asset lookup

Implemented service helpers:

- `getLatestMarketPriceByIsin({ isin, provider? })`
- `getLatestMarketPricesByIsins({ isins, provider? })`

Snapshot shape returned by latest-market-price reads:

- `assetId`
- `assetKeyType`
- `assetKeyValue`
- `isin`
- `provider`
- `priceAmount`
- `currency`
- `priceDate`
- `priceTimestamp`
- `updatedAt`

Hard boundary reaffirmed:

- latest-market-price is derived from `asset_daily_prices` only.
- No `asset_latest_prices` persisted table was introduced.
- No private/user runtime `latestTradePrice` persistence was introduced in reference-data tables.

## 21) Migration 006 local validation note

Manual local validation was performed by the user via:

- `npm run db:market:migrate`

Observed migration execution order:

1. `001_market_data.sql`
2. `002_market_reference_instruments.sql`
3. `003_market_instrument_display_metadata.sql`
4. `004_market_instrument_status.sql`
5. `005_market_data_requests.sql`
6. `006_asset_reference_data_schema.sql`

Result:

- Migration run completed successfully.
- New target tables are present in local DB:
  - `assets`
  - `asset_symbol_mappings`
  - `asset_daily_prices`
  - `dividend_events`
  - `corporate_action_events`
  - `reference_data_sources`
  - `reference_data_import_runs`
  - `reference_data_import_run_items`
  - `reference_data_request_logs`
- Legacy transition tables remain present (expected staged cutover):
  - `market_actions`
  - `market_data_requests`
  - `market_data_run_items`
  - `market_data_runs`
  - `market_instruments`
  - `market_prices_daily`
  - `market_reference_instruments`
  - `market_reference_sources`
  - `market_symbol_mappings`

Release recommendation status:

- Local/test validation is successful.
- Production migration rollout is still not recommended until repository/service cutover and transition checks are stable.

## 22) Legacy-to-target backfill script (Phase 4)

Script:

- `npm run db:market:backfill:asset-reference`
- dry-run: `npm run db:market:backfill:asset-reference -- --dry-run`

File:

- `scripts/backfill-asset-reference-data.mjs`

Behavior:

- Idempotent legacy-to-target upsert/copy flow from `market_*` to new Asset/reference-data tables.
- Default mode writes and commits.
- `--dry-run` executes the same mapping/upsert logic inside one DB transaction and rolls it back.
- Legacy tables are never dropped, truncated, or mutated.

Implemented source -> target mapping:

- `market_instruments` -> `assets` (`asset_key_type='isin'`, `asset_key_value=isin`)
- `market_symbol_mappings` -> `asset_symbol_mappings`
- `market_prices_daily` -> `asset_daily_prices`
- `market_reference_sources` -> `reference_data_sources`
- `market_data_runs` -> `reference_data_import_runs` (legacy summary mapped to `summary_json`)
- `market_data_run_items` -> `reference_data_import_run_items`
- `market_data_requests` -> `reference_data_request_logs` (as `parqet_runtime` / `asset_discovery`)
- `market_actions` -> `dividend_events` (dividend/capital_gain) and `corporate_action_events` (split/reverse_split/merger/spin_off/spinoff/corporate_action) when date is present

Conservative unresolved/skip rules:

- Rows that cannot be mapped to a safe `assets` identity are skipped and counted.
- `market_actions` rows with unknown `action_type` are skipped and counted.
- `market_actions` rows with classification but missing date are skipped and counted.
- `market_reference_instruments` rows without valid ISIN are counted as unresolved; no synthetic asset identities are created.

Transition note:

- Backfill exists to populate new tables for staged cutover/parity checks.
- Legacy `market_*` tables remain in place until repository/admin/runtime parity is verified.

## 23) Runtime price-read cutover after dropping `market_prices_daily`

Status: first runtime cutover step implemented on PR #399.

Context:

- `public.market_prices_daily` was intentionally dropped after local parity/backfill validation and Supabase cleanup.
- `public.asset_daily_prices` is the active persisted public/reference daily-price table.
- Legacy admin surfaces may still present `market_instruments` rows during transition, but price availability/history is resolved through normalized ISIN -> `assets` -> `asset_daily_prices`.

Implemented cutover:

- Repository/admin price reads that previously queried `market_prices_daily` now read `asset_daily_prices`.
- Historical price reads by ISIN preserve the existing app-facing price-point shape while selecting:
  - `price_date`
  - `open_price`
  - `high_price`
  - `low_price`
  - `close_price`
  - `adjusted_close_price`
  - `volume`
  - `currency`
  - `updated_at` as the legacy-shaped import timestamp
- Active daily-price writes now upsert `assets`, `asset_symbol_mappings`, and `asset_daily_prices`.
- `latestMarketPrice` remains derived from `asset_daily_prices`; no `asset_latest_prices` table was introduced.

Historical/backfill note:

- `scripts/backfill-asset-reference-data.mjs` remains a historical one-shot transition script.
- It now tolerates a missing `public.market_prices_daily` table and skips the historical price-copy stage when that table has already been dropped.

Non-goals preserved:

- No PRM valuation overlay implementation.
- No provider calls.
- No additional legacy table drops.
- No persistence of private Parqet user activity or `latestTradePrice` in reference-data tables.
