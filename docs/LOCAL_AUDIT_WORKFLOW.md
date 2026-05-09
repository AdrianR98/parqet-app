# Local Audit Workflow

Status: developer workflow helper

## Purpose

This guide explains how to run the local Global Asset audit helpers without copying large JSON responses from the browser.

The scripts are Windows-first PowerShell helpers. They call the guarded local audit route and print selected redacted sections.

## Prerequisites

Start the app locally:

```powershell
npm run dev
```

Ensure `.env.local` contains:

```text
ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true
```

Connect Parqet locally through:

```text
http://localhost:3000/api/auth/start
```

Do not commit real audit outputs.

## Cookie header for terminal requests

The browser has Parqet cookies after OAuth. PowerShell does not automatically share those browser cookies.

If the browser route works but the helper script returns `401 Unauthorized`, copy the local Cookie header from the browser request and pass it explicitly.

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

## Summary audit

Run:

```powershell
npm run audit:summary
```

Optional:

```powershell
npm run audit:summary -- -Limit 5
npm run audit:summary -- -BaseUrl "http://localhost:3000" -Limit 5
npm run audit:summary -- -CookieHeader "parqet_access_token=...; parqet_refresh_token=..."
```

The summary helper prints only:

- sources
- normalization.summary
- aggregation.summary
- summary
- privacy
- warningsTruncated
- nextSteps

## Single asset audit

Run:

```powershell
npm run audit:asset -- -Isin US83444M1018
```

Optional flags:

```powershell
npm run audit:asset -- -Isin US83444M1018 -Limit 100 -IncludeActivities
npm run audit:asset -- -Isin US83444M1018 -IncludeActivities -IncludeAmounts
npm run audit:asset -- -Isin US83444M1018 -IncludePortfolioNames -IncludeActivityIds
npm run audit:asset -- -Isin US83444M1018 -CookieHeader "parqet_access_token=...; parqet_refresh_token=..."
```

Defaults stay privacy-safe:

- amounts are hidden,
- portfolio names are redacted,
- activity IDs are redacted,
- raw payloads are never returned.

## Error handling

If a script fails, check:

- `npm run dev` is running,
- `ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true` is set,
- Parqet is connected locally,
- terminal requests may require an explicit `-CookieHeader`,
- `curl.exe` is available on Windows,
- the requested ISIN exists in the authorized portfolios.

## Non-goals

These helpers do not introduce MCP, Playwright, Vitest, synthetic fixtures or production routes.
