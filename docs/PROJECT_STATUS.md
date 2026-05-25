# Project Status

Status: Active Parqet integration baseline with DB-backed market-data runtime and explicit admin workflows
Owner: AdrianR98
Last reviewed: 2026-05-25

## Current Working Status

Parqet OAuth and authorized local portfolio/activity flow remain the application baseline. Dashboard and activity views continue to use local/cache-backed behavior.

Asset detail is now stabilized around DB-backed market-history chart reads plus dividend and portfolio analytics. Runtime market-history access is DB-only by architecture boundary.

Provider-touching market-data actions are intentionally isolated to explicit admin/CLI workflows (update runs, mapping, unmapped reporting, safe metadata updates). This keeps runtime views predictable and API-budget aware.

Recent UI hardening includes Elbstream-based logo generation/use, shared asset-logo handling with failed-logo session cache, structured footer links/attribution, and semantic theme-token contrast repair for light/dark surfaces.

## Product Definition

The app is a Parqet Integration Dashboard.

Parqet remains the data source through Parqet Connect / OAuth. This app adds an analysis layer that focuses on:

- portfolio-wide Global Assets,
- complete asset timelines across multiple portfolios,
- transfer-aware deposits and withdrawals,
- consolidated dividend history,
- portfolio breakdowns,
- reconciliation warnings,
- confidence signals,
- closed positions.

The app may present itself as a Parqet Integration, but it must not appear to be an official Parqet product.

The current provider data-source strategy is locked for DP-02 in `docs/PROVIDER_DATA_SOURCE_STRATEGY.md`: use current holdings/current-state sources for current position/allocation questions, activity history for timelines and event-derived inputs, snapshots/read models for repeated local reads after explicit load, local metadata for display identity only and provider-reference labels for Parqet-computed values.

DP-11 product read-model and migration-gate policy is locked in `docs/V1_GUARDRAILS.md`: Product Read Models are UI/route-safe projections with source, freshness, scope, confidence, warnings, blocked metrics and value classification. They must not expose internal normalized activities, raw provider payloads or private diagnostic rows as product-route output.

## Latest Stable State

### Dashboard / Overview

- Authorized Parqet portfolio data flow is stable.
- Local/cache-backed dashboard and activity reads remain the primary app runtime pattern.

### Asset Detail

- Asset detail charting uses periodized, DB-backed market-history reads.
- Recent hardening includes no-flicker chart behavior, ISIN isolation and persisted price/dividend range preferences.
- Dividend and portfolio analytics remain part of the asset-detail baseline.

### Market-Data DB / CLI Workflow

- Runtime market-history is DB-only; runtime routes must not rely on ad-hoc provider history calls.
- Provider/admin actions are explicit workflows: incremental update job, unmapped report, manual symbol mapping and safe instrument metadata updates.
- `docs/MARKET_DATA_PIPELINE.md` is the canonical operator workflow.

### Logos / Footer / Theme

- Elbstream is the generated logo source.
- Shared `AssetLogo` behavior includes failed-logo session caching.
- Footer is structured with Impressum/Datenschutz placeholders and Elbstream attribution.
- Light/dark contrast is repaired via semantic theme tokens.

## Completed Baseline Work

- Short agent entrypoint in `AGENTS.md`.
- Prompt structure in `prompts/`.
- English README and documentation baseline.
- German placeholder files for README and development workflow.
- ADR template and collaboration operating-system ADR.
- Issue forms and PR template.
- CI workflow running lint and build.
- `.env.example`, `.gitignore` local privacy rules and `CHANGELOG.md`.
- Conservative Vercel ignored-build helper for documentation/governance-only changes.
- Vercel ignored-build helper updated to skip workflow-only, agent-script-only and dev-only audit-tooling changes.
- GitHub Project Board v1 setup guide documented with manual fallback.
- Translation-Agent v1 prepared as a guarded manual workflow.
- Issue-Agent v1 prepared as a guarded manual metadata workflow.
- Phase 0.1 Parent/Sub-Issues completed.
- Phase 1 API field audit completed and documented in `docs/PARQET_API_AUDIT.md`.
- ADR 0002 documents the Global Asset Timeline architecture decision.
- Phase 1 type model completed in `src/lib/parqet/global-assets/types.ts`.
- Phase 1 normalization pipeline completed in `src/lib/parqet/global-assets/normalize.ts`.
- Phase 1 aggregation layer completed in `src/lib/parqet/global-assets/aggregate.ts`.
- Phase 1 guarded Global Asset audit/report mode completed.
- Pipeline inventory and replacement-gate checklist completed in `docs/PIPELINE_INVENTORY.md` for #249.

## Active Pipeline-Readiness Work

Phase-1 foundation parent issue: #57

Pipeline-readiness parent / decision backlog: #248

Completed Phase-1 Sub-Issues:

- #58 P1-1: Audit Parqet API fields for Global Asset Timeline.
- #62 P1-2: ADR Global Asset Timeline.
- #64 P1-3: Define Global Asset Timeline type model.
- #66 P1-4: Implement Global Asset activity normalization pipeline.
- #68 P1-5: Implement Global Asset builder and aggregation.
- #70 P1-6: Implement Global Asset audit and report mode.

