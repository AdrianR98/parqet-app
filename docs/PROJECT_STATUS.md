# Project Status

Status: Active baseline aligned to current architecture
Owner: AdrianR98
Last reviewed: 2026-05-27

## Active Documentation Refactor Context

- Refs #384: Phase 1 domain language/model-boundary hardening.
- Fixes #385: Documentation baseline for the domain refactor roadmap before implementation changes.

## Phase 2 Kickoff (AssetSummary Removal Track)

- Refs #384, Refs #386: `AssetSummary` deprecation is now explicit in code and documentation.
- The complete file-level removal inventory and phased migration slices are documented in `docs/ASSET_SUMMARY_REMOVAL_PLAN.md`.
- Phase 2B implementation completed on branch `refactor/phase-2-asset-summary-deprecation`: runtime/test usage of `AssetSummary` was removed and compatibility projection paths were deleted.

## Phase 3 Planning (Calculation Model Track)

- Refs #384, Refs #387, Refs #393: Phase 3 planning baseline is documented in `docs/CALCULATION_MODEL_PLAN.md`.
- Scope is planning/documentation only in this step; runtime extraction is intentionally deferred to follow-up slices on `refactor/phase-3-calculation-model`.
- #393 remains active technical debt and is explicitly sequenced as part of the first implementation slice, not as final architecture.
- Slice 1 boundary bootstrap is now in progress on `refactor/phase-3-calculation-model`: runtime fallback classification is explicit (`runtime_assets_fallback`) and `GlobalAssetViewModel` field groups are typed/documented for later extraction.
- Slice 2 has started on the same branch/PR thread: first shared calculation boundary module (`src/lib/calculations/global-asset-metrics.ts`) is wired into legacy runtime builders (`build-corrected-assets`/`grouping`) while preserving current output shape.
- Slice 3 has started on the same branch/PR thread: shared UI/reporting aggregation helpers now live in `src/lib/calculations/view-model-aggregates.ts`, and dashboard/reporting surfaces consume these helpers instead of duplicating scoped math.
- Slice 4 has started on the same branch/PR thread: Product Read Model -> `GlobalAssetViewModel` projection moved into `src/lib/view-models/global-asset-view-model-builder.ts`, and guarded source selectors are now focused on validation/selection/diagnostics only.
- Slice 5 has started on the same branch/PR thread: dashboard allocation segment shaping and allocation ratio formulas were moved into shared calculation helpers in `src/lib/calculations/view-model-aggregates.ts`.
- Slice 6 has started on the same branch/PR thread: asset detail selected-portfolio scope resolution moved from `AssetDetailPage.tsx` into `src/lib/asset-detail.ts` (`resolveSelectedAssetScope`), reducing page-owned calculation/scope logic.
- Slice 7 closeout is completed on the same branch/PR thread: asset-detail portfolio-breakdown display metric shaping was moved into `src/lib/calculations/view-model-aggregates.ts`, and remaining runtime fallback wording was aligned to `runtime_assets_fallback` / runtime fallback state terminology.
- Slice 8 PRM-parity work is in progress on the same branch/PR thread: upstream global-asset aggregation and PRM projection now populate dashboard-critical valuation/cost-basis/dividend metrics (including portfolio-breakdown money metrics) so canonical dashboard/asset-table surfaces can consume PRM data directly.
- Phase 3 implementation is now complete for the planned modular-calculation scope on `refactor/phase-3-calculation-model`.
- #393 is partially resolved in this PR: fallback/source semantics are finalized, but a small set of temporary continuity fields is still intentionally retained for timeline/report sorting consumers and is documented as explicit remaining debt.

## Phase 4 Kickoff (Database Asset Model + Scale Strategy)

