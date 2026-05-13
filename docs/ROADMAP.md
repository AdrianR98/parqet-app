# Roadmap

Status: active roadmap

## Direction

The repository evolves in small, reviewable phases. Phase 0 and Phase 0.1 established the collaboration and operating baseline. Current work keeps the local-first UI foundation stable while the data foundation and pipeline-readiness decisions are documented before route/read-model migration.

## Roadmap

| Phase | Focus | Status |
| --- | --- | --- |
| Phase 0 | Collaboration, docs, prompts, templates, CI foundation, security guardrails | Completed / maintained |
| Phase 1 | App shell, navigation and local-first UI foundation | Active baseline work |
| Phase 2 | Data foundation, API budget and pipeline-readiness decisions | Active planning |
| Phase 3 | Core product surfaces backed by canonical read models | Future |
| Phase 4 | V1 hardening and release-candidate preparation | Future |
| Phase 5 | V1 QA / release cut | Future |
| Phase 6 | Post-V1 feature expansion | Future |

## Pipeline Readiness

Pipeline-readiness planning is coordinated in [#248](https://github.com/AdrianR98/parqet-app/issues/248). The completed inventory and replacement-gate checklist from [#249](https://github.com/AdrianR98/parqet-app/issues/249) is [docs/PIPELINE_INVENTORY.md](PIPELINE_INVENTORY.md).

Follow-up decision/planning issues [#251](https://github.com/AdrianR98/parqet-app/issues/251) through [#260](https://github.com/AdrianR98/parqet-app/issues/260) cover provider source strategy, asset identity, normalization, transfers, valuation, dividends/fees/taxes/currency, warnings/confidence, snapshot/cache semantics, product read-model migration order and validation fixtures. No route migration is authorized until the relevant replacement-gate evidence is satisfied.

## Governance

- English is the source of truth.
- Work should be issue-linked.
- Normal work should use branch plus PR.
- PRs should include verification, risk and rollback.
- ADRs are required for major architecture or workflow decisions.
- Labels are managed outside this PR; do not create or modify label-management code.

## Branch Rules

- `main` should remain stable.
- Adrian may intentionally commit directly to `main` for small low-risk documentation changes.
- Direct `main` commits are not intended for app code, auth, API contracts, data pipeline, CI, security, architecture or large prompt/documentation changes.
- Branch Protection is documented but not activated yet.
- Auto-merge is not enabled.
- Later auto-merge may be considered for documentation or prompt-only changes once CI is reliable.

## CI Roadmap

Current CI baseline:

- Run `npm run lint`.
- Run `npm run build`.
- Do not add Vitest.
- Do not add Playwright.
- Do not require `npm run test`.

Later:

- Add tests through focused follow-up work.
- Decide required checks before activating Branch Protection.
- Consider documentation-only CI optimization after the baseline is stable.

## Agent Roadmap

Current manual/guarded workflows include:

- Issue-Agent.
- Translation-Agent.

They do not run automatically beyond their documented guarded entry points. Expansion requires a later decision and PR.
