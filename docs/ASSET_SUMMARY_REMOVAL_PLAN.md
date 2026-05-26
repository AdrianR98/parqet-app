# AssetSummary Removal Plan

Status: Phase 2 kickoff (Refs #384, Refs #386)  
Last updated: 2026-05-27

## Decision

- `AssetSummary` is deprecated immediately.
- `AssetSummary` must be removed completely.
- No compatibility adapter survives the final removal.
- New read paths must converge on `GlobalAsset`, `GlobalAssetMetrics`, `GlobalAssetViewModel`, and product/read-model outputs.

## Scope Of This Task

- Explicitly mark `AssetSummary` as deprecated in code.
- Freeze new usage by policy: no new `AssetSummary` dependencies are allowed.
- Produce a complete inventory and phased removal map before destructive refactors.
- Do not remove `AssetSummary` fully in this task.

## Baseline Inventory Snapshot

- Search pattern: `AssetSummary`
- Baseline match count: `163`
- Baseline file count: `31`
- Primary clusters:
  - API/type contracts and compatibility projection
  - Dashboard/cache/read-model wiring
  - Asset-detail/display helper surfaces
  - Legacy docs and migration test fixture

## Suggested Follow-Up Slices

- `P2-1` Contract cutover: route and top-level type contracts move away from `AssetSummary[]`.
- `P2-2` Compatibility bridge shutdown: remove `AssetSummary` projection in global-asset selectors.
- `P2-3` Cache payload cutover: dashboard cache reader/writer and hook state move to `GlobalAssetViewModel`.
- `P2-4` Dashboard UI cutover: table/config/page/components consume `GlobalAssetViewModel`.
- `P2-5` Asset detail cutover: detail page/chart/logo/helpers consume `GlobalAssetViewModel` (or narrower asset VM types).
- `P2-6` Helper/domain cutover: reporting, metadata, grouping, consistency helpers move to `GlobalAsset`/`GlobalAssetMetrics`.
- `P2-7` Docs/tests cleanup: remove legacy docs language and compatibility fixtures.

## Detailed Usage Inventory

| file | usage type | current role | replacement target | removal risk | suggested follow-up slice |
| --- | --- | --- | --- | --- | --- |
| `src/lib/types.ts` | type definition + API response shape | Declares `AssetSummary`; exposes `assets/activeAssets/closedAssets` payload arrays | `GlobalAsset`, `GlobalAssetMetrics`, `GlobalAssetViewModel`, product/read-model output | High | `P2-1` |
| `src/app/api/parqet/assets/route.ts` | route response shape + typed transforms | Builds/enriches response objects still typed as `AssetSummary` | Product/read-model output and explicit view-model projection | High | `P2-1` |
| `src/lib/parqet/global-assets/product-surface-selectors.ts` | compatibility adapter + fallback projection | Projects product-read-model rows back into `AssetSummary` for legacy surfaces | Remove without replacement after callers consume view-model/product rows directly | High | `P2-2` |
| `src/lib/parqet/global-assets/product-read-model.ts` | compatibility type naming | Contains `ProductReadModelCompatibilityAssetSummaryInput` naming bridge | Rename to product-read-model/global-asset naming only | Medium | `P2-2` |
| `src/lib/dashboard-cache.ts` | cache payload types + sanitization | Reads/sanitizes cached `AssetSummary` arrays | `GlobalAssetViewModel` cache payload schema | High | `P2-3` |
| `src/lib/dashboard-cache-writer.ts` | cache writer payload typing | Splits/writes selected and grouped `AssetSummary` arrays | `GlobalAssetViewModel` cache writer schema | High | `P2-3` |
| `src/hooks/use-dashboard-data.ts` | hook state types | Stores/sorts/splits dashboard data as `AssetSummary[]` | `GlobalAssetViewModel[]` | High | `P2-3` |
| `src/app/(app)/dashboard/page.tsx` | page-level filtering/grouping typing | Dashboard filtering/search/allocation logic is typed with `AssetSummary` | `GlobalAssetViewModel` | High | `P2-4` |
| `src/components/dashboard/AssetTable.tsx` | dashboard component prop type | Root table component takes `AssetSummary[]` | `GlobalAssetViewModel[]` | High | `P2-4` |
| `src/components/dashboard/AssetTableRows.tsx` | dashboard component prop + cell rendering | Row and cell rendering rely on `AssetSummary` | `GlobalAssetViewModel` | High | `P2-4` |
| `src/components/dashboard/asset-table-columns.tsx` | table column model typing | Column helpers and expanded-row renderers typed by `AssetSummary` | `GlobalAssetViewModel` | High | `P2-4` |
| `src/components/dashboard/asset-table-config.ts` | table helper typing | Safe breakdown and table sorting helpers accept `AssetSummary[]` | `GlobalAssetViewModel` plus focused breakdown model | Medium | `P2-4` |
| `src/components/dashboard/CollapsibleAssetTableSection.tsx` | dashboard section prop type | Collapsible section receives `AssetSummary[]` | `GlobalAssetViewModel[]` | Medium | `P2-4` |
| `src/components/dashboard/AssetAuditPanel.tsx` | dashboard panel prop typing | Audit panel state includes `AssetSummary` references | Product/read-model output or dedicated audit view model | Medium | `P2-4` |
| `src/lib/dashboard-helpers.ts` | helper function inputs/outputs | Sorting/stat projections and compatibility fallback functions use `AssetSummary[]` | `GlobalAssetViewModel[]` and/or `GlobalAssetMetrics` | High | `P2-4` |
| `src/lib/asset-detail.ts` | asset-detail helper typing | Slug/href/find/display helpers accept `AssetSummary` | Asset-detail-specific `GlobalAssetViewModel` projection | High | `P2-5` |
| `src/app/(app)/assets/AssetDetailPage.tsx` | asset-detail page typing | Selected scope resolution consumes `AssetSummary` | Asset-detail-specific `GlobalAssetViewModel` | High | `P2-5` |
| `src/components/asset-detail/AssetDetailTimelineChart.tsx` | asset-detail component prop type | Timeline chart takes `AssetSummary` | Asset-detail-specific `GlobalAssetViewModel` | Medium | `P2-5` |
| `src/components/common/AssetLogo.tsx` | shared component prop type | Shared logo component accepts `AssetSummary` | Narrow shared asset identity/display model | Medium | `P2-5` |
| `src/lib/asset-display.ts` | display helper typing | Name/symbol/subtitle/logo helpers operate on `AssetSummary` | Narrow shared asset display model from `GlobalAssetViewModel` | Medium | `P2-5` |
| `src/lib/asset-metadata.ts` | metadata helper typing | Missing-metadata and enrichment paths typed as `AssetSummary[]` | `GlobalAsset` + metadata augmentation model | Medium | `P2-6` |
| `src/lib/parqet-assets/activity-types.ts` | alias/type dependency | `AssetAccumulator` is currently an alias of `AssetSummary` | Dedicated accumulator model based on `GlobalAssetMetrics` inputs | Medium | `P2-6` |
| `src/lib/parqet-assets/grouping.ts` | aggregation helper output type | Grouping function returns `AssetSummary[]` | `GlobalAsset`/`GlobalAssetMetrics` aggregate output | High | `P2-6` |
| `src/lib/parqet-assets/build-corrected-assets.ts` | correction helper output type | Builds corrected aggregated assets as `AssetSummary[]` | Product/read-model-safe aggregate output | High | `P2-6` |
| `src/lib/parqet-assets/consistency.ts` | consistency check input type | Consistency checks run against `AssetSummary` | `GlobalAsset`/`GlobalAssetMetrics` consistency input | Medium | `P2-6` |
| `src/lib/reporting.ts` | reporting helper inputs | Reporting calculations take `AssetSummary[]` | `GlobalAssetViewModel[]` or dedicated reporting DTO | Medium | `P2-6` |
| `src/lib/market-data/runtime-requests.ts` | runtime request typing | Request helpers accept `AssetSummary[]` input | Product/read-model output or dedicated runtime request DTO | Medium | `P2-6` |
| `tests/pipeline/global-assets-guarded-surface-migration.test.ts` | test fixture/type import | Compatibility fixture factory returns `AssetSummary[]` | Fixture based on `GlobalAssetViewModel` and product rows | Low | `P2-7` |
| `docs/DATA_MODEL.md` | docs reference (legacy model section) | Documents `AssetSummary` as central aggregate model | Update to `GlobalAsset`/`GlobalAssetMetrics`/`GlobalAssetViewModel` terms | Low | `P2-7` |
| `docs/DOMAIN_LANGUAGE.md` | docs reference (deprecation policy) | Declares deprecation rule in vocabulary | Keep rule; link to completion and remove once code is fully migrated | Low | `P2-7` |
| `docs/DOMAIN_MODEL_BOUNDARIES.md` | docs reference (boundary rule) | States deprecation as boundary rule | Keep boundary; remove mention only after final deletion | Low | `P2-7` |

## Removal Completion Criteria

- No `AssetSummary` references remain in `src/**`, `tests/**`, or docs that define active runtime behavior.
- API response contracts and cache payloads are fully typed by product/read-model outputs or view-model types.
- Compatibility projection in `product-surface-selectors` is deleted, not retained as fallback.
- Dashboard and asset-detail surfaces consume `GlobalAssetViewModel` (or stricter VM slices) end-to-end.
