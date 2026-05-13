# Development Workflow

Status: active after Phase 0

## Operating Model

The repository uses a controlled collaboration model:

- Adrian owns product direction, merge decisions and private-data approval.
- ChatGPT helps shape issues, prompts, review plans and decision records during the active chat.
- Codex implements bounded repository changes and reports verification.
- GitHub Issues, Pull Requests and CI are the operational record.

English is the source-of-truth language. German translation files are maintained through the Translation-Agent process after activation.

Phase 0.1 hardens the workflow rules before Phase 1 product and architecture work begins.

## Source Of Truth

Operational rules live in `prompts/*.yaml`.

Human-readable workflow rules live in this document.

`AGENTS.md` remains a short entrypoint and hard-rule summary.

Issues contain work-specific details. Chat conversations are used for specification and review, but merged repository files become the durable source of truth.

If YAML and this document conflict for Codex or agent behavior, the YAML rule governs operationally and the conflict must be fixed.

The GitHub Project Board is a working view, not the source of truth. Board setup and label guidance live in `docs/GITHUB_PROJECT_BOARD.md`.

## API Budget Principle

External API budget minimization is a product and architecture constraint across all phases.

Parqet Connect and any future provider APIs must be treated as limited resources. The final product must not rely on repeated full provider scans for normal navigation, filtering, rendering or editing.

Every Parqet/API-touching issue and PR must answer:

1. Which external requests are triggered?
2. Can an existing cached response or snapshot be reused?
3. Can the request be narrowed by portfolio, date, asset, type or pagination?
4. Is the request triggered only by explicit user intent?
5. Are retries limited and classified by error type?
6. Are rate limits surfaced clearly instead of hidden behind generic errors?
7. Does the implementation avoid repeated full reloads during navigation, filtering or editing?

Required design direction:

- Prefer explicit sync or refresh actions over implicit full reloads.
- Prefer cached snapshots with stale-state indicators over repeated provider calls.
- Prefer provider-side filters when available.
- Prefer pagination, load-more flows and bounded concurrency.
- Distinguish response-size reduction from provider-call reduction.
- Refresh tokens only for likely auth failures.
- Do not retry expensive Activity pipelines after known non-auth failures such as provider rate limits.
- Add safe request-count diagnostics for local/debug routes where useful.

Any broad automatic reload must be justified in the issue and PR body.

## Codex Modes

Default mode: `Spar`.

| Mode | Use | File scope | Report |
| --- | --- | --- | --- |
| `Mini` | Tiny documentation, wording or mechanical changes | Explicitly named files only | 3-5 lines |
| `Spar` | Focused default work with limited scope | Up to 6 files | Compact changed/checks/notes |
| `Normal` | Moderate work needing broader context | Up to 10 files | Summary, changed files, verification, risks/notes |
| `Voll` | Risky first tasks or broad cross-cutting work | No fixed limit; file groups must be planned | Summary, verification, risks, decisions, follow-ups |
| `Folgeauftrag` | Narrow follow-up in an existing branch or PR context | Original scope only | Compact update |
| `Review-Fix` | Targeted review-feedback or CI-fix work | Review point / introduced failure only | Fixed/deferred + checks |

Use `Voll` for risky first tasks involving auth/OAuth, tokens/cookies, Parqet API contracts, persistence, caching, security, Branch Protection or large refactorings. Data-pipeline first tasks should usually use `Voll`; small follow-ups may use `Normal` only when the canonical pipeline is not being restructured.

Use at least `Normal` for `scripts/**`, `package.json`, `.github/workflows/**`, new test setup, medium governance updates and meaningful Vercel ignored-build logic changes.

## Codex Task Rules

Before GitHub actions such as issue updates, PR creation, review comments, branch publication or merge execution, agents must check:

- `AGENTS.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/DEVELOPMENT_WORKFLOW.md`
- `docs/PHASE_PLAN.md`
- `docs/V1_GUARDRAILS.md`

Every non-trivial Codex task must include:

```text
Repo:
Mode:
Branch:
Create PR:
Linked issues:
Allowed changes:
Non-goals:
Acceptance criteria:
Verification:
API Budget Impact:
Privacy/Data Impact:
```

