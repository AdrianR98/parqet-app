# Project Status

Status: Phase 0.1 in progress
Owner: AdrianR98
Last reviewed: 2026-05-09

## Current Working Status

The repository has established the Phase-0 collaboration and operating baseline. Phase 0 covered governance, documentation, prompts, templates, ADR structure, CI foundation, Vercel ignored-build setup and security/privacy rules.

Phase 0 did not implement product features, redesign the app, change Parqet API behavior, change OAuth/token handling, or modify the activity/asset calculation logic.

Phase 0.1 is now hardening the workflow before Phase 1 product and architecture work begins. It refines Codex execution rules, agent permissions, issue lifecycle, PR review levels, documentation impact rules, Phase-1 entry rules and CI/Vercel verification rules.

## Latest Stable State

The repository contains a Next.js App Router application with Parqet-oriented routes and UI areas, including dashboard and activities/audit concepts. The existing product implementation is treated as the stable baseline during Phase 0.1.

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
- Manual-only placeholder workflows for future Issue-Agent and Translation-Agent.
- `.env.example`, `.gitignore` local privacy rules and `CHANGELOG.md`.
- Conservative Vercel ignored-build helper for documentation/governance-only changes.
- Vercel ignored-build behavior verified with a documentation-only PR.
- Phase 0.1 Parent/Sub-Issues created for workflow hardening.

## Active Phase 0.1 Work

Parent issue: #39

Sub-Issues:

- #40 Codex modes and task execution rules.
- #41 Agent maturity model and permissions.
- #42 Issue lifecycle and planning rules.
- #43 PR review levels and merge rules.
- #44 Documentation impact and changelog rules.
- #45 Translation-Agent workflow v1.
- #46 Phase-1 planning gate and product-development entry rules.
- #47 CI, Vercel and verification rules after #36.
- #48 GitHub Project Board v1.

Implementation grouping:

1. Rules / Docs / YAML.
2. GitHub Project / Labels.
3. Agent Workflows.

## Next Steps

1. Complete Phase 0.1 PR group 1: rules, docs and YAML.
2. Set up GitHub Project Board v1 and labels through PR group 2 or documented manual fallback.
3. Implement constrained Issue-Agent and Translation-Agent workflow changes through PR group 3.
4. Prepare Phase 1 product-goal specification.
5. Start Phase 1 only after Phase 0.1 is merged.

## Risks

| Risk | Impact | Handling |
| --- | --- | --- |
| Private data leakage | Blocks PRs and may require secret rotation or history cleanup | Keep `.local/` ignored, keep `.env*` ignored and review diffs before PR |
| Duplicate pipeline logic | Future dashboard/audit inconsistencies | Preserve existing guardrail and decide target architecture in Phase 1 |
| Missing test baseline | Refactors remain harder to verify | Track as follow-up; do not add test tooling without a focused issue |
| CI not yet protected | Failed checks do not block merge automatically | Treat GitHub CI as factual merge gate; activate Branch Protection later |
| German placeholders incomplete | German docs are not yet useful as standalone docs | English remains source of truth until Translation-Agent PR |
| Agent automation scope creep | Issues or docs could be changed too broadly | Keep agent capabilities explicit, idempotent and limited to approved outputs |

## Assumptions

- `main` remains the stable branch.
- Documentation/governance-only PRs may use the Vercel ignored-build helper.
- CI starts with lint and build only.
- Auto-merge is not enabled.
- Branch Protection is not activated yet.
- Phase 0.1 may change workflow docs and prompt files but not app/product code.
