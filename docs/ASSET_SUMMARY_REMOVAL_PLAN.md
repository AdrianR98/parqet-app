# AssetSummary Removal Plan

Status: Phase 2B implemented (Refs #384, Refs #386)  
Last updated: 2026-05-27

## Decision

- `AssetSummary` is removed from runtime code (`src/**`) and tests (`tests/**`).
- No ProductReadModel-to-`AssetSummary` compatibility projection remains.
- Runtime surfaces now use `GlobalAssetViewModel` and Product Read Model outputs.

## Runtime Removal Result

- Search pattern: `AssetSummary`
- `src/**`: `0` matches
- `tests/**`: `0` matches
- Remaining matches are documentation-only historical references.

## Slice Status

| slice | status | notes |
| --- | --- | --- |
| `P2-1` Contract cutover | done | `AssetSummary` removed from `src/lib/types.ts`; API response uses `GlobalAssetViewModel[]` and typed Product Read Model payload. |
| `P2-2` Compatibility bridge shutdown | done | Legacy projection in `product-surface-selectors` removed; selection now uses Product Read Model rows mapped directly to `GlobalAssetViewModel`. |
| `P2-3` Cache payload cutover | done | Dashboard cache/hook/writer now type against `GlobalAssetViewModel`. |
| `P2-4` Dashboard UI cutover | done | Dashboard table/config/page/components migrated to `GlobalAssetViewModel`. |
| `P2-5` Asset detail cutover | done | Asset detail helpers/components/page migrated to `GlobalAssetViewModel`. |
| `P2-6` Helper/domain cutover | done | Metadata/reporting/runtime-request/parqet-assets helper signatures no longer use `AssetSummary`. |
| `P2-7` Docs/tests cleanup | partial | Runtime/tests done; docs still contain historical `AssetSummary` references by design until final docs cleanup issue. |

## Remaining Blockers

- Documentation still references `AssetSummary` as historical/deprecation context in:
  - `docs/DATA_MODEL.md`
  - `docs/DOMAIN_LANGUAGE.md`
  - `docs/DOMAIN_MODEL_BOUNDARIES.md`
- This is intentional for now and should be cleaned in a dedicated docs follow-up once wording is approved.

## Completion Criteria (Runtime Scope)

- `AssetSummary` references remain absent in `src/**` and `tests/**`.
- No compatibility adapter projects Product Read Model rows back into `AssetSummary`.
- Runtime read paths are `GlobalAssetViewModel` / Product Read Model based.