If any required field is missing, the prompt is not ready to be issued and must be corrected before it is given to Codex.

Codex may commit only when the task explicitly allows commits. Codex never creates PRs and must not run `gh pr create`. Codex must not choose a branch name if none was provided. Codex must never merge.

Branch prefixes:

```text
docs/
chore/
fix/
feat/
test/
refactor/
```

Codex must stop for unclear product goal, user flow, data model, privacy or security questions. Small reversible technical assumptions are allowed only when documented.

Codex should prefer `git grep` and `git ls-files` for repository search. Private paths such as `.local/`, `.env*`, private exports and real portfolio data must not be read unless separately approved for a safe local-only task.

## Agent Model

Agent types:

- `Role-Agent`: a ChatGPT working role during an active chat.
- `Automation-Agent`: a repository-side workflow or script.
- `GitHub-native Automation`: built-in GitHub issue/project automation, separate from custom agent workflows.

Maturity levels:

```text
documented
manual-only
comment-only
own PR
existing PR branch
main write
```

No agent receives unrestricted authority. No agent may write directly to `main` in Phase 0.1. Future `main write` exceptions require a separate issue and likely ADR.

All agents stop on privacy or secret suspicion. No agent may enrich, copy, commit or expose private data.

### Current Agents

- Codex: bounded implementation agent; never creates PRs and never merges.
- Issue-Agent: limited metadata Automation-Agent after implementation; see P0.1 rules before use.
- Translation-Agent: manually started workflow after P0.1-6; may create Draft translation PRs.
- Docs-Agent: ChatGPT role for documentation impact checks; no app code.
- Review-Agent: ChatGPT role for PR reviews; may comment or merge only when explicitly instructed.
- CI-Agent: documented/manual role; may later summarize CI failures; no automatic fixes.
- Product-Agent: ChatGPT role for product goals, user flows and non-goals; does not make final product decisions.
- Architecture-Agent: ChatGPT role for architecture boundaries, ADR need and risks; ADR creation requires approval.

### Translation-Agent v1

Translation-Agent v1 is manually started through GitHub Actions.

Allowed modes:

```text
check
prepare-pr
```

The workflow is limited to:

```text
Sources:
- README.md
- docs/DEVELOPMENT_WORKFLOW.md

Targets:
- README.de.md
- docs/DEVELOPMENT_WORKFLOW.de.md
```

Translation-Agent v1 does not use an external translation service. It does not make product, governance or architecture decisions. It guards the German files by checking source markers and adding `TODO translation review` warnings when human translation review is required.

`check` mode validates that the German files are linked to the current English source markers and are not still placeholders.

`prepare-pr` mode may update only the allowed German target files and may create a Draft PR for human review.

Forbidden:

- no automatic trigger in v1,
- no English source-file changes,
- no ADR translation,
- no `CHANGELOG.de.md`,
- no app code changes,
- no private data use,
- no external translation service without separate approval.

## Issue Lifecycle

Issues are human-readable planning artifacts, not raw Codex prompts.

Large work gets a Parent-Issue when it needs multiple Sub-Issues or multiple PRs. Parent-Issues contain overview and checklist. Details live in Sub-Issues.

Complex Sub-Issues should be specified in ChatGPT question/answer format before creation. Small clear docs/chore/bugfix issues may be created directly.

Issue categories include:

```text
phase
feature
bug
tech-debt
documentation
decision
agent-task
```

Normal issue structure:

```text
Summary
Goal
Context
Acceptance Criteria
Non-goals
Verification / Review Plan
Risks, if relevant
Links / Related issues
Decision required?, if relevant
ADR required?, if relevant
```

Parent-Issues close only after all Sub-Issues are complete or intentionally dropped. Legacy issues that reference old workflow should be closed with a short explanatory comment instead of carried forward.

Use `Fixes #...` only when the PR fully closes the issue. Use `Refs #...` for parent issues, planning issues or partial progress.

ChatGPT creates Codex prompts separately from issues. Codex prompts are not stored as issue comments.

Do not close issues without verifying implementation against acceptance criteria. Closed issues may be corrected during cleanup when title, body or status no longer matches the actual project state.

## GitHub Project Board

