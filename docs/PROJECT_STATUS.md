# Project Status

Status: Phase 1 active - Global Asset Timeline Foundation
Owner: AdrianR98
Last reviewed: 2026-05-09

## Current Working Status

The repository has completed Phase 0 and Phase 0.1.

Phase 0 established the collaboration, documentation, prompt, template and CI baseline. Phase 0.1 hardened the workflow rules, agent permissions, issue lifecycle, PR review rules, documentation impact rules, GitHub Project guidance, Translation-Agent v1 and Issue-Agent v1.

The project is now in Phase 1: Global Asset Timeline Foundation.

Phase 1 defines and prepares the core product value of the Parqet Integration: an asset-centric, portfolio-wide view that consolidates the same security across multiple authorized Parqet portfolios while keeping portfolio origin, transfers, dividends, warnings and confidence visible.

Phase 1 must not replace existing product calculations until the API audit, ADR and audit/report mode are complete.

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

## Latest Stable State

The repository contains a Next.js App Router application with Parqet-oriented routes and UI areas, including dashboard and activities/audit concepts. The existing product implementation remains the stable baseline during Phase 1 until a later decision explicitly changes it.

Known implementation themes from existing documentation:

- Parqet Connect is the intended OAuth data source.
- Authorized portfolio and activity data are transformed into internal portfolio views.
- Reconciliation warnings and overrides are part of the data-quality model.
- Dashboard, assets and activities/audit views should continue moving toward one shared normalized activity context.
- The existing Parqet pipeline guardrail remains: do not create a second activity or asset pipeline before Phase 1 decides otherwise or an ADR allows it.

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

## Active Phase 1 Work

Parent issue: #57

Completed Phase-1 Sub-Issues:

- #58 P1-1: Audit Parqet API fields for Global Asset Timeline.
- #62 P1-2: ADR Global Asset Timeline.
- #64 P1-3: Define Global Asset Timeline type model.
- #66 P1-4: Implement Global Asset activity normalization pipeline.
- #68 P1-5: Implement Global Asset builder and aggregation.

Current Phase-1 Sub-Issue:

- #70 P1-6: Implement Global Asset audit and report mode.

Known follow-ups outside the Phase-1 core:

- #53 Add AI translation mode to Translation-Agent.
- #56 Tune Issue-Agent v1 classification rules.

## Phase 1 Implementation Gate

Before productive Global Asset UI or replacement of existing asset calculations:

- [x] API audit completed.
- [x] `docs/PARQET_API_AUDIT.md` created without private values.
- [x] ADR Global Asset Timeline created.
- [x] Global Asset types defined.
- [x] NormalizedActivity model defined.
- [x] Reconciliation warning model defined.
- [ ] Audit/report mode works.
- [ ] No real Parqet data committed.
- [ ] Existing asset calculation has not been replaced.
- [ ] Decision documented for when/how the new pipeline becomes productive.
- [ ] Vercel deployability remains intact.

## Next Steps

1. Complete #70 with the guarded Global Asset audit/report mode.
2. Use the audit report locally to inspect normalized and aggregated Global Asset output.
3. Continue Phase 1 with transfer handling, warning/confidence refinement and later product integration decisions.
4. Create later follow-ups for transfer pairing and OpenAPI cross-check.

## Risks

| Risk | Impact | Handling |
| --- | --- | --- |
| Private data leakage | Blocks PRs and may require secret rotation or history cleanup | Keep `.local/` ignored, keep `.env*` ignored and review diffs before PR |
| Duplicate pipeline logic | Future dashboard/audit inconsistencies | Preserve existing guardrail and decide target architecture in Phase 1 |
| Missing test baseline | Refactors remain harder to verify | Track as follow-up; do not add test tooling without a focused issue |
| CI not yet protected | Failed checks do not block merge automatically | Treat GitHub CI as factual merge gate; activate Branch Protection later |
| German placeholders incomplete | German docs are not yet useful as standalone docs | English remains source of truth until Translation-Agent PR |
| Agent automation scope creep | Issues or docs could be changed too broadly | Keep agent capabilities explicit, idempotent and limited to approved outputs |
| GitHub Project API limitation | Board setup may not be fully automatable through the connector | Use documented manual fallback in `docs/GITHUB_PROJECT_BOARD.md` |
| Translation workflow overreach | German docs could appear authoritative before review | Translation-Agent creates Draft PRs and TODO warnings for human review |
| Audit route exposure | Private structures could be exposed if route is misconfigured | Block in production and require explicit local feature flag |
| Premature Global Asset implementation | Wrong assumptions about API fields could create bugs | Start with API audit and ADR before production pipeline replacement |
| Missing portfolio context | Portfolio breakdown and transfer logic could be wrong | Attach portfolio context in the fetch layer before normalization |
| Premature transfer pairing | Transfers could be incorrectly matched | Preserve transfer types first; implement pairing in a dedicated later issue |

## Assumptions

- `main` remains the stable branch.
- Documentation/governance/workflow/dev-only audit PRs may use the Vercel ignored-build helper.
- CI starts with lint and build only.
- Auto-merge is not enabled.
- Branch Protection is not activated yet.
- Phase 1 starts with API audit and architecture decisions before product implementation.
- GitHub Project Board is an operational view, not the source of truth.
