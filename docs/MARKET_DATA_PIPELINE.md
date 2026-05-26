# Market Data Pipeline (Admin/CLI Workflow)

Status: current operator source of truth

## Runtime Boundary

Runtime market-history reads are DB-only.

- Route: `src/app/api/market-data/history/route.ts`
- Service: `src/lib/market-data/service.ts`

Runtime does not call yfinance, OpenFIGI or Alpha Vantage.

Provider calls are restricted to explicit Admin/CLI workflows.

## Current Provider Strategy

- Primary provider workflow: yfinance (validation/backfill/incremental update).
- OpenFIGI: optional candidate lookup/admin workflow.
- Alpha Vantage: residual/deprecated code path candidate; not part of intended future provider strategy.

## Current Market-Data Tables

- `market_instruments`
- `market_symbol_mappings`
- `market_prices_daily`
- `market_actions`
- `market_data_runs`
- `market_data_run_items`
- `market_data_requests`

Current migrations:

- `001_market_data.sql`
- `002_market_reference_instruments.sql`
- `003_market_instrument_display_metadata.sql`
- `004_market_instrument_status.sql`
- `005_market_data_requests.sql`

## Market Actions Scope

`market_actions` can store generic market actions (including dividends and splits).
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

Runtime may enqueue unknown ISIN sightings into `market_data_requests` (DB-only, best-effort).
Resolution/import/validation/promotion remains Admin/CLI workflow only.

## Safety Rules

- Keep provider operations explicit and scoped.
- Prefer dry-run first, then explicit `--write`.
- Keep generated `.market-data/` artifacts local-only.
- Do not add provider calls to runtime routes.