The GitHub Project Board is the working view for active Parqet App work. It does not replace issue bodies, Parent/Sub-Issue checklists or PR review history.

Detailed Project Board setup, allowed fields, label allowlist, automations and manual fallback are documented in `docs/GITHUB_PROJECT_BOARD.md`.

Project Board v1 rules:

- Add open issues, including Parent-Issues and Sub-Issues.
- Do not add PRs to the Project in v1.
- Use Status, Phase and Priority fields.
- Use labels and issue content for category/type.
- Use `blocked` label or issue text instead of a separate Blocked status.
- Use GitHub-native automation only for low-risk board bookkeeping.
- Custom Issue-Agent automation must follow the agent permission rules.

## Pull Requests

Every PR should include:

- goal,
- linked issues,
- Codex mode when relevant,
- whether Codex was involved,
- summary,
- changed files,
- verification,
- documentation impact,
- API budget impact for any Parqet/API-touching change,
- German translation check when a matching `.de.md` file exists,
- risk,
- rollback,
- what was intentionally not changed for larger/Normal/Voll PRs.

Missing or not-run checks must be documented.

After review fixes, the PR body must be updated if scope, files, verification, risks or follow-ups changed.

Squash Merge is the default. Merge Commit is used only when commit history should be preserved. Rebase Merge is not used for now. Branches should be deleted after merge.

Adrian decides merges. ChatGPT may execute a merge only after explicit instruction. Codex never merges.

No PR may be merged without a diff review against:

- linked issue acceptance criteria,
- API-budget impact,
- privacy/data impact,
- non-goals,
- relevant v1 guardrails.

For API/data-facing changes, reviewers must look for hidden provider calls, broad reloads, unbounded retries and raw private data exposure.

Before v1 release-readiness decisions, reviewers should use `docs/V1_API_BUDGET_QA_CHECKLIST.md` to manually verify provider-call-safe local UI flows without requiring real provider calls.

After larger PRs, check whether roadmap, phase plan, docs, issues and changelog need updates.

## Review Levels

| Review level | Use | Checks |
| --- | --- | --- |
| Mini Review | Small docs/prompt/text/template changes without app code | Diff, scope, obvious errors, Markdown/YAML when relevant |
| Normal Review | Code, medium docs/governance, scripts, package.json, UI | Diff, relevant final files, GitHub CI, docs impact, risk, rollback |
| Full Review | Auth/OAuth, tokens, Parqet API, data pipeline, persistence, caching, security, Branch Protection, large refactors | Normal Review plus ADRs, workflow rules and architecture docs |

Review categories:

- `Blocker`: must fix before merge.
- `Should fix`: should fix before merge unless deliberately deferred.
- `Optional`: may be done later or never.
- `Follow-up`: outside this PR; possible new issue/PR.

Privacy/secret findings are Blockers. App code in docs/governance PRs is a Blocker unless expressly allowed.

Missing docs, changelog or ADR is a Blocker only if the change is documentation-, changelog- or ADR-relevant.

For Parqet/API-touching changes, unbounded retries, accidental full reloads, missing rate-limit handling or unclear request impact are review findings.

v1 data, analytics, report, UI and diagnostics PRs must also satisfy `docs/V1_GUARDRAILS.md`: no duplicate calculation pipelines, no avoidable provider DTO passthrough into UI, no private raw data in UI/logs/exports, no automatic provider calls from local UI actions, documented API budget impact, and honest source/freshness/confidence disclosure. For local UI flow regression checks, use `docs/V1_API_BUDGET_QA_CHECKLIST.md`.

## Documentation Impact

Every PR has a Documentation impact section. `No documentation impact` is allowed if briefly justified.

Check `CHANGELOG.md` for relevant changes, but change it only when relevant.

Changelog-relevant changes include:

- user-facing changes,
- governance/workflow changes,
- CI/build/deployment changes,
- security/privacy changes,
- API/data-pipeline changes,
- architecture decisions,
- larger fixes.

Mini docs/text fixes normally do not need changelog.

Check documentation as relevant:

