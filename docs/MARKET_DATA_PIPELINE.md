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

## Admin/CLI Workflow (High Level)

1. Run migrations.
2. Sync instruments.
3. Create/import candidate mappings.
4. Validate candidates (yfinance).
5. Import validation results.
6. Promote verified primary mappings.
7. Backfill prices/actions.
8. Run incremental primary updates.
9. Inspect status/unmapped/requests/runs via Admin read-only views or CLI reports.

## Unknown Asset Queue

Runtime may enqueue unknown ISIN sightings into `reference_data_request_logs` (DB-only, best-effort).
Resolution/import/validation/promotion remains Admin/CLI workflow only.

## Safety Rules

- Keep provider operations explicit and scoped.
- Prefer dry-run first, then explicit `--write`.
- Keep generated `.market-data/` artifacts local-only.
- Do not add provider calls to runtime routes.
