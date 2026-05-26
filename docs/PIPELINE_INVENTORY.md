# Pipeline Inventory

Status: current high-level inventory (post-PR #378)

## Runtime/User Surfaces

- `(app)` routes consume browser-local User Portfolio Data cache.
- Header portfolio selection is the user-facing selection path.
- Dashboard, Activities and Asset Detail can bootstrap/recover local cache if missing.

## Settings

`/settings` now includes only:

- `Parqet-Verbindung`
- `Darstellung`

No portfolio-management/debug/admin controls remain in Settings.

## Admin

- `(admin)` route group is isolated.
- `/admin` is read-only inspection/triage.
- Provider operations remain explicit Admin/CLI workflows.

## Market Data Runtime

- Runtime market-history reads are DB-only.
- Runtime does not call yfinance/OpenFIGI/Alpha Vantage.

## Market Data Operator Tables

- `market_instruments`
- `market_symbol_mappings`
- `market_prices_daily`
- `market_actions`
- `market_data_runs`
- `market_data_run_items`
- `market_data_requests`

## Provider Direction

- Active workflow: yfinance-based validation/backfill/update.
- Optional admin lookup: OpenFIGI.
- Alpha Vantage is not part of the intended architecture and should be removed in a dedicated cleanup PR.
- Do not use Alpha Vantage as fallback.
- Do not reference Alpha Vantage in future planning except as a removal target until deleted.

## Terminology

- User Portfolio Data: private Parqet-derived browser-local data.
- Market Data: DB-backed instrument/price/action data.
- Instrument: one ISIN-based security record.
- Symbol Mapping: provider symbol for an Instrument.
- Market Action: provider action row (dividend/split/action).
- Asset Summary: current projection for one ISIN across portfolios.
- Asset Family / Security Lineage: future concept (not implemented).