- `README.md` for setup, usage, entrypoint or central links.
- `docs/PROJECT_STATUS.md` for phase changes, status, next steps or risks.
- `docs/PHASE_PLAN.md` for Parent-Issues and phase/sub-issue planning.
- `docs/V1_GUARDRAILS.md` for v1 data, API-budget, privacy, diagnostics and export rules.
- `docs/V1_API_BUDGET_QA_CHECKLIST.md` for manual provider-call-safe UI flow verification before v1 release readiness.
- `docs/LOCAL_QUICKSTART.md` for local usage and explicit refresh guidance.
- `docs/ROADMAP.md` for larger direction or priority changes.
- `docs/PROJECT_PRODUCT_BRIEF.md` for product goal/scope changes.
- `docs/ARCHITECTURE.md` for current architecture/target-state changes.
- ADRs for durable architecture, workflow or data decisions, including `docs/adr/0005-v1-snapshot-cache.md` for the v1 snapshot cache and production storage boundary.
- Matching `.de.md` files for translation follow-up checks.

Changelog categories:

```text
Added
Changed
Fixed
Docs
Governance
Security
```

Use `Unreleased` until versioning is introduced later.

ADRs remain English. English source changes do not require same-PR `.de.md` updates.

User-facing docs should be human-written, not prompt-like. Prompt YAML should remain compact and machine-readable.

## CI And Verification

Current GitHub CI runs:

```bash
npm run lint
npm run build
```

`npm run test` becomes required only after a clean test setup exists. Do not add Vitest, Playwright or test commands without a focused issue.

GitHub CI is a factual merge gate even before Branch Protection. Red CI cannot be merged unless Adrian explicitly approves and documents an exception.

For local repository verification, use as relevant:

```bash
git status --short
git diff --stat
git diff --check
git diff --name-only
```

For docs/prompt-only tasks, `git diff --check` plus Markdown/YAML checks may be sufficient. For code changes, `npm run lint` and `npm run build` are expected unless impossible and documented.

Verification in PR bodies should distinguish:

```text
Run
Not run
Not applicable
```

`Not run` requires a reason. `Not applicable` is used only when the check does not fit the change.

Do not paste huge logs. Include only relevant failure excerpts. Private data in logs is a Blocker.

## Vercel Deployments

Vercel may create deployments for pull requests and for changes merged into `main`.

The repository provides an ignored-build helper:

```bash
npm run vercel:ignore-build
```

Docs/governance-only PRs may show Vercel `Ignored`. That is correct when only safe docs/governance files changed.

App/API/Auth/Data/Deployment PRs should have Vercel Ready/Success before merge unless Adrian approves a documented exception.

The Vercel ignored-build script may be expanded later with review and reasoning. Small allowlist/doc updates may be `Spar`; logic changes need at least `Normal`.

## Security And Privacy

- No real tokens.
- No real `.env` files.
- No private Parqet exports.
- No real portfolio or depot data.
- No screenshots with real portfolio, account, depot or personal data.
- No cookies, OAuth codes, access tokens or refresh tokens in Issues, PRs or logs.
- No debug logs containing private API responses.
- Private local reference files may exist only in ignored paths such as `.local/`.
- `.local/` must be ignored and must not be committed.
- `.env.example` may exist with empty placeholders only.
- Anonymized real data requires manual approval by Adrian.
- Synthetic test data is allowed only in clearly named test folders.
- Parqet HTML/CSV references must stay out of the repository and belong in `.local/`.
- Synthetic fixtures derived from references may be added later only if clearly synthetic and approved.
- Debug logging in app code requires explicit permission.
- Full private API responses must never be logged.
- If private data appears in a diff, the PR is blocked.
- Auth/API/token changes require Full Review.

## Architecture And Phase 1

Use ADRs for major architecture, workflow and data decisions. ADRs are English only and live in `docs/adr/`.

The existing Parqet pipeline remains a guardrail: do not create a second activity or asset pipeline before Phase 1 decides otherwise or an ADR allows it.

Phase-1 specification may be prepared during P0.1. Phase-1 implementation starts only after P0.1 is merged.

Phase 1 starts with product goal and then audits the current app against that goal. First product implementation starts only after an Implementation Entry Checklist.

API budget minimization is part of the architecture gate for Phase 1 and later phases. New data flows must avoid unnecessary provider calls and document cache, refresh and retry behavior.
