# Project Status

Status: Phase 1 active / Phase 2 pipeline-readiness planning
Owner: AdrianR98
Last reviewed: 2026-05-13

## Current Working Status

The repository has completed Phase 0 and Phase 0.1.

Phase 0 established the collaboration, documentation, prompt, template and CI baseline. Phase 0.1 hardened the workflow rules, agent permissions, issue lifecycle, PR review rules, documentation impact rules, GitHub Project guidance, Translation-Agent v1 and Issue-Agent v1.

The project is now keeping Phase 1 local-first UI foundation work stable while Phase 2 pipeline-readiness planning is active.

Phase 1 defines and prepares the core product value of the Parqet Integration: an asset-centric, portfolio-wide view that consolidates the same security across multiple authorized Parqet portfolios while keeping portfolio origin, transfers, dividends, warnings and confidence visible.

The Global Asset pipeline must not replace existing product calculations or product routes until the pipeline-readiness decision backlog, inventory evidence and route/read-model replacement gate are satisfied.

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

## Latest Stable State

The repository contains a Next.js App Router application with Parqet-oriented routes and UI areas, including dashboard and activities/audit concepts. The existing product implementation remains the stable baseline during Phase 1 until a later decision explicitly changes it.

Known implementation themes from existing documentation:

- Parqet Connect is the intended OAuth data source.
- Authorized portfolio and activity data are transformed into internal portfolio views.
- Reconciliation warnings and overrides are part of the data-quality model.
- Dashboard, assets and activities/audit views should continue moving toward one shared normalized activity context.
- The existing Parqet pipeline guardrail remains: do not create a second activity or asset pipeline before Phase 1 decides otherwise or an ADR allows it.
- Pipeline-readiness planning is tracked in #248. The completed inventory and replacement-gate evidence from #249 is documented in `docs/PIPELINE_INVENTORY.md`.

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

Current follow-up decision/planning issues:

- #251: Provider data-source strategy and Parqet API contract verification.
- #252: Asset identity and metadata boundary.
- #253: Activity normalization contract and warning codes.
- #254: Transfer pairing and ambiguity model.
- #255: Cost basis, PnL and price-source policy.
- #256: Dividend, fee, tax and currency policy.
- #257: Warning, confidence and blocked-metrics model.
- #258: Snapshot cache and API-budget route semantics; DP-10 is locked in `docs/V1_GUARDRAILS.md` and clarified in ADR 0005.
- #259: Product read-model contract and route migration order.
- #260: Synthetic pipeline fixtures and audit validation strategy.

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
- [ ] #248 follow-up decisions are locked for the affected route/read-model.
- [ ] Route/read-model replacement evidence from `docs/PIPELINE_INVENTORY.md` is satisfied.
- [ ] Decision documented for when/how the new pipeline becomes productive.
- [ ] Vercel deployability remains intact.

## Next Steps

1. Use #248 as the pipeline-readiness parent / decision backlog.
2. Use `docs/PIPELINE_INVENTORY.md` from #249 as the replacement-gate evidence baseline.
3. Resolve follow-up decision/planning issues #251 through #260 before product route/read-model migration.
4. Keep current product routes and existing calculations stable until route-specific replacement evidence is reviewed.

## Risks

| Risk | Impact | Handling |
| --- | --- | --- |
| Private data leakage | Blocks PRs and may require secret rotation or history cleanup | Keep `.local/` ignored, keep `.env*` ignored and review diffs before PR |
| Duplicate pipeline logic | Future dashboard/audit inconsistencies | Preserve existing guardrail and use #248 plus `docs/PIPELINE_INVENTORY.md` before route/read-model migration |
| Missing test baseline | Refactors remain harder to verify | Track as follow-up; do not add test tooling without a focused issue |
| CI not yet protected | Failed checks do not block merge automatically | Treat GitHub CI as factual merge gate; activate Branch Protection later |
| German placeholders incomplete | German docs are not yet useful as standalone docs | English remains source of truth until Translation-Agent PR |
| Agent automation scope creep | Issues or docs could be changed too broadly | Keep agent capabilities explicit, idempotent and limited to approved outputs |
| GitHub Project API limitation | Board setup may not be fully automatable through the connector | Use documented manual fallback in `docs/GITHUB_PROJECT_BOARD.md` |
| Translation workflow overreach | German docs could appear authoritative before review | Translation-Agent creates Draft PRs and TODO warnings for human review |
| Audit route exposure | Private structures could be exposed if route is misconfigured | Block in production and require explicit local feature flag |
| Premature Global Asset replacement | Wrong assumptions about API fields or route contracts could create bugs | Resolve #248 decision issues and satisfy the replacement gate before production route/read-model migration |
| Missing portfolio context | Portfolio breakdown and transfer logic could be wrong | Attach portfolio context in the fetch layer before normalization |
| Premature transfer pairing | Transfers could be incorrectly matched | Preserve transfer types first; implement pairing in a dedicated later issue |

## Assumptions

- `main` remains the stable branch.
- Documentation/governance/workflow/dev-only audit PRs may use the Vercel ignored-build helper.
- CI starts with lint and build only.
- Auto-merge is not enabled.
- Branch Protection is not activated yet.
- Product route/read-model migration starts only after the relevant #248 decisions and `docs/PIPELINE_INVENTORY.md` replacement-gate evidence are satisfied.
- GitHub Project Board is an operational view, not the source of truth.
