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
- Phase 3 implementation is now complete for the planned modular-calculation scope on `refactor/phase-3-calculation-model`.
- #393 is partially resolved in this PR: fallback/source semantics are finalized, but a small set of temporary continuity fields is still intentionally retained for timeline/report sorting consumers and is documented as explicit remaining debt.

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
