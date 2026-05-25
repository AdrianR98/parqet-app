# Market Data Pipeline (Admin/CLI Workflow)

Issue scope: Fixes #331  
Future admin console planning: Refs #343

## Overview

This pipeline maintains market instrument metadata, symbol mappings, historical prices, and corporate actions in Postgres. The pipeline is operated manually through admin/CLI scripts.

Runtime behavior is DB-only for market history reads:

- `src/app/api/market-data/history/route.ts` validates request params and delegates to service code.
- `src/lib/market-data/service.ts` reads instrument/mapping/price/action data from Postgres repositories and returns response payloads.
- Runtime route/service do not call yfinance, OpenFIGI, or other providers.

Admin/CLI workflow is the only place where provider calls are allowed. This keeps normal app requests deterministic, cheaper, and safer for API budget and rate limits.

## Intended End-To-End Sequence

Run in this order unless you are doing a targeted maintenance step:

1. Migration  
Command: `npm run db:market:migrate`  
Creates/updates market-data tables.
2. Instrument sync from local known assets  
Command: `npm run db:market:sync:instruments -- .market-data/local-assets.json`  
Loads/updates `market_instruments` from local asset export (dry-run by default).
3. Candidate matching  
Primary command: `npm run db:market:match:symbols -- .market-data/companies.json`  
Optional reference-aided matching:  
`npm run db:market:import:reference:xetra -- .market-data/t7-xetr-allTradableInstruments.csv`  
`npm run db:market:create:xetra-candidates`  
`npm run db:market:import:reference:trading-universe -- .market-data/trading-universe.csv`
4. Candidate export  
Command: `npm run db:market:export:candidates -- --out .market-data/symbol-candidates.json --top-per-isin`
5. yfinance validation  
Command: `npm run yfinance:validate:symbols -- --input .market-data/symbol-candidates.json --actions --out .market-data/symbol-validation-results.json`
6. Validation result import  
Command: `npm run db:market:import:validation -- .market-data/symbol-validation-results.json`  
Use `--write` only after dry-run inspection.
7. Promote verified mappings to primary  
Command: `npm run db:market:promote:verified`  
Use `--write` only after checking planned promotions.
8. Backfill prices/actions  
Command: `npm run db:market:backfill:primary`  
Use `--write` to execute provider export + DB import.
9. Status report  
Commands:  
`npm run db:market:status`  
`npm run db:market:unmapped`
10. Incremental update for verified primary mappings
Command: `npm run db:market:update:primary`
Dry-run by default. Add `--write` to run yfinance export + idempotent DB upserts for buffered incremental ranges (`--days-back`, default `10`).

## Script Catalog

Legend:

- DB: `none` | `read` | `write`
- Provider: `none` | `yfinance` | `openfigi`
- Mode: default behavior without extra flags

### Core sequence scripts

| Script | Command | Purpose | Mode | Inputs | Outputs | DB | Provider | Generated files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `db:market:migrate` | `npm run db:market:migrate` | Run market-data SQL migrations (`001`-`004`) | write | DB env | migrated schema | write | none | none |
| `db:market:sync:instruments` | `npm run db:market:sync:instruments -- [path]` | Sync local assets into `market_instruments` | dry-run | local assets JSON (default `.market-data/local-assets.json`) | console summary; optional DB upserts with `--write` | read (dry), write (`--write`) | none | none |
| `db:market:match:symbols` | `npm run db:market:match:symbols -- .market-data/companies.json` | Score and stage yfinance symbol candidates per ISIN | dry-run | `companies.json` + DB instruments | candidate preview; optional candidate writes with `--write` | read (dry), write (`--write`) | none | none |
| `db:market:export:candidates` | `npm run db:market:export:candidates -- ...` | Export unverified candidates for manual/provider validation | file-write | DB candidates | JSON candidate list | read | none | default `.market-data/symbol-candidates.json` |
| `yfinance:validate:symbols` | `npm run yfinance:validate:symbols -- ...` | Validate candidates against yfinance history/actions (no DB writes) | provider-call | `--symbol`/`--input` | JSON lines to stdout; optional JSON array file with `--out` | none | yfinance | commonly `.market-data/symbol-validation-results.json` |
| `db:market:import:validation` | `npm run db:market:import:validation -- <results.json>` | Import validation verdicts into mapping notes/verified state | dry-run | validation JSON array | summary; optional mapping updates with `--write` | read (dry), write (`--write`) | none | none |
| `db:market:promote:verified` | `npm run db:market:promote:verified` | Choose best verified mapping as primary per ISIN | dry-run | DB verified mappings | planned promotions; optional primary updates with `--write` | read (dry), write (`--write`) | none | none |
| `db:market:backfill:primary` | `npm run db:market:backfill:primary` | Backfill price/actions for primary mappings | dry-run | DB primary mappings | planned backfills; with `--write` runs export+import pipeline | read (dry), write (`--write`) | yfinance (only with `--write`) | `.market-data/backfill/*.json` |
| `db:market:update:primary` | `npm run db:market:update:primary` | Incremental update of verified active primary yfinance mappings with overlap window | dry-run | DB primary mappings + optional filters | planned incremental windows; with `--write` runs provider fetch + idempotent upserts | read (dry), write (`--write`) | yfinance (only with `--write`) | none |
| `db:market:status` | `npm run db:market:status` | High-level readiness/status snapshot | read-only | DB | console report | read | none | none |

### Supporting read/report scripts

