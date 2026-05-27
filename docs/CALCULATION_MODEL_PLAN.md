# Calculation Model Plan (Phase 3)

Status: implementation complete for Phase 3 scope on this branch (through Slice 7 cleanup)  
Linked issues: Refs #384, Refs #387, Refs #393  
Branch rule: all Phase 3 follow-up tasks stay on `refactor/phase-3-calculation-model` (same branch / same PR thread)

## Slice 1 implementation note (2026-05-27)

- First boundary typing was introduced in code for `GlobalAssetViewModel` field groups (identity/display, metrics, portfolio breakdown, metadata, temporary continuity).
- Runtime fallback selection was reclassified from generic PRM-unavailable wording to explicit `runtime_assets_fallback`.
- `currentAssets` naming in canonical-safe-source selectors/helpers was replaced with `runtimeFallbackAssets` to reflect non-canonical fallback semantics.
- #393 follow-up is now partially resolved: fallback/source terminology and boundary classification are complete; temporary continuity fields still remain where runtime/UI consumers depend on them.

## Slice 2 implementation note (2026-05-27)

- A first shared calculation boundary module was added: `src/lib/calculations/global-asset-metrics.ts`.
- Legacy runtime builders `src/lib/parqet-assets/build-corrected-assets.ts` and `src/lib/parqet-assets/grouping.ts` now consume shared pure helpers for:
  - buy/sell/transfer position deltas
  - `totalBoughtShares` / `totalSoldShares`
  - `remainingCostBasis` proportional reduction on sell-like events
  - `avgBuyPrice`, `positionValue`, `unrealizedPnL`
  - `latestTradePrice` update policy
  - dividend net summation and rounding normalization.
- `src/lib/parqet-assets/consistency.ts` now reuses shared tolerance constants from the same calculation module.
- Output API/UI shape remains unchanged in this slice; `GlobalAssetViewModel` temporary continuity fields are still present by design.

## Slice 3 implementation note (2026-05-27)

- Added shared view/report aggregation module: `src/lib/calculations/view-model-aggregates.ts`.
- Extracted and centralized:
  - scoped portfolio re-aggregation for `GlobalAssetViewModel`
  - active/closed split (`netShares` epsilon policy)
  - safe totals aggregation (`positionValue`, `unrealizedPnL`, `totalDividendNet`)
  - reporting portfolio breakdown aggregation by portfolio name.
- Rewired consumers:
  - `src/app/(app)/dashboard/page.tsx`
  - `src/lib/reporting.ts`
  - `src/lib/asset-detail.ts`
  - `src/lib/dashboard-helpers.ts`
  - `src/hooks/use-dashboard-data.ts`
  - `src/lib/dashboard-cache-writer.ts`
  - `src/components/dashboard/AssetTable.tsx`
- Result: UI/reporting files now consume calculation helpers instead of owning aggregation formulas directly.

## Slice 4 implementation note (2026-05-27)

- Product Read Model -> `GlobalAssetViewModel` projection was extracted from
  `src/lib/parqet/global-assets/product-surface-selectors.ts` into
  `src/lib/view-models/global-asset-view-model-builder.ts`.
- `product-surface-selectors.ts` now owns only:
  - Product Read Model read/validation
  - source/guard selection
  - blocked-metric and affected-field diagnostics.
- Rewired consumers:
  - `src/lib/dashboard-helpers.ts`
  - `src/lib/reporting.ts`
  - `tests/pipeline/global-assets-guarded-surface-migration.test.ts`
- Projection math now reuses `calculateAvgBuyPrice` from
  `src/lib/calculations/global-asset-metrics.ts`.

## Slice 5 implementation note (2026-05-27)

- Removed legacy wording in `product-surface-selectors.ts` comments:
  - from "compatibility fallback" to "runtime fallback data".
- Extracted UI-side allocation calculation cluster into
  `src/lib/calculations/view-model-aggregates.ts`:
  - `buildAllocationSegmentsFromAssets`
  - `calculateAllocationRatioPercent`
- Rewired consumers:
  - `src/app/(app)/dashboard/page.tsx` now consumes helper-based allocation segment shaping/sorting.
  - `src/components/dashboard/asset-table-columns.tsx` now consumes helper-based allocation ratio calculation.