Completed pipeline-readiness inventory:

- #249: Inventory current pipeline routes and define replacement-gate evidence checklist; output: `docs/PIPELINE_INVENTORY.md`.

Locked/Completed pipeline-readiness decision and test follow-ups:

- #251: Provider data-source strategy and Parqet API contract verification.
- #252: Asset identity and metadata boundary.
- #253: Activity normalization contract and warning codes (locked/completed).
- #254: Transfer pairing and ambiguity model (locked/completed).
- #255: Cost basis, PnL and price-source policy (locked/completed).
- #256: Dividend, fee, tax and currency policy (locked/completed).
- #257: Warning, confidence and blocked-metrics model (locked/completed).
- #166: DP-09 override/user-decision model (locked/completed documentation decision in `docs/GLOBAL_ASSET_OVERRIDES.md`).
- #258: Snapshot cache and API-budget route semantics; DP-10 is locked in `docs/V1_GUARDRAILS.md` and clarified in ADR 0005.
- #259: Product read-model contract and route migration order; DP-11 is locked in `docs/V1_GUARDRAILS.md`.
- #260: Synthetic pipeline fixtures and audit validation strategy (locked/completed).
- #274: Minimal pure TypeScript/Vitest pipeline test setup (completed).
- #276: CI follow-up (`test:pipeline` gate and scoped V1 Playwright smoke) (completed).
- #278: First synthetic Global Asset fixture slice (completed).
- #280: Remaining synthetic Global Asset fixture matrix for currently exposed pure behavior (completed).
- #282/#283: Pure readiness helper/test follow-up (completed); deferred readiness cases `stale_snapshot`, `scope_missing`, `scope_unknown` and `price_source_missing` are now covered by synthetic readiness helper tests.
- #286/#300/#301/#302/#303/#304/#305/#306/#307: Activities/Timeline local PRM migration is stabilized as a browser-local compatibility path with PRM default-on when local evidence is ready, mandatory fallback for missing/stale/scope-mismatch evidence, explicit rollback via feature flag and synthetic route-smoke plus pipeline evidence.
- #309: Guarded Global Asset product migration for Dashboard/AssetTable/Reports now includes real app-flow coexistence cache population from the explicit `/api/parqet/assets` load path, guarded dashboard/report source selection wiring and compatibility-safe fallback behavior for missing/stale/scope-mismatch/blocked fields.
- Follow-up to #309/#310/#311: Dashboard, AssetTable and Reports now run safe non-valuation Global Asset defaults when product-read-model freshness/scope evidence is ready, while valuation/performance and transfer-sensitive fields remain compatibility-backed and rollback can force full compatibility via `NEXT_PUBLIC_GLOBAL_ASSET_PRODUCT_GUARD_ENABLED=off|false|0`.
- #314: First broad canonical safe-field route group migration completed for Dashboard, AssetTable-visible Dashboard rows and Reports. Global Asset PRM identity/display/portfolio labels are canonical only when readiness evidence is fresh and scope-compatible; missing/stale/scope-mismatch/invalid PRM data and explicit rollback stay compatibility-backed. Valuation, performance, cost-basis, dividend totals, transfer-sensitive and quantity-sensitive fields remain compatibility-owned.
- #331: Market-data admin/CLI workflow documentation (`docs/MARKET_DATA_PIPELINE.md`) refreshed as the operational source of truth.
- #330: Incremental primary market-data update job completed.
- #328: Unmapped report workflow completed.
- #329: Manual symbol mapping workflow completed.
- #348: Safe market instrument metadata update CLI completed.
- #342: Elbstream logo integration completed.
- #351: Structured footer with legal placeholders and attribution completed.
- #353: Dark-mode/light-mode surface contrast repair via semantic theme tokens completed.

Status note for #248:

- #248 remains open as the pipeline-readiness parent/backlog while next direction is selected.
- Activities/Timeline local PRM migration finalization is complete as a compatibility path and does not by itself close #248 or authorize canonical Dashboard/AssetTable/Reports replacement.
- #314 does not close #248: Dashboard/AssetTable/Reports have completed the first canonical safe-field slice for identity/display/portfolio labels when readiness evidence is present, but full canonical route replacement, provider/runtime migration, old-path removal and valuation ownership transition remain open.
- DP-09 is now locked as a documentation decision through #166 and `docs/GLOBAL_ASSET_OVERRIDES.md`; this does not authorize override UI/write/storage implementation.
- DP-13/status cleanup remains a documentation/status topic; this cleanup does not close #248.
- New market-data and UI hardening work can proceed in parallel when it respects runtime DB-only boundaries and existing pipeline guardrails.

Known follow-ups outside the Phase-1 core:

- #53 Add AI translation mode to Translation-Agent.
- #56 Tune Issue-Agent v1 classification rules.

## Pipeline Replacement Gate

Before productive Global Asset UI or replacement of existing asset calculations:

