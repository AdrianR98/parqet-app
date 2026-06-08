# Market Data Pipeline (Admin/CLI Workflow)

Status: current operator source of truth

## Runtime Boundary

Runtime market-history reads are DB-only.

- Route: `src/app/api/market-data/history/route.ts`
- Service: `src/lib/market-data/service.ts`

Runtime does not call yfinance or OpenFIGI.

Provider calls are restricted to explicit Admin/CLI workflows.

## Current Provider Strategy

- Primary provider workflow: yfinance (validation/backfill/incremental update).
- OpenFIGI: optional candidate lookup/admin workflow.
- FX conversion remains deferred. The current market-data policy prefers verified yfinance `.DE` mappings as the primary mapping where available instead of introducing a full FX engine in this slice.

## Current Market-Data Tables

- `assets`
- `asset_symbol_mappings`
- `asset_daily_prices`
- `dividend_events`
- `corporate_action_events`
- `reference_data_sources`
- `reference_data_import_runs`
- `reference_data_import_run_items`
- `reference_data_request_logs`
- `reference_data_asset_candidates`

Current migrations:

- `001_asset_reference_data_baseline.sql`

## Market Actions Scope

`dividend_events` and `corporate_action_events` store the current public/reference event data.
Current runtime/UI history exposure is dividend-focused.
Corporate-action/lineage expansion is future work.

## Normal Workflow

The normal operator workflow is reduced to four commands:

1. `npm run db:market:doctor`
2. `npm run db:market:resolve-primary`
3. `npm run db:market:rebuild-prices -- --write --reset-yfinance-prices --continue-on-error --compact`
4. `npm run db:market:update-prices`

Principles:

- `asset_symbol_mappings` is the source of truth for which ticker is used.
- `asset_daily_prices` is treated as rebuildable cache.
- Runtime market-data reads stay DB-only.
- Shell / merger / ISIN-lineage / symbol-ownership conflicts stay `manual_review` and are not auto-resolved.

## Operator Commands

### `db:market:doctor`

Read-only health and audit command.

- Default mode is DB-only.
- Wraps the current status and quality audit view.
- Answers:
  - missing or unhealthy primary mappings
  - remaining non-DE / non-EUR primaries
  - price currency inconsistencies
  - stale / short / gappy histories
  - manual-review cases
  - terminal / legacy / derivative / excluded cases

Useful flags:

- `--all`
- `--isin <ISIN>`
- `--symbol <SYMBOL>`
- `--currency <CURRENCY>`

### `db:market:resolve-primary`

Primary ticker decision workflow.

- Default mode is dry-run and DB-only.
- Default path reuses the current `.DE` primary-preference planner.
- `--validate` switches into the explicit candidate-validation / discovery path.
- `--write` is forwarded to the selected underlying workflow and remains explicit.
- Conflict-heavy cases such as Shell / `R6C0.DE` remain manual review.

### `db:market:rebuild-prices`

Full price-cache rebuild from current primary mappings.

- Default mode is dry-run only and provider-call-free.
- Dry-run reuses the current primary backfill planner with `--force`.
- Destructive write is guarded and requires `--write` plus `--reset-prices` or `--reset-yfinance-prices`.
- Reset deletes yfinance `asset_daily_prices` rows for the selected primary-mapping scope before full-history import.
- `--compact` and `--continue-on-error` are accepted at the operator entrypoint.

### `db:market:update-prices`

Incremental price update from current primary mappings.

- Thin alias for the current incremental primary update workflow.
- Default mode is dry-run only.

## `.DE` Primary Preference Workflow

- Stage 1: discover / validate / store `.DE` yfinance candidates.
- Stage 2: prefer verified `.DE` candidates as primary mappings, with explicit full-history replacement when the primary ticker changes.

### Stage 1: Discover / Validate / Store `.DE` Candidates

- Command: `npm run db:market:discover-de-candidates`
- Default mode is dry-run only.
- Dry-run is DB-only analysis:
  - no DB mutation
  - no provider calls
  - reports assets that still have no verified `.DE` yfinance mapping
  - shows existing yfinance mappings, Xetra/trading-universe/reference rows, and derived unverified `.DE` proposals
- `--validate` enables explicit yfinance validation for derived proposals.
- `--write` without `--validate` may store only unverified candidate proposals.
- `--write --validate` may store verified `.DE` candidates, but does not switch them primary.
- Candidate discovery must not invent verified `.DE` mappings from guesses. Validation stays explicit and primary switching stays separate.

