# Local Audit Workflow

Status: developer workflow helper

## Purpose

This guide explains how to run local Global Asset audit helpers without copying large JSON responses from the browser.

The scripts are Windows-first PowerShell helpers. They call the guarded local audit route and print selected redacted sections.

API budget note: summary and asset audit routes may fetch Parqet Activities. Use the lightweight health route for auth/session checks.

## Prerequisites

Start the app locally:

```powershell
npm run dev
```

Ensure `.env.local` contains:

```text
ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true
```

For local audit debugging, reduce provider request pressure with:

```text
PARQET_ACTIVITY_FETCH_CONCURRENCY=1
```

This loads portfolio activity pages more conservatively. The default remains higher for normal app behavior, but `1` is recommended when repeatedly running local audit helpers.

Connect Parqet locally through:

```text
http://localhost:3000/api/auth/start
```

Do not commit real audit outputs.

## DP-12 local real-data validation rule

DP-12 keeps real-data audit validation local, manual and redacted/count-only. Real-data validation must not become fixture input, repository evidence or PR evidence containing private values.

Do not commit local outputs, paste real outputs into issues, PRs or docs, or include screenshots with private data. Never include raw provider payloads, real portfolio IDs or names, real activity rows, private exports, tokens, cookies or OAuth codes.

Allowed later PR evidence wording for a local real-data check:

- local audit run completed
- old/new asset counts compared
- warning/blocker counts compared
- `providerRequestCount` unchanged or reduced
- redaction reviewed
- no raw payload exposure observed

Disallowed PR evidence:

- real depot/portfolio names
- real activity rows
- real amounts
- screenshots
- CSV/JSON exports
- raw payload snippets
- tokens/cookies/OAuth codes

## Lightweight health check

Use this route for auth/session checks before expensive audit calls:

```powershell
curl.exe -sS "http://localhost:3000/api/parqet/health" -H "Cookie: $cookie"
```

The health route may call the Parqet portfolios endpoint, but it does not fetch Activities.

Expected safe fields include:

```text
ok
portfolioAccessOk
portfolioCount
activityFetchPerformed
apiBudget
```

Use the health route instead of summary or asset audit when the goal is only to verify that the local Cookie header still works.

## Persistent local audit authentication

The browser has Parqet cookies after OAuth. PowerShell does not automatically share those browser cookies.

The recommended workflow is to seed a local cookie jar once and then let `curl.exe` reuse and update it automatically.

Default cookie jar path:

```text
.local/parqet-audit-cookies.txt
```

`.local/` is gitignored. Do not commit cookie jar files.

### One-time bootstrap

After browser OAuth, copy the local Cookie header once and run:

```powershell
npm run audit:summary -- -CookieHeader "parqet_access_token=...; parqet_refresh_token=..." -UseCookieJar
```

The script writes a local cookie jar without printing cookie values.

### Later calls

After bootstrap, use only `-UseCookieJar`:

```powershell
npm run audit:summary -- -UseCookieJar
```

```powershell
npm run audit:asset -- -Isin US83444M1018 -UseCookieJar
```

For a custom local cookie jar path:

```powershell
npm run audit:summary -- -UseCookieJar -CookieJarPath ".local/my-audit-cookies.txt"
```

### When reauthorization is still required

This workflow cannot bypass Parqet OAuth. If Parqet revokes or expires the refresh token server-side, reauthorize once through:

```text
http://localhost:3000/api/auth/start
```

Then reseed the jar:

```powershell
npm run audit:summary -- -CookieHeader "parqet_access_token=...; parqet_refresh_token=..." -UseCookieJar
```

If the audit report contains `Access token expired and refresh failed.`, the helpers print a clear reauthorization warning.

## Cookie header fallback

Direct `-CookieHeader` still works for one-off local requests.

When `-CookieHeader` is provided, the helpers use `curl.exe` on Windows because `Invoke-RestMethod` can mishandle this local Cookie scenario.

Example:

```powershell
npm run audit:summary -- -CookieHeader "parqet_access_token=...; parqet_refresh_token=..."
```

```powershell
npm run audit:asset -- -Isin US83444M1018 -CookieHeader "parqet_access_token=...; parqet_refresh_token=..."
```

Rules:

- Use cookie values locally only.
- Do not commit cookie values.
- Do not paste cookie values into issues, PRs, chats or screenshots.
- The scripts do not print cookie values.
- Prefer `-UseCookieJar` after one-time bootstrap.

## Rate-limit hygiene

The audit route still needs to load activities per authorized portfolio before it can filter by ISIN locally. Repeated audit calls can therefore hit provider rate limits.

Recommended local settings:

```text
ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true
PARQET_ACTIVITY_FETCH_CONCURRENCY=1
```

Rules:

- Use `/api/parqet/health` for auth checks.
- Prefer focused asset audits over repeated full summaries.
- Stop audit calls when `diagnostic.category` is `rate_limit`.
- Wait for the displayed retry window before trying again.
- Keep `includeActivities`, `includeAmounts`, `includePortfolioNames` and `includeActivityIds` disabled unless specifically needed.

## Summary audit

Run after cookie jar bootstrap:

```powershell
npm run audit:summary -- -UseCookieJar
```

Optional:

```powershell
npm run audit:summary -- -Limit 5 -UseCookieJar
npm run audit:summary -- -BaseUrl "http://localhost:3000" -Limit 5 -UseCookieJar
npm run audit:summary -- -CookieHeader "parqet_access_token=...; parqet_refresh_token=..." -UseCookieJar
```

The summary helper prints:

- diagnostic, if present
- error, if present
- apiBudget, if present
- sources
- normalization.summary
- aggregation.summary
- summary
- privacy
- warningsTruncated
- nextSteps

Important: `includeAssets=false` and `includeActivities=false` reduce response size, not necessarily upstream provider calls.

## Single asset audit

Run after cookie jar bootstrap:

```powershell
npm run audit:asset -- -Isin US83444M1018 -UseCookieJar
```

Optional flags:

```powershell
npm run audit:asset -- -Isin US83444M1018 -Limit 100 -IncludeActivities -UseCookieJar
npm run audit:asset -- -Isin US83444M1018 -IncludeActivities -IncludeAmounts -UseCookieJar
npm run audit:asset -- -Isin US83444M1018 -IncludePortfolioNames -IncludeActivityIds -UseCookieJar
npm run audit:asset -- -Isin US83444M1018 -CookieHeader "parqet_access_token=...; parqet_refresh_token=..." -UseCookieJar
```

Defaults stay privacy-safe:

- amounts are hidden,
- portfolio names are redacted,
- activity IDs are redacted,
- raw payloads are never returned.

Important: ISIN filtering happens after the currently available Activity retrieval path. A focused asset audit reduces output scope, but may still need to fetch Activities from authorized or selected portfolios.

## Error handling

If a script fails, check:

- `npm run dev` is running,
- `ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true` is set,
- Parqet is connected locally,
- `PARQET_ACTIVITY_FETCH_CONCURRENCY=1` is set for repeated debugging,
- the cookie jar exists after bootstrap,
- `curl.exe` is available on Windows,
- the requested ISIN exists in the authorized portfolios.

If the helper reports that refresh failed, reauthorize via `/api/auth/start` and reseed the cookie jar once.

If the helper reports a rate limit, stop audit calls until the retry window has passed.

## Non-goals

These helpers do not introduce MCP, Playwright, Vitest, synthetic fixtures or production routes.
