# Local Quickstart

Status: current local usage guide

## 1. Start The Local App

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open: `http://localhost:3000`

## 2. Connect Parqet

Use the in-app OAuth connect/reconnect flow when prompted.

## 3. Understand Local Data Behavior

- User Portfolio Data (Parqet-derived portfolio/activity data) is cached locally in the browser.
- Dashboard, Activities and Asset Detail can bootstrap local cache automatically when cache is missing.
- Header portfolio selection is the user-facing portfolio selection path.
- Local filters, sorting, pagination and detail panels are local operations over loaded cache.

## 4. Dashboard

- Dashboard can load/refresh authorized data and persist browser-local cache.
- Missing cache can be prepared automatically via bootstrap.
- Manual refresh remains available when you explicitly want fresh provider data.

## 5. Activities

- Uses existing local cache when available.
- Can recover via local bootstrap when cache is missing.
- Must not trigger provider-call loops.
- Shows stable preparing/failure states when local preparation is running or fails.

## 6. Asset Detail

- Uses existing local cache plus DB-backed market history.
- Can recover local portfolio/activity context via local bootstrap when needed.
- Market-history runtime reads are DB-only.

## 7. Settings

`/settings` contains:

- `Parqet-Verbindung`
- `Darstellung`

Disconnect behavior:

- Clears Parqet auth cookies server-side.
- Clears Parqet-derived browser-local portfolio/activity data client-side.
- Preserves appearance/UI preferences.

## 8. Admin Boundary

`/admin` is isolated in the `(admin)` route group and is read-only for market-data inspection/triage.
Provider operations are explicit Admin/CLI workflows, not normal runtime view behavior.

## 9. Privacy And API Budget

- Do not commit real tokens, cookies, OAuth codes, or private portfolio exports.
- Prefer local cache reuse and explicit refresh over unnecessary provider calls.
