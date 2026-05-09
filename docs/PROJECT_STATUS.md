# Project Status

Status: active after Phase 0
Owner: AdrianR98
Last reviewed: 2026-05-09

## Current Working Status

The repository has established the Phase-0 collaboration and operating baseline. This phase covered governance, documentation, prompts, templates, ADR structure, CI foundation and security/privacy rules.

Phase 0 did not implement product features, redesign the app, change Parqet API behavior, change OAuth/token handling, or modify the activity/asset calculation logic.

## Latest Stable State

The repository contains a Next.js App Router application with Parqet-oriented routes and UI areas, including dashboard and activities/audit concepts. The existing product implementation is treated as the baseline after Phase 0.

Known implementation themes from existing documentation:

- Parqet Connect is the intended OAuth data source.
- Authorized portfolio and activity data are transformed into internal portfolio views.
- Reconciliation warnings and overrides are part of the data-quality model.
- Dashboard, assets and activities/audit views should continue moving toward one shared normalized activity context.
- The existing Parqet pipeline guardrail remains: do not create a second activity or asset pipeline before Phase 1 decides otherwise.

## Completed Baseline Work

- Short agent entrypoint in `AGENTS.md`.
- New prompt structure in `prompts/`.
- English README and documentation baseline.
- German placeholder files only for README and development workflow.
- ADR template and collaboration operating-system ADR.
- Issue forms and PR template.
- CI workflow running lint and build.
- Manual-only placeholder workflows for future Issue-Agent and Translation-Agent.
- `.env.example`, `.gitignore` local privacy rules and `CHANGELOG.md`.
- Conservative Vercel ignored-build helper for documentation/governance-only changes.

## Next Steps

1. Verify the Vercel ignored-build behavior with a documentation-only PR.
2. Decide Phase-1 target architecture work, especially the activity/asset pipeline consolidation boundary.
3. Open focused issues for tests, CI hardening and later documentation-only CI optimization.
4. Decide when Branch Protection should be activated.
5. Decide when a Translation-Agent may create full German documentation translations.

## Risks

| Risk | Impact | Handling |
| --- | --- | --- |
| Private data leakage | Blocks PRs and may require secret rotation or history cleanup | Keep `.local/` ignored, keep `.env*` ignored and review diffs before PR |
| Duplicate pipeline logic | Future dashboard/audit inconsistencies | Preserve existing guardrail and decide target architecture in Phase 1 |
| Missing test baseline | Refactors remain harder to verify | Track as follow-up; do not add test tooling without a focused issue |
| CI not yet protected | Failed checks do not block merge automatically | Document Branch Protection, activate later |
| German placeholders incomplete | German docs are not yet useful as standalone docs | English remains source of truth until Translation-Agent PR |

## Assumptions

- `main` remains the stable branch.
- Documentation/governance-only PRs may use the Vercel ignored-build helper.
- CI starts with lint and build only.
- Auto-merge is not enabled in Phase 0.
- Existing labels are managed outside this PR.