## Slice 6 implementation note (2026-05-27)

- Extracted asset-detail portfolio scope resolution from
  `src/app/(app)/assets/AssetDetailPage.tsx` into
  `src/lib/asset-detail.ts`:
  - `resolveSelectedAssetScope`
  - `SelectedAssetScope`
- Result: asset detail page now consumes helper-provided selected scope ids/mode
  instead of owning scope intersection logic.
- This keeps asset-detail scoped metric calculation and selected-portfolio filtering
  clustered in lib helper boundaries.

## Slice 7 completion note (2026-05-27)

- Extracted asset-detail portfolio breakdown display metric calculations from
  `src/app/(app)/assets/AssetDetailPage.tsx` into
  `src/lib/calculations/view-model-aggregates.ts`:
  - `buildPortfolioBreakdownDisplayEntries`
  - shared share/value display threshold and percent shaping logic
- Removed remaining "compatibility fallback" wording in runtime selector consumers:
  - `src/lib/dashboard-helpers.ts`
  - `src/lib/reporting.ts`
- Result: asset-detail page now consumes helper-produced portfolio-breakdown display metrics instead of owning these calculations.

## 1. Current calculation inventory

### Inventory matrix

| Metric / output | Current calculation hotspot(s) | Current layer classification | Move in Phase 3? |
| --- | --- | --- | --- |
| `netShares` | `src/lib/parqet-assets/build-corrected-assets.ts` (activity loop); `src/lib/asset-detail.ts` + `src/app/(app)/dashboard/page.tsx` (scope re-aggregation); `src/lib/parqet/global-assets/product-surface-selectors.ts` (PRM row -> VM) | legacy helper-level + UI-level + PRM->VM projection | Yes. Centralize in calculation layer; UI should consume already-scoped values. |
| `totalBoughtShares` / `totalSoldShares` | `src/lib/parqet-assets/build-corrected-assets.ts` | legacy helper-level | Yes. Keep only if explicitly required by UI/reporting; otherwise move to optional diagnostics payload. |
| `remainingCostBasis` | `src/lib/parqet-assets/build-corrected-assets.ts` (proportional sell/transfer-out reduction); UI re-scope in `asset-detail.ts` / `dashboard/page.tsx`; PRM->VM uses `row.costBasis.amount ?? 0` | legacy helper-level + UI-level + PRM projection fallback | Yes. Own in cost-basis calculator; remove UI recomputation. |
| `avgBuyPrice` | derived in `build-corrected-assets.ts`, `asset-detail.ts`, `dashboard/page.tsx`, PRM->VM builder | helper/UI/PRM projection derived formula | Yes. Derived once in calculation layer from scoped cost basis + net shares. |
| `latestTradePrice` | set in `build-corrected-assets.ts` from buy/sell/transfer activity prices; PRM->VM currently hardcoded `null` | legacy helper-level; missing in PRM path | Yes. Move to position calculator as optional metric (explicit confidence/status). |
| `marketPrice` | legacy VM field mostly unset in route pipeline; PRM->VM maps `row.marketValue.amount` into `marketPrice`; market overlay currently enriches identity, not priced values | mixed compatibility + PRM projection | Yes. Clarify as valuation input vs derived output; avoid overloading field semantics. |
| `positionValue` | `build-corrected-assets.ts` (`effectivePrice * netShares`); UI scoped sums; `buildDashboardStats`; reporting totals; PRM->VM from `row.marketValue.amount` | helper-level + UI-level + dashboard/report aggregations + PRM projection | Yes. Move to position/performance calculator; dashboards/reports only aggregate ready values. |
| `unrealizedPnL` | `build-corrected-assets.ts` (`positionValue - remainingCostBasis`); UI scoped sums; dashboard/reporting totals; PRM->VM from `row.unrealizedPnL.amount` | helper-level + UI-level + aggregations + PRM projection | Yes. Move to performance calculator and keep nullability/classification explicit. |
| `totalDividendNet` | `build-corrected-assets.ts` (dividend activity sum); `src/lib/parqet/global-assets/aggregate.ts` (currency-aware money sum); UI scoped sums; dashboard/reporting totals | helper-level + PRM aggregation + UI aggregation | Yes. Keep dedicated dividend calculator and reconciliation module. |
| `portfolioBreakdown` | built in `build-corrected-assets.ts`; separately built in `parqet/global-assets/aggregate.ts`; re-filtered/scoped in UI and reporting | helper-level + PRM aggregation + UI-level transformations | Yes. Build once per scope in calculation layer; UI displays only. |
| active/closed split | route split (`asset.netShares > 1e-8`), cache writer split, dashboard page split, reporting row status | route/helper/UI/reporting | Yes. Single status classifier module; shared epsilon and status policy. |
| dashboard totals (`totalPositionValue`, `totalUnrealizedPnL`, `totalDividendNet`) | `buildDashboardStats`; additional scoped totals in dashboard page | helper + UI duplication | Yes. Move scoped totals to calculation aggregator. |
| reporting totals/breakdown | `src/lib/reporting.ts` (`toReportRows`, `buildBreakdown`, totals reduce) | reporting helper-level | Partly. Keep reporting formatter, move financial aggregation logic to shared calculators. |
| warning / blocked metric handling | legacy warnings in `parqet-assets/reconciliation.ts` + `consistency.ts`; blocked metrics in `parqet/global-assets/normalize.ts`, `aggregate.ts`, `product-read-model.ts`; source gate in `product-surface-selectors.ts` | mixed legacy + PRM metric-gate layer | Yes. Unify as `metric-gates` + standardized warning/blocked contracts. |

