# Local Quickstart

Status: v1 local usage guide

This guide describes local browser controls for connecting the portfolio integration, loading data explicitly, choosing a portfolio scope, changing appearance and clearing local state. It does not require or describe private portfolio data.

## 1. Start The Local App

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` only on your machine. Never commit real tokens, cookies, OAuth codes, private exports, portfolio data or screenshots with private account information.

Open the local app at:

```text
http://localhost:3000
```

## 2. Connect The Provider

Use the existing provider connection entry point in the app when a reconnect or authorization prompt is shown. The app does not show tokens, cookies or OAuth codes in Settings or Diagnostics.

If the authorized session expires, the Dashboard shows a reconnect notice. Reconnect is explicit; this guide does not add or change authentication behavior.

## 3. Load Or Refresh Data Explicitly

Dashboard data is loaded through the visible Dashboard action only:

- `Assets laden` for the first local load.
- `Parqet-Daten aktualisieren` when a local cache already exists.

Navigation, Settings changes, portfolio-scope changes and appearance changes must not trigger hidden provider calls or a background full fetch.

## 4. Set The Global Portfolio Scope

Open `Einstellungen` and use `Portfolio/Daten`:

- `Alle` uses all locally known authorized portfolios.
- `Manuelle Auswahl` stores a local multi-select scope.

The scope is persisted in the browser and is intended for Dashboard, activities, timeline, reports and asset details as those pages adopt the global scope. Scope changes are local and do not fetch new provider data. Use the explicit Dashboard refresh action when you want to load data for the changed scope.

If a stored portfolio is no longer available, the app shows a safe notice and falls back to available portfolios instead of keeping an invalid hidden selection.

## 5. Open Asset Details From The Dashboard

After Dashboard assets are loaded, use the `Detail` action in the AssetTable to open a read-only asset detail page. The URL contains a readable slug and the stable asset key as `id`, for example `/assets/vanguard-ftse-all-world-high-dividend-yield?id=IE00B8GKDB10`.

Asset details use only the locally loaded Dashboard read model and the current global portfolio scope. Opening or changing an asset detail URL does not trigger provider calls, audit routes or a full activity fetch. If local data is missing, the page asks you to explicitly load or refresh Dashboard data first.

The asset detail page includes a local visual timeline/marker area. It displays marker data only when it is already present in the local read model, falls back to a marker-only/empty state when no safe event timeline is available and never loads chart data automatically. Range controls and chart-mode toggles are local UI controls; use the Dashboard refresh action for any explicit data update.

## 6. Use Activities And Global Timeline Locally

Open `Aktivitäten` or `Timeline` after loading Dashboard data explicitly. Both pages use only the browser-local Dashboard read model / snapshot-backed Activity Items. Opening either page, changing filters, searching, sorting, using pagination/"Mehr anzeigen", switching timeline filters or opening an Activity detail panel does not trigger provider calls, audit routes or background sync.

If no local Activity Items are available, the pages show an empty state and ask you to load or refresh data explicitly in the Dashboard. The local status area shows source and freshness so you can decide whether a manual Dashboard refresh is needed.

The global portfolio scope from `Einstellungen` is respected locally. If the saved scope references portfolios that are not part of the loaded local data, Activities and Timeline show a clear mismatch notice and do not auto-load missing data.

Activity cards open the local Activity detail panel. If a stable asset key such as an ISIN is available, the asset name inside the card is a separate asset detail link using the same readable slug plus `id` query pattern as the Dashboard AssetTable. Clicking that link navigates to asset detail and does not also open the Activity detail panel.

Activity detail is read-only in v1. It shows safe local fields such as date, type, asset, portfolio, quantity, price, amount and net amount. Fees, taxes and notes are shown only if they already exist as safe fields in the local read model. It must not show tokens, cookies, raw provider payloads, internal debug data or editing controls.

The Timeline page starts with a compact local summary for the current scope and filters, such as event, buy, sell, dividend, transfer, warning, asset and portfolio counts. The summary is calculated from already loaded local Activity Items and does not start a provider call.

## 7. Maintain Local Asset Metadata

Local asset metadata improves display names, subtitles, symbols, WKN fallbacks and logo identity when loaded provider/read-model data only contains identifier-like labels.

Use the dedicated workflow document for safe maintenance:

```text
docs/LOCAL_METADATA_WORKFLOW.md
```

The short rule is: keep source CSV exports local, commit only reviewed generated metadata/report files when safe, and never commit private portfolio exports, raw provider payloads, tokens, cookies, OAuth codes, account data or screenshots with private account information.

Metadata maintenance is local-only and provider-call-free in v1. Do not add automatic metadata lookups or external metadata APIs without a separate Research/ADR or Post-V1 feature issue.

## 8. Use Local Reports And Exports

Open `Reports` after loading Dashboard data explicitly. Reports v1 uses only the locally loaded Dashboard read model and the current global portfolio scope. Opening Reports, changing the scope display, copying a summary or exporting CSV does not trigger provider calls and does not perform an automatic refresh.

If no local Dashboard data is available, Reports shows an empty state and asks you to load or refresh data in the Dashboard first.

Reports v1 export boundaries:

- Markdown copy contains a concise local summary of visible report metrics.
- CSV export contains only visible, loaded and safe report/asset overview fields.
- Raw provider payloads, tokens, cookies, private debug data and hidden technical IDs are not exported.
- PDF export is intentionally not part of v1.

## 9. Change Appearance Mode

Open `Einstellungen` and use `Darstellung`:

- `System` follows `prefers-color-scheme` from the device/browser.
- `Hell` forces the light appearance.
- `Dunkel` forces the dark appearance.

The value is stored locally in the browser. Invalid stored values fall back to `System`.

## 10. Clear Local Data And Settings

Open `Einstellungen` and use `Datenschutz/Debug`:

- `Lokalen Dashboard-Cache löschen` removes only the local Dashboard cache.
- `Lokale Einstellungen zurücksetzen` clears local UI settings and cache.

These actions do not delete provider data and do not perform destructive server-side work.

## 11. API-Budget Note

Treat provider/API budget as limited. Avoid unnecessary refreshes. Prefer reviewing the current local data state first, then refresh explicitly only when you want to update the local snapshot from the provider.

Developer diagnostics in Settings are local and safe-gated. They may show freshness/cache metadata and API-budget notes, but must not show tokens, cookies, raw provider payloads, private activity rows or unredacted private identifiers.

## 12. Run V1 E2E Smoke Tests

The V1 Playwright smoke tests run locally and as a GitHub Actions PR check. They start the local Next.js dev server through Playwright, use an empty/synthetic browser state and do not require real Parqet auth, cookies, tokens, portfolios or provider data.

Install dependencies and the Playwright browser once:

```bash
npm install
npx playwright install chromium
```

GitHub Actions installs Chromium and its Linux dependencies with `npx playwright install --with-deps chromium` before running the same npm script.

Run the smoke suite:

```bash
npm run test:e2e
```

The smoke suite covers Dashboard, Settings, Activities, Timeline, Reports and one synthetic Asset Detail URL. It fails on React hydration mismatch messages, the React script-tag render warning, uncaught page errors and unexpected local-only navigation calls to `/api/parqet/assets` or `/api/parqet/activities`. Screenshots, traces and videos are disabled in the Playwright config by default.

## Snapshot And Explicit Refresh Behavior

v1 separates explicit data loading from normal navigation:

- Use the Dashboard load/refresh action when you intentionally want to fetch the current provider data for the selected portfolio scope.
- The app bar shows a compact local scope/freshness status and links to the Dashboard refresh path. This affordance is non-fetching by itself.
- Dashboard data is written into a browser-local read model with freshness metadata after a successful explicit load; this is not production persistence.
- Activities, Timeline, Reports and Assetdetail views reuse local snapshot/read-model data and must not start hidden provider full-fetches while opening, filtering, sorting, paginating or showing details.
- If no local activity snapshot exists, the Activities page shows an empty state that asks you to load or refresh data explicitly in the Dashboard.
- Settings diagnostics may show whether a local snapshot/cache exists, its freshness status, scope count/fingerprint and redacted refresh error category. They must not show tokens, cookies or raw provider payloads.
- Audit routes without `refresh=1` are snapshot-only/no-provider-call reads. Audit routes with `refresh=1` may run provider-backed only when that route is intentionally designed and gated for that behavior.

The server-side v1 snapshot is bounded, process-local, in-memory and non-durable. It is an API-budget optimization for explicit v1 route reuse only, not production storage. Filtered/normalized Activity data is retained only within those bounded snapshot/read-model paths; tokens, cookies and raw provider payloads must never appear in UI, diagnostics or exports.
