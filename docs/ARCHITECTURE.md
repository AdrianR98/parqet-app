# Architecture

Status: current post-PR #378 architecture

## Application Shape

- Next.js App Router application.
- User app routes in `(app)`.
- Admin routes isolated in `(admin)`.

## Auth And User Data

- Parqet OAuth is used for authorized portfolio access.
- User Portfolio Data is Parqet-derived and cached browser-local for app views.
- `/settings` is simplified to `Parqet-Verbindung` and `Darstellung`.
- Disconnect clears auth cookies server-side and Parqet-derived browser-local data client-side while keeping appearance/UI preferences.

## Local Cache / Bootstrap

- Header portfolio selection is the user-facing selection path.
- Dashboard writes/uses browser-local cache.
- Dashboard, Activities and Asset Detail can recover missing local cache through bootstrap/cache-change flow.

## Market-Data Runtime Boundary

- Runtime market-history reads are DB-only.
- Provider calls are not part of runtime route behavior.
- Provider operations run through explicit Admin/CLI workflows.

## Admin Boundary

- `/admin` is read-only for market-data inspection/triage.
- Production-grade Admin Auth/AuthZ hardening is still pending.

## Not Implemented Yet

- Asset Family / Security Lineage model for merged multi-instrument economic history.
- Full corporate-action lineage handling in runtime/UI.