### Additional hotspot notes

- GlobalAssetViewModel creation currently has two independent builders:
  - legacy runtime builder: `src/lib/parqet-assets/build-corrected-assets.ts`
  - PRM projection builder: `src/lib/parqet/global-assets/product-surface-selectors.ts` (`buildGlobalAssetViewModelsFromProductReadModel`)
- Product Read Model creation path:
  - `src/lib/parqet/global-assets/coexistence.ts`
  - `src/lib/parqet/global-assets/normalize.ts`
  - `src/lib/parqet/global-assets/aggregate.ts`
  - `src/lib/parqet/global-assets/product-read-model.ts`
- Market metadata overlay is route-level in `src/app/api/parqet/assets/route.ts`:
  - `applyMarketInstrumentMetadataOverlay` (legacy VM)
  - `overlayGlobalAssetProductDisplayFromMarketMetadata` (PRM display/instrument snapshot)

## 2. Proposed module structure

Goal: move metric ownership into purpose-based modules and keep ViewModel builders thin.

### Proposed modules

1. `activity-normalizer`
- Responsibility: canonicalize activity rows, typed amounts/quantities, identity/context validation, normalization warnings.
- Source today: `src/lib/parqet/global-assets/normalize.ts` plus parts of `src/lib/parqet-assets/normalization.ts`.

2. `global-asset-builder`
- Responsibility: group normalized activities into asset shells with timeline + portfolio buckets (no UI shape).
- Source today: grouping in `aggregate.ts`, legacy grouping in `build-corrected-assets.ts`.

3. `position-calculator`
- Responsibility: quantity deltas, net position, active/closed status, latest trade price policy.
- Source today: `build-corrected-assets.ts` + duplicated UI scope math.

4. `cost-basis-calculator`
- Responsibility: buy/sell/transfer_out basis math, scoped basis rollups, avg buy price derivation.
- Source today: `build-corrected-assets.ts` and UI/reporting re-aggregation.

5. `dividend-calculator`
- Responsibility: dividend net totals by asset/portfolio/scope with explicit nullability rules.
- Source today: legacy dividend sum + partial PRM money-metric handling.

6. `dividend-reconciliation`
- Responsibility: dividend-specific warnings, missing-currency handling, scope mismatch diagnostics.
- Source today: mixed in normalization/aggregation + generic warnings.

7. `corporate-action-matcher`
- Responsibility: future-safe placeholder for split/merge/migration impact on quantity/cost-basis.
- Note: keep narrow; no broad lineage implementation in this phase.

8. `transfer-matcher`
- Responsibility: classify transfer pairs and transfer uncertainty that affects position/cost-basis confidence.
- Source today: transfer behavior implicit in legacy helper and warning metadata.

9. `performance-calculator`
- Responsibility: compute `positionValue`, `unrealizedPnL`, and valuation confidence from position + pricing inputs.
- Critical note: this name is broad; keep scope limited to valuation/PnL formulas (not reporting/export concerns).

