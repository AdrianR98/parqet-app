# Roadmap

Status: active roadmap aligned to current baseline

## Current Baseline

- Post-PR #378 architecture is the operating baseline.
- `(app)` and `(admin)` route-group separation is active.
- User Portfolio Data stays browser-local for app views.
- Runtime market-history is DB-backed.
- Provider workflows are explicit Admin/CLI operations.

## Near-Term Work

1. Full Admin Auth/AuthZ before production admin enablement.
2. CSP nonce/hash strategy for inline root scripts.
3. Cache-event debounce/performance pass.
4. Dark-mode asset/logo research (#379).
5. Alpha Vantage removal/deprecation cleanup.

## Future Data Model Work (Not Implemented)

Asset Family / Security Lineage:

- Build an explicit model for related instruments across corporate actions.
- Support merged economic history views without rewriting raw activities.
- Keep invariant-safe cost-basis/quantity handling.
- Add UI switch between concrete Instrument history and Asset Family history.

Examples include share-class consolidations, ETF mergers, reverse splits with ISIN changes, and spin-offs.