| Script | Command | Purpose | Mode | Inputs | Outputs | DB | Provider | Generated files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `db:market:unmapped` | `npm run db:market:unmapped` | Detailed open mapping report with categories/actions | read-only | DB | table/json/csv report | read | none | optional `--out` file |

### Supporting reference/candidate maintenance scripts

| Script | Command | Purpose | Mode | Inputs | Outputs | DB | Provider | Generated files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `db:market:import:reference:xetra` | `npm run db:market:import:reference:xetra -- [csv]` | Parse/import Xetra reference rows; optional instrument enrichment | dry-run | Xetra CSV | preview, optional DB writes (`--write`) | read (dry), write (`--write`) | none | optional `--out` summary JSON |
| `db:market:create:xetra-candidates` | `npm run db:market:create:xetra-candidates` | Convert Xetra references into yfinance candidates | dry-run | DB reference rows | planned candidates; optional candidate writes | read (dry), write (`--write`) | none | optional `--out` report JSON |
| `db:market:import:reference:trading-universe` | `npm run db:market:import:reference:trading-universe -- [csv/txt]` | Import trading-universe names; optional instrument/display-name enrichment | dry-run | trading universe file | preview; optional DB writes (`--write`) | read (dry), write (`--write`) | none | optional `--out` summary JSON |
| `db:market:lookup:openfigi` | `npm run db:market:lookup:openfigi` | Query OpenFIGI to propose candidate symbols | dry-run | DB instruments (+ OpenFIGI key/env if used) | planned candidates; optional writes | read (dry), write (`--write`) | openfigi | optional `.market-data/*` output via flags |
| `db:market:add:candidate` | `npm run db:market:add:candidate -- ...` | Manually add one candidate mapping | dry-run | CLI args (`--isin`, `--symbol`, etc.) | planned insert / optional write | read (dry), write (`--write`) | none | none |
| `db:market:transfer:mapping` | `npm run db:market:transfer:mapping -- ...` | Transfer mapping between instruments with safety checks | dry-run | source/target args | planned transfer / optional write | read (dry), write (`--write`) | none | none |
| `db:market:set:instrument-status` | `npm run db:market:set:instrument-status -- ...` | Mark instrument status (`active`, `excluded`, `legacy`, `derivative`, `unknown`) | dry-run | status args | planned status update / optional write | read (dry), write (`--write`) | none | none |
| `db:market:import:json` | `npm run db:market:import:json -- <file>` | Import one market-data JSON payload into prices/actions/mappings | write | exported JSON payload | DB upserts + run logging | write | none | none |

## Safety Rules

- Never commit `.market-data/` files. They are local artifacts only.
- Never commit DB URLs, provider payloads, tokens, cookies, OAuth values, or secrets.
- Never add yfinance/OpenFIGI/provider calls to runtime API/UI routes.
- Validation/export files (`symbol-candidates`, `symbol-validation-results`, backfill JSONs, ad-hoc reports) are local-only.
- ETF/fund/manual mappings require explicit human review before promotion.
- ADR/legacy/corporate-action cases (including Gazprom/ADR/old-ISIN/successor cases) require explicit manual review.
- Backfill/import steps must remain idempotent and re-runnable.
- Prefer dry-run first, then a scoped `--write` run (`--isin`, `--limit`, exclusion flags).
- Incremental command defaults to dry-run and requires explicit `--write`.

## Incremental Primary Update Command

`npm run db:market:update:primary -- [flags]`

Scope:

- Processes only `provider=yfinance` mappings where `is_primary=true`, `is_active=true`, `verified_at is not null`.
- Computes latest known `market_prices_daily` date per ISIN.
- Uses incremental fetch start with safety overlap: `latest_date - --days-back` (default `10`).
- Upserts prices and actions idempotently.
- Continues processing after per-instrument failures.

Supported flags:

- `--write`: required for DB writes. Without this flag, command runs as dry-run only.
- `--limit <n>`: cap processed mappings.
- `--isin <ISIN[,ISIN...]>`: include only selected ISINs.
- `--exclude-isin <ISIN[,ISIN...]>`: exclude selected ISINs.
- `--days-back <n>`: overlap days for buffered refetch (default `10`).
- `--force`: re-fetch full range (`period=max`) instead of incremental start planning.

Examples:

- Dry-run all: `npm run db:market:update:primary`
- Dry-run subset: `npm run db:market:update:primary -- --isin IE00B8GKDB10,US7561091049 --days-back 14`
- Write run scoped: `npm run db:market:update:primary -- --write --limit 20 --exclude-isin US0000000000`

## Troubleshooting

- Missing DB env (`DATABASE_URL`/`POSTGRES_URL` etc.): set local env and retry; migration/import/sync/promotion/backfill/status scripts require DB access.
- Missing local generated files in `.market-data/`: run the prior producer step first (for example export candidates before yfinance validation).
- Empty candidate results: inspect `npm run db:market:unmapped`, include/exclude filters, and whether instrument sync/reference imports were executed.
- Failed yfinance validation: re-run with focused `--symbol` or `--limit`; inspect provider/network errors in validation output.
- No primary mapping: run validation import and promotion workflow, or perform explicit manual candidate review.
- No price data after promotion: run backfill workflow (`db:market:backfill:primary`) and inspect failures per ISIN/symbol.
- Read-only status inspection: use `npm run db:market:status` and `npm run db:market:unmapped` (without `--write` flags).

## Relationship To Future Admin Console (#343)

- #343 tracks planning/build of a protected Admin Console.
- Until that exists, this CLI workflow is the source-of-truth operational path.
- Future Admin UI must be read-only-first and must not introduce hidden provider calls in normal runtime requests.