- Refs #384, Refs #388, Refs #395, Refs #396, Refs #397, Refs #398: Phase 4 planning baseline is now documented in `docs/DATABASE_ASSET_MODEL_PLAN.md`.
- This first Phase 4 task is inventory/planning only: current DB/market-data entities, naming gaps, data-flow boundaries and price-history scale strategy were documented without runtime/schema changes.
- Follow-up execution slices stay on branch `refactor/phase-4-database-asset-model` and are sequenced to support:
  - #395 latest market-price overlay read model,
  - #396 transfer/cost-basis semantics with reference-event context,
  - #397 currency/FX boundary for PRM money metrics,
  - #398 source/timestamp/confidence provenance fields.
- First implementation slice is now started on the same branch/PR thread: additive schema migration `006_asset_reference_data_schema.sql` introduces target Asset/reference-data tables while legacy `market_*` tables remain active during transition.
- Intentional transition state: runtime/admin reads still use legacy tables until repository/service cutover slices are implemented.
- Slice 4 latest-market-price read support is now started on the same branch/PR thread: Asset-oriented repository/service functions read from `assets` + `asset_daily_prices` and derive latest market price snapshots without introducing `asset_latest_prices`.
- Migration `006_asset_reference_data_schema.sql` has now been manually validated locally by the user via `npm run db:market:migrate`; target tables were created and legacy `market_*` tables remain during staged transition.
- Phase 4 local backfill utility now exists: `npm run db:market:backfill:asset-reference` (optional `-- --dry-run`) to copy legacy `market_*` data into new Asset/reference-data tables without dropping legacy tables.
- Local write backfill completed successfully via `npm run db:market:backfill:asset-reference`: 90 assets, 171 asset symbol mappings, 590,186 daily prices, 6,599 dividend events and 191 corporate-action events were inserted into the new Asset/reference-data schema with zero skipped/unresolved rows. Detailed validation is recorded in `docs/PHASE4_BACKFILL_VALIDATION.md`.
- Migration `007_asset_daily_prices_latest_provider_index.sql` records the manually tested latest-market-price index for `asset_daily_prices`: `(provider, asset_id, price_date desc) include (close_price, currency, price_timestamp)`. This supports #395 without introducing `asset_latest_prices`.
- First runtime price-read cutover after dropping `public.market_prices_daily` is now implemented on PR #399: repository/admin/history price reads and active daily-price writes use `asset_daily_prices`, while legacy `market_instruments` joins are retained only as transitional admin identity mapping.

## Current Baseline

- Next.js Parqet Integration with Parqet OAuth for authorized portfolio access.
- User Portfolio Data is cached browser-local for Dashboard, Activities and Asset Detail.
- `/settings` is simplified to `Parqet-Verbindung` and `Darstellung`.
- Disconnect clears server-side Parqet auth cookies and Parqet-derived browser-local data while keeping appearance/UI preferences.
- Header portfolio selection is the user-facing selection path.
- Dashboard, Activities and Asset Detail can recover missing local cache via bootstrap/cache-change flow.
- `/admin` is isolated in `(admin)` and currently read-only for market-data inspection/triage.
- Runtime market-history reads are DB-only.
- Provider calls are restricted to explicit Admin/CLI workflows.

## Market-Data Direction

- Current provider workflow for validation/backfill/update is yfinance-based.
- OpenFIGI may be used as candidate lookup/admin workflow.

## Follow-Ups

1. Full Admin Auth/AuthZ hardening before production admin enablement.
2. CSP nonce/hash strategy for inline root scripts.
3. Cache-event debounce/performance pass.
4. Dark-mode asset/logo research: issue #379.
5. Future corporate-action/security-lineage planning.

## Future Corporate-Action / Lineage Work (Not Implemented)

Goal: show merged economic history across related instruments without rewriting raw activities.

Current building blocks:

- `market_actions`
- instrument successor fields/status
- yfinance split/dividend import
- admin triage workflows

Needed next:

- explicit Asset Family / Security Lineage model
- verified event sources
- cost-basis/quantity invariants
- UI toggle between concrete Instrument history and Asset Family history
