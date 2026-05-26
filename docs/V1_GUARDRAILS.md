# V1 Guardrails

Status: active guardrails aligned to current architecture

## Data Boundaries

- User Portfolio Data: private Parqet-derived data, cached browser-local for app views.
- Market Data: DB-backed instrument/price/action domain.
- Runtime market-history routes are DB-only.
- Provider operations are explicit Admin/CLI workflows only.

## Runtime Rules

- Local navigation/filtering/sorting/details must not trigger hidden provider calls.
- Dashboard explicit refresh remains the intentional provider-backed update path.
- Missing local cache may recover via bootstrap flows for Dashboard/Activities/Asset Detail.
- `/settings` remains limited to Parqet connection and appearance controls.

## Admin Rules

- `/admin` is read-only inspection/triage.
- No write actions or hidden provider fetches in normal runtime views.
- Production admin enablement requires full Auth/AuthZ hardening.

## Provider Strategy Rules

- yfinance is the active provider workflow for validation/backfill/update.
- OpenFIGI may be used for candidate lookup/admin support.
- Alpha Vantage is not the intended future strategy and should be treated as deprecated/residual cleanup where present.

## Market Actions And Lineage

- `market_actions` can store generic actions (including dividends and splits).
- Current runtime history exposure is dividend-focused.
- Asset Family / Security Lineage modeling and merged multi-instrument history are future work.

## Privacy

- Never expose tokens/cookies/OAuth codes/raw provider payloads in UI/docs/logs/exports.
- Keep private portfolio/activity data out of repository diffs and PR text.