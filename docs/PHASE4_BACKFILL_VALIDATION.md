# Phase 4 Local Backfill Validation

Status: completed locally by the user on 2026-05-27  
Branch: `refactor/phase-4-database-asset-model`  
Related: Refs #384, Refs #388, Refs #395, Refs #397, Refs #398

## Command

```powershell
npm run db:market:backfill:asset-reference
```

The command completed successfully and committed writes to the local database.

## Source rows read

| Legacy table | Rows |
| --- | ---: |
| `market_instruments` | 90 |
| `market_symbol_mappings` | 171 |
| `market_prices_daily` | 590,186 |
| `market_actions` | 6,790 |
| `market_data_runs` | 86 |
| `market_data_run_items` | 86 |
| `market_data_requests` | 0 |
| `market_reference_sources` | 2 |
| `market_reference_instruments` | 18,145 |

## Target upserts

| Target table | Inserted | Updated |
| --- | ---: | ---: |
| `assets` | 90 | 0 |
| `asset_symbol_mappings` | 171 | 0 |
| `asset_daily_prices` | 590,186 | 0 |
| `reference_data_sources` | 3 | 0 |
| `reference_data_import_runs` | 86 | 0 |
| `reference_data_import_run_items` | 86 | 0 |
| `reference_data_request_logs` | 0 | 0 |
| `dividend_events` | 6,599 | 0 |
| `corporate_action_events` | 191 | 0 |

## Skipped / unresolved rows

All skipped/unresolved counters were zero:

| Category | Rows |
| --- | ---: |
| unresolved symbol mappings | 0 |
| unresolved price rows | 0 |
| unresolved market actions | 0 |
| unresolved run items | 0 |
| unresolved reference instruments | 0 |
| unknown market action types | 0 |
| dividend-like market actions without date | 0 |
| corporate-action-like market actions without date | 0 |

## Result

The local dataset was fully backfilled from the legacy `market_*` tables into the new Asset/reference-data schema without unresolved rows.

Created/populated target tables include:

- `assets`
- `asset_symbol_mappings`
- `asset_daily_prices`
- `dividend_events`
- `corporate_action_events`
- `reference_data_sources`
- `reference_data_import_runs`
- `reference_data_import_run_items`
- `reference_data_request_logs`

Legacy `market_*` tables were not dropped or truncated.

## Interpretation

This validates the current backfill mapping for the local dataset. It does not yet complete the Phase 4 cutover.

Remaining cutover work:

- switch import/update write paths to the new Asset/reference-data tables;
- switch admin/API read paths to the new tables where intended;
- verify latest-market-price reads from `asset_daily_prices` for #395;
- only then consider dropping or deprecating legacy `market_*` tables.

## Production rollout note

Production rollout is not yet recommended. Production migration/backfill should only run after the cutover path is stable and the intended read/write ownership for the new tables is verified.