- [x] API audit completed.
- [x] `docs/PARQET_API_AUDIT.md` created without private values.
- [x] ADR Global Asset Timeline created.
- [x] Global Asset types defined.
- [x] NormalizedActivity model defined.
- [x] Reconciliation warning model defined.
- [x] Audit/report mode works.
- [x] Pipeline inventory and replacement-gate checklist completed in `docs/PIPELINE_INVENTORY.md`.
- [ ] No real Parqet data committed.
- [ ] Existing asset calculation has not been replaced.
- [x] #248 follow-up decisions are locked for the affected route/read-model (DP-01/DP-02/DP-03/DP-04/DP-05/DP-06/DP-07/DP-08/DP-09/DP-10/DP-11/DP-12 complete; DP-13 remains docs/status cleanup).
- [ ] Route/read-model replacement evidence from `docs/PIPELINE_INVENTORY.md` is satisfied.
- [x] First safe-field route migration candidate is selected from #249 evidence and satisfies the DP-11 read-only, snapshot/local-first, comparison and rollback gate for Dashboard/AssetTable/Reports safe fields only.
- [ ] Full route/read-model replacement candidate for valuation ownership and old-path removal is selected and satisfies the remaining replacement evidence.
- [ ] Decision documented for when/how the new pipeline becomes productive.
- [ ] Vercel deployability remains intact.

## Next Steps

1. #337: Define and enforce localStorage/dashboard cache size limits and stale-data clarity.
2. #343: Plan and scope the protected read-only market-data admin console first slice.
3. #326: Address unknown assets/import queue workflow.
4. Continue documentation cleanup and stale issue triage where it improves operational clarity.
5. Review/re-scope/close #324 as historical: current direction is DB-backed runtime market history with provider/yfinance calls isolated to explicit admin/CLI workflows.

## Risks

| Risk | Impact | Handling |
| --- | --- | --- |
| Private data leakage | Blocks PRs and may require secret rotation or history cleanup | Keep `.local/` ignored, keep `.env*` ignored and review diffs before PR |
| Duplicate pipeline logic | Future dashboard/audit inconsistencies | Preserve existing guardrail and use #248 plus `docs/PIPELINE_INVENTORY.md` before route/read-model migration |
| Local cache staleness/size drift | Users may see stale data or excessive browser storage growth | Add explicit freshness messaging, bounded cache sizes and refresh controls (#337) |
| Market-data admin workflow complexity | Misuse can create partial updates or operator confusion | Keep admin steps explicit, documented and narrow-scoped in `docs/MARKET_DATA_PIPELINE.md` |
| Unknown assets/import queue backlog | Assets can remain unresolved and degrade trust in reports | Prioritize queue design and triage flow in #326 |
| Stale docs and stale issue narratives | Team decisions may target outdated architecture assumptions | Periodic status refresh and issue re-scope/closure where direction changed |
| Legal placeholder pages not final compliance | Footer links could be misunderstood as final legal content | Keep placeholders clearly marked and replace with reviewed legal content later |
| Elbstream logo browser requests expose public identifiers | Asset identifiers may appear in external logo request URLs | Keep requests limited to public instrument identifiers and avoid private payload leakage |
| Missing test baseline | Refactors remain harder to verify | Track as follow-up; do not add test tooling without a focused issue |
| CI not yet protected | Failed checks do not block merge automatically | Treat GitHub CI as factual merge gate; activate Branch Protection later |
| German placeholders incomplete | German docs are not yet useful as standalone docs | English remains source of truth until Translation-Agent PR |
| Agent automation scope creep | Issues or docs could be changed too broadly | Keep agent capabilities explicit, idempotent and limited to approved outputs |
| GitHub Project API limitation | Board setup may not be fully automatable through the connector | Use documented manual fallback in `docs/GITHUB_PROJECT_BOARD.md` |
| Translation workflow overreach | German docs could appear authoritative before review | Translation-Agent creates Draft PRs and TODO warnings for human review |
| Audit route exposure | Private structures could be exposed if route is misconfigured | Block in production and require explicit local feature flag |
| Premature Global Asset replacement | Wrong assumptions about API fields or route contracts could create bugs | Resolve #248 decision issues and satisfy the #249/DP-11 replacement gate before production route/read-model migration |
| Missing portfolio context | Portfolio breakdown and transfer logic could be wrong | Attach portfolio context in the fetch layer before normalization |
| Premature transfer pairing | Transfers could be incorrectly matched | Preserve transfer types first; implement pairing in a dedicated later issue |

## Assumptions

- `main` remains the stable branch.
- Documentation/governance/workflow/dev-only audit PRs may use the Vercel ignored-build helper.
- CI starts with lint and build only.
- Auto-merge is not enabled.
- Branch Protection is not activated yet.
- Product route/read-model migration starts only after the relevant #248 decisions, `docs/PIPELINE_INVENTORY.md` replacement-gate evidence and DP-11 Product Read Model gate are satisfied.
- GitHub Project Board is an operational view, not the source of truth.
- Runtime market-history remains DB-only; provider calls remain explicit admin/CLI concerns rather than user-runtime route behavior.