10. `metric-gates`
- Responsibility: blocked metric classification, affected-field mapping, freshness/scope gate decisions.
- Source today: `product-read-model.ts` + `product-surface-selectors.ts`.

11. `global-asset-view-model-builder`
- Responsibility: project calculated domain snapshot to `GlobalAssetViewModel` compatibility shape.
- Constraint: no financial formulas except trivial field mapping/null fallback.

12. `security-lineage-view-model-builder`
- Responsibility: reserved adapter only.
- Constraint: no implementation in Phase 3 (non-goal), only interface placeholder if needed.

### Consolidation guidance (avoid over-fragmentation)

- Do not create one-module-per-single-formula.
- Keep `position-calculator`, `cost-basis-calculator`, and `performance-calculator` as the main numerical core.
- Keep reporting/dashboard-specific aggregation wrappers thin and shared.

## 3. Scope boundaries

### Calculation modules own

- Position, cost-basis, dividend, valuation, and status formulas.
- Scoped portfolio aggregation logic.
- Metric confidence/blocking state and affected-field metadata.
- Deterministic epsilon/tolerance policies.

### ViewModel builders own

- Shape adaptation from domain calculation output to UI/runtime contracts.
- Compatibility fields during transition.
- No business-metric recomputation beyond direct mapping/derived display aliases.

### UI owns

- Rendering, sorting/filtering by already-calculated fields, formatting, chart composition.
- No metric ownership for `netShares`, `remainingCostBasis`, `avgBuyPrice`, `positionValue`, `unrealizedPnL`, `totalDividendNet`.

### DB/data-access layer owns

- Market metadata lookups, symbol mappings, persisted status flags, request logging.
- No position/cost-basis/dividend math.

### Product Read Model owns

- Transport/projection contract for guarded surfaces.
- Value classification and blocked-metric representation.
- No fallback compatibility math that should live in calculators.

### Cache helpers own

- Serialization, sanitization, cache versioning, safe persistence.
- Source selection bookkeeping (`guardedSourceSelection`) but not financial recalculation.

Hard rule reaffirmed: UI components must not own metric calculation logic.

## 4. Phase 3 implementation slices (same branch / same PR thread)

### Slice 1: Calculation boundary + #393 alignment bootstrap

- Purpose: introduce calculation snapshot interfaces/adapters and classify legacy VM fields before extraction.
- Files likely changed:
  - `src/lib/types.ts`
  - `src/lib/parqet/global-assets/product-surface-selectors.ts`
  - `src/lib/dashboard-helpers.ts`
  - `src/lib/reporting.ts`
  - `docs/CALCULATION_MODEL_PLAN.md` (update)
- Risk: Medium (touches shared contracts and selection boundaries).
- Verification command: `npm run lint`
- #393 sequencing: this slice should include the first #393 cleanup decisions (not postponed).

### Slice 2: Extract position + cost basis core calculators

- Purpose: move net shares, buy/sell totals, cost basis, avg buy price, active/closed classification into shared calculators.
- Files likely changed:
  - `src/lib/parqet-assets/build-corrected-assets.ts`
  - `src/lib/parqet-assets/grouping.ts`
  - `src/lib/parqet-assets/consistency.ts`
  - new `src/lib/calculations/global-asset-metrics.ts`
- Risk: High (behavior-sensitive and currently duplicated in UI).
- Verification command: `npm run build`
- #393 sequencing: after Slice 1 boundary cleanup starts.

Remaining direct calculation hotspots after Slice 7:
- `src/app/(app)/dashboard/page.tsx`
- `src/lib/reporting.ts`
- `src/components/dashboard/asset-table-columns.tsx` (display formatting only; ratio formula moved to helper)
- `src/components/asset-detail/AssetDetailTimelineChart.tsx` (timeline clustering/range shaping)

Phase 3 closeout note:
- These remaining hotspots are intentionally UI/timeline presentation shaping or report formatting.
- Reusable financial/scoped metric logic is now calculation-layer owned.

### Slice 3: Extract dividend + reconciliation calculators

