# AssetTrace Local Quickstart

Status: AssetTrace v1 local usage guide.

This guide describes the local browser-only controls for connecting AssetTrace, loading data explicitly, choosing a portfolio scope, changing appearance and clearing local state. It does not require or describe any private portfolio data.

## 1. Start the local app

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

## 2. Connect Parqet

Use the existing Parqet connection entry point in the app when a reconnect or authorization prompt is shown. AssetTrace does not show tokens, cookies or OAuth codes in Settings or Diagnostics.

If the authorized Parqet session expires, the Dashboard shows a reconnect notice. Reconnect is explicit; AssetTrace does not add a new auth flow for Settings.

## 3. Load or refresh data explicitly

Dashboard data is loaded through the visible Dashboard action only:

- `Assets laden` for the first local load.
- `Manuell aktualisieren` when a local cache already exists.

Navigation, Settings changes, portfolio-scope changes and appearance changes must not trigger hidden provider calls or a background full fetch.

## 4. Set the global portfolio scope

Open `Einstellungen` and use `Portfolio/Daten`:

- `Alle` uses all locally known authorized portfolios.
- `Manuelle Auswahl` stores a local multi-select scope.

The scope is persisted in the browser and is intended for Dashboard, Aktivitäten, Timeline, Reports and Assetdetails as those pages adopt the global scope. Scope changes are local and do not fetch new Parqet data. Use the explicit Dashboard refresh action when you want to load data for the changed scope.

If a stored portfolio is no longer available, AssetTrace shows a safe notice and falls back to available portfolios instead of keeping an invalid hidden selection.


## 5. Open asset details from the Dashboard

After Dashboard assets are loaded, use the `Detail` action in the AssetTable to open a read-only Assetdetail page. The URL contains a readable slug and the stable asset key as `id`, for example `/assets/vanguard-ftse-all-world-high-dividend-yield?id=IE00B8GKDB10`.

Assetdetails use only the locally loaded Dashboard read model and the current global portfolio scope. Opening or changing an Assetdetail URL does not trigger Parqet provider calls, audit routes or a full activity fetch. If local data is missing, the page asks you to explicitly load or refresh Dashboard data first.

The Assetdetail page includes a local visual Timeline/marker area. It displays marker data only when it is already present in the local read model, falls back to a marker-only/empty state when no safe event timeline is available and never loads chart data automatically. Range controls and chart-mode toggles are local UI controls; use the Dashboard refresh action for any explicit data update.

## 6. Change appearance mode

Open `Einstellungen` and use `Darstellung`:

- `System` follows `prefers-color-scheme` from the device/browser.
- `Hell` forces the light appearance.
- `Dunkel` forces the dark appearance.

The value is stored locally in the browser. Invalid stored values fall back to `System`.

## 7. Clear local data and settings

Open `Einstellungen` and use `Datenschutz/Debug`:

- `Lokalen Dashboard-Cache löschen` removes only the local Dashboard cache.
- `Lokale Einstellungen zurücksetzen` clears local AssetTrace UI settings and cache.

These actions do not delete Parqet data and do not perform destructive server-side work.

## 8. API-budget note

Treat Parqet/API budget as limited. Avoid unnecessary refreshes. Prefer reviewing the current local data stand first, then refresh explicitly only when you want to update the local snapshot from Parqet.

Developer diagnostics in Settings are local and safe-gated. They may show freshness/cache metadata and API-budget notes, but must not show tokens, cookies, raw provider payloads, private activity rows or unredacted private identifiers.
