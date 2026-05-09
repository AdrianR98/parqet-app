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

The summary helper prints only:

- sources
- normalization.summary
- aggregation.summary
- summary
- privacy
- warningsTruncated
- nextSteps

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

## Error handling

If a script fails, check:

- `npm run dev` is running,
- `ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true` is set,
- Parqet is connected locally,
- the cookie jar exists after bootstrap,
- `curl.exe` is available on Windows,
- the requested ISIN exists in the authorized portfolios.

If the helper reports that refresh failed, reauthorize via `/api/auth/start` and reseed the cookie jar once.

## Non-goals

These helpers do not introduce MCP, Playwright, Vitest, synthetic fixtures or production routes.