- Purpose: unify dividend totals and warning pathways across legacy and PRM flows.
- Files likely changed:
  - `src/lib/parqet-assets/build-corrected-assets.ts`
  - `src/lib/parqet/global-assets/aggregate.ts`
  - new `src/lib/parqet/calculation-model/dividend-calculator.ts`
  - new `src/lib/parqet/calculation-model/dividend-reconciliation.ts`
  - `src/app/(app)/assets/AssetDetailPage.tsx` (consume, not recalculate)
- Risk: Medium-High.
- Verification command: `npm run lint`
- #393 sequencing: after Slice 1.

### Slice 4: Extract performance + metric gates

- Purpose: centralize `positionValue` / `unrealizedPnL` formulas and blocked-metric gate decisions.
- Files likely changed:
  - `src/lib/parqet/global-assets/product-read-model.ts`
  - `src/lib/parqet/global-assets/product-surface-selectors.ts`
  - new `src/lib/parqet/calculation-model/performance-calculator.ts`
  - new `src/lib/parqet/calculation-model/metric-gates.ts`
- Risk: High (coexistence and guarded-source behavior).
- Verification command: `npm run build`
- #393 sequencing: after Slice 1.

### Slice 5: Remove UI-owned metric recomputation and align reporting/dashboard adapters

- Purpose: eliminate duplicated formula logic in UI/reporting and use shared scoped calculation outputs.
- Files likely changed:
  - `src/app/(app)/dashboard/page.tsx`
  - `src/lib/asset-detail.ts`
  - `src/lib/reporting.ts`
  - `src/components/dashboard/AssetTable.tsx`
  - `src/components/dashboard/asset-table-columns.tsx`
- Risk: Medium.
- Verification command: `npm run lint`
- #393 sequencing: after Slice 2 and Slice 4.

## 5. Interaction with #393

## Legacy-shaped GlobalAssetViewModel fields (current debt)

- Identity/display duplication:
  - `name`, `assetName`, `displayName`, `title`, `curatedName`, `instrumentDisplayName`, `instrumentName`
- Symbol duplication:
  - `symbol`, `ticker`, `tickerSymbol`
- Metadata duplication:
  - top-level metadata source fields plus `metadata`, `externalMetadata`, `assetMeta`
- Legacy continuity counters not represented by PRM projection:
  - `activityCount`, `buyCount`, `sellCount`, `dividendCount`, `totalBoughtShares`, `totalSoldShares`, `totalInvestedGross`, `latestTradePrice`
  - PRM projection currently fills several with `0`/`null`, which is shape-compatible but semantically weak.

## Recommended treatment

- Remove:
  - purely redundant alias fields once callers are migrated.
- Rename/group:
  - fold display aliases into a single display object contract in calculation output and VM mapping.
- Keep temporarily:
  - fields still needed by existing UI components until those consumers are migrated in later slices.

## `currentAssets` fallback classification

- Classify as: **runtime fallback state** (already-loaded runtime projection), not canonical calculation source.
- Policy:
  - allowed when PRM is missing/invalid/not fresh/scope-mismatch/empty.
  - must remain visible in guarded diagnostics and be explicitly traceable.

## #393 status after Phase 3 closeout

- Completed in this branch:
  - canonical guarded-source naming uses `runtime_assets_fallback`
  - no compatibility-source selection path remains
  - runtime fallback is explicitly modeled as non-canonical calculation output
  - continuity field group is explicit (`GlobalAssetViewModelTemporaryContinuityFields`)
- Still open (exact remaining consumers):
  - `buyCount` / `sellCount` / `dividendCount` and `latestActivityAt` are still consumed by
    `src/components/asset-detail/AssetDetailTimelineChart.tsx` and dashboard/report sorting.
  - continuity counters remain populated by legacy runtime builders and zero-initialized in PRM projection builder for shape continuity.
- Decision:
  - keep these fields temporarily to avoid broad UI/reporting churn in Phase 3.
  - removal/migration should happen as part of a dedicated post-Phase-3 view-model cleanup pass.

## 6. Non-goals (Phase 3 planning + extraction)

- No `SecurityLineage` implementation.
- No database refactor.
- No `Instrument` rename campaign.
- No `AssetSummary` reintroduction.
- No new provider calls.

## API Budget Impact

None for this planning step.  
Implementation target: no additional provider calls introduced by calculation extraction.

## Privacy / Data Impact

None for this planning step.  
No private portfolio payloads are required in docs or logs.