### Stage 2: Prefer Verified `.DE` Primaries

- Command: `npm run db:market:prefer-de-primary`
- Default mode is dry-run only.
- Dry-run is DB-only analysis:
  - no DB mutation
  - no provider calls
  - clear switch report including required history replacement
- `--write` may switch primary mappings only when the change is safe without destructive history replacement.
- `--write --replace-history` is required when the primary yfinance ticker changes and old price rows already exist.

### Replacement Rule On Primary Ticker Switch

- If the selected primary yfinance ticker changes, old history in `asset_daily_prices` must be physically deleted and replaced with a full fresh history for the new ticker.
- No soft delete, inactive flag, superseded flag or mixed old/new history is allowed.
- The current schema does not store the original yfinance symbol on each `asset_daily_prices` row, so destructive replacement is keyed by `asset_id + provider`.
- Safe write sequence:
  1. build the switch plan
  2. fetch full replacement history for the new `.DE` ticker
  3. abort without mutation if the replacement fetch fails or is empty
  4. switch the primary mapping
  5. delete old `asset_daily_prices` rows for the affected asset/provider
  6. insert the full replacement history
  7. verify the latest price can be derived from the replacement history

### Usage

- Doctor / audit: `npm run db:market:doctor`
- Resolve current verified primary plan: `npm run db:market:resolve-primary`
- Resolve with explicit candidate validation: `npm run db:market:resolve-primary -- --validate`
- Dry-run full rebuild plan: `npm run db:market:rebuild-prices`
- Destructive rebuild from current primary mappings: `npm run db:market:rebuild-prices -- --write --reset-yfinance-prices --continue-on-error --compact`
- Resume an interrupted reset rebuild without deleting again: `npm run db:market:backfill:primary -- --write --continue-on-error --compact`
- Incremental update: `npm run db:market:update-prices`
- Discover missing `.DE` candidates without provider calls: `npm run db:market:discover-de-candidates`
- Validate derived `.DE` candidates explicitly against yfinance: `npm run db:market:discover-de-candidates -- --validate`
- Store unverified `.DE` proposals only: `npm run db:market:discover-de-candidates -- --write`
- Store verified `.DE` candidates after validation: `npm run db:market:discover-de-candidates -- --validate --write`
- Dry-run: `npm run db:market:prefer-de-primary`
- Dry-run limited to currency-fix candidates while still reporting venue-only skips: `npm run db:market:prefer-de-primary -- --currency-fixes-only`
- Write non-destructive primary changes only: `npm run db:market:prefer-de-primary -- --write`
- Write only currency-fix candidates: `npm run db:market:prefer-de-primary -- --currency-fixes-only --write`
- Write with destructive full-history replacement when ticker changes: `npm run db:market:prefer-de-primary -- --write --replace-history`

If a full reset rebuild is interrupted after deleting yfinance price rows, continue with `db:market:backfill:primary -- --write --continue-on-error --compact`. Do not rerun `--reset-yfinance-prices` unless you intentionally want to delete and rebuild the selected scope again.

## Legacy / Internal Commands

The following commands remain available for advanced or exceptional workflows, but they are no longer the primary operator model:

- `db:market:sync:instruments`
- `db:market:match:symbols`
- `db:market:create:xetra-candidates`
- `db:market:export:candidates`
- `db:market:import:validation`
- `db:market:lookup:openfigi`
- `db:market:add:candidate`
- `db:market:transfer:mapping`
- `db:market:set:instrument-status`
- `db:market:set:instrument-metadata`
- `db:market:promote:verified`
- `db:market:discover-de-candidates`
- `db:market:prefer-de-primary`
- `db:market:backfill:primary`
- `db:market:update:primary`
- `db:market:import:reference:xetra`
- `db:market:import:reference:trading-universe`
- `db:market:import:manual-mappings`
- `db:market:unmapped`

## Unknown Asset Queue

Runtime may enqueue unknown ISIN sightings into `reference_data_request_logs` (DB-only, best-effort).
Resolution/import/validation/promotion remains Admin/CLI workflow only.

## Safety Rules

- Keep provider operations explicit and scoped.
- Prefer dry-run first, then explicit `--write`.
- Keep generated `.market-data/` artifacts local-only.
- Do not add provider calls to runtime routes.
