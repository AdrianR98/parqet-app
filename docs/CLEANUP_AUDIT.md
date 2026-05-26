# Cleanup Audit

Status: documentation/governance audit for PR #380 follow-up cleanup planning  
Last reviewed: 2026-05-26

Purpose: identify stale or replaced artifacts that should be removed before the next large feature/refactor, especially before Asset Family / Security Lineage implementation.

Current architecture baseline used for this audit:

- Runtime market-history reads are DB-only.
- Provider calls are explicit Admin/CLI workflows only.
- Active provider workflow is yfinance-based for validation/backfill/update.
- OpenFIGI is optional candidate/admin workflow only (not runtime).
- Alpha Vantage is not part of the intended architecture.
- `/settings` exposes only `Parqet-Verbindung` and `Darstellung`.
- Header portfolio selection is the normal user-facing portfolio selection path.
- Dashboard, Activities and Asset Detail can auto-bootstrap/recover local data.
- `/admin` is isolated in `(admin)`.

## Findings

### 1) Alpha Vantage code path

- Artifact: Alpha Vantage provider implementation files
- Current path/reference:
  - `src/lib/market-data/alpha-vantage.ts`
  - `src/lib/market-data/alpha-vantage-parser.ts`
  - docs references in `README.md`, `docs/MARKET_DATA_PIPELINE.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/PIPELINE_INVENTORY.md`, `docs/V1_GUARDRAILS.md`
- Why it is stale: intended architecture is yfinance-based provider operations with DB-only runtime reads; Alpha Vantage is not part of planned provider direction.
- Delete now?: later
- Required follow-up changes:
  - Remove Alpha Vantage provider implementation files.
  - Remove Alpha Vantage references from docs/prompt text except explicit cleanup tracking.
  - Ensure runtime/service/provider selection code has no Alpha Vantage route.
  - Update market-data docs after code deletion.
- Risk level: medium
- Recommended cleanup branch/issue title: `chore/remove-alpha-vantage-provider-path`

### 2) Old Settings workflow references

- Artifact: references to removed Settings UX sections
- Current path/reference:
  - historical wording targets: `Portfolio/Daten`, `Manuelle Auswahl`, local diagnostics/debug/export controls
  - this branch verifies removed Settings cards are already reflected in active docs
- Why it is stale: current `/settings` scope is only connection + appearance.
- Delete now?: yes (docs references)
- Required follow-up changes:
  - Keep all active docs aligned with current Settings page.
  - Remove any remaining references to removed Settings controls as active workflow.
- Risk level: low
- Recommended cleanup branch/issue title: `docs/remove-stale-settings-workflow-references`

### 3) Manual-only Dashboard recovery wording

- Artifact: wording that implies Activities/Asset Detail require manual Dashboard load as the only recovery path
- Current path/reference:
  - historical wording target in quickstart/status docs
  - this branch baseline already documents auto-bootstrap/cache recovery behavior
- Why it is stale: current app can bootstrap local dashboard/activity data in reconnect/missing-cache flows.
- Delete now?: yes (docs references)
- Required follow-up changes:
  - Keep docs language explicit: local cache reuse first, auto-bootstrap recovery available, explicit refresh still user-controlled.
  - Avoid wording that blocks current bootstrap model.
- Risk level: low
- Recommended cleanup branch/issue title: `docs/remove-manual-only-dashboard-recovery-wording`

### 4) Old Admin route duplicates outside `(admin)`

- Artifact: obsolete admin app routes outside the `(admin)` route group
- Current path/reference:
  - verified current admin UI paths are under `src/app/(admin)/admin/*`
  - no `src/app/admin/*` duplicate route found
- Why it is stale: duplicate admin routes outside `(admin)` would contradict current route-group isolation.
- Delete now?: no (verified absent)
- Required follow-up changes:
  - Keep route-group isolation rule in docs/governance.
  - Re-check on future admin refactors.
- Risk level: low
- Recommended cleanup branch/issue title: `chore/verify-admin-route-group-isolation`

### 5) Phase-1 / Global Asset stale narrative

- Artifact: long historical Phase-1 and migration narrative blocks that can misdirect current planning
- Current path/reference:
  - most visible risk areas are long-form governance/strategy docs outside this PR #380 compact baseline set
- Why it is stale: current baseline is post-PR #378 architecture with explicit runtime/provider/admin boundaries; oversized historical narrative can conflict with current execution focus.
- Delete now?: later
- Required follow-up changes:
  - Compress historical sections that no longer guide active work.
  - Keep only current-state architecture, operator boundaries, and actionable follow-ups.
  - Move purely historical details to issue/ADR references when needed.
- Risk level: medium
- Recommended cleanup branch/issue title: `docs/compress-stale-phase1-global-asset-narrative`

## Additional audit scope for follow-up cleanup PR

- Unused scripts, parsers, helpers, tests and docs connected to removed provider/UI flows should be deleted together with the corresponding implementation removal PR.
- Do not keep replaced provider/UI paths as compatibility text unless a task explicitly requires a transitional path.
