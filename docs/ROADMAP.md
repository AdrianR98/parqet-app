# Roadmap

Status: Phase-0 roadmap

## Direction

The repository should evolve in small, reviewable phases. Phase 0 establishes the collaboration and operating baseline. Later phases may change app architecture and implementation only after the relevant decisions are documented.

## Roadmap

| Phase | Focus | Status |
| --- | --- | --- |
| Phase 0 | Collaboration, docs, prompts, templates, CI foundation, security guardrails | In progress |
| Phase 1 | Target architecture and pipeline decisions | Planned |
| Phase 2 | Shared implementation foundations and focused tests | Placeholder |
| Phase 3 | Performance, pagination, caching and UX reliability | Placeholder |
| Phase 4 | CI hardening, Branch Protection and constrained automation | Placeholder |

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
- Branch Protection is documented but not activated in Phase 0.
- Auto-merge is not enabled in Phase 0.
- Later auto-merge may be considered for documentation or prompt-only changes once CI is reliable.

## CI Roadmap

Phase 0:

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

Phase 0 includes manual-only placeholder workflows for:

- Issue-Agent.
- Translation-Agent.

They do not run automatically, do not modify issues, do not comment on PRs and do not change files. Activation requires a later decision and PR.
