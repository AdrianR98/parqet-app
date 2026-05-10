# Phase Plan

Status: active

This document is the app-neutral phase plan for repository work. Visible product branding may change over time; governance, guardrails, templates and phase decisions must not depend on the current app name.

## Core Rule

New ideas are not implemented immediately. Every new idea must first be classified into the phase and issue type that best matches its risk, timing and acceptance criteria.

Closed issues may be updated during cleanup when title, body, links or status no longer match the actual project state. The update must explain the correction and must not rewrite history to hide prior decisions.

## Project-Wide API Budget Principle

External API budget minimization is a permanent product and architecture principle.

Every phase must avoid unnecessary provider calls, repeated full scans, accidental retries and implicit heavy reloads.

Required across all phases:

- Prefer cached snapshots and explicit refresh or sync actions.
- Prefer provider-side filters, pagination, narrow portfolio/date/asset scopes and bounded concurrency.
- Distinguish small response payloads from actually reduced provider calls.
- Classify errors before retrying expensive requests.
- Surface rate limits and stale data clearly.
- Avoid full Activity reloads during normal navigation, filtering, rendering or editing.
- Document request impact in API/data-pipeline PRs.

## Phase 0 - Project Rules / Architecture / Guardrails

Status: completed, maintained through governance updates.

Goal: establish and maintain the operating baseline for future repository work.

Deliverables:

- Agent entrypoint and prompt structure.
- English source-of-truth documentation.
- ADR template and architecture decision records.
- Issue forms and PR template.
- CI foundation with lint and build.
- Security, privacy and API-budget guardrails.
- Changelog and documentation index.

Non-goals:

- No product feature implementation.
- No OAuth/token/API behavior changes.
- No activity or asset calculation changes.
- No unrestricted autonomous agents.
- No private data in repository files, issues, PRs or logs.

## Phase 1 - App Shell / Navigation / UI Foundation

Status: active baseline work.

Goal: keep the existing app shell, navigation and local-first UI surfaces coherent while product direction and data foundations mature.

Expected work:

- App shell and navigation consistency.
- Local read-only surfaces for loaded data.
- UI state wording for source, freshness and confidence.
- Visual consistency and accessibility review.
- Explicit refresh affordances instead of hidden provider loads.

Non-goals:

- No broad redesign unless an issue explicitly asks for it.
- No second activity or asset pipeline before a dedicated decision allows it.
- No hidden provider calls from navigation, filtering, sorting, pagination or details.

## Phase 2 - Data Foundation / API Budget

Status: planned / partially prepared by existing architecture work.

Goal: strengthen the provider/data boundary, normalized models, cache strategy, diagnostics and API-budget observability.

Expected work:

- Provider DTO and internal model separation.
- Canonical normalization and aggregation boundaries.
- Snapshot/cache strategy with explicit refresh semantics.
- Provider-call count and scope diagnostics.
- Retry, rate-limit and stale-state handling.
- Focused tests for core data logic when test setup is available.

Non-goals:

- No product UI switch to new data flows before entry criteria are met.
- No automatic full-provider reload path without issue-level API-budget justification.
- No private raw payloads in UI, logs, exports, fixtures or issues.

## Phase 3 - Core Product Surfaces

Status: future.

Goal: build or refine the primary user-facing surfaces once the app shell and data foundation are ready.

Expected work:

- Dashboard, assets, activities, timeline, reports and settings surfaces.
- User-facing workflows backed by canonical read models.
- Local filtering, sorting, grouping and export boundaries.
- Honest wording for provider reference values, calculated values, estimates and incomplete data.

Non-goals:

- No feature-local calculation pipeline when a shared model should own the result.
- No provider DTO passthrough into UI.
- No raw private data in exports or diagnostics.

## Phase 4 - V1 Hardening / Release-Candidate Preparation

Status: future.

Goal: turn implemented v1 surfaces into release-candidate quality.

Expected work:

- Visual and interaction review across supported surfaces.
- Empty, loading, stale, error and privacy states.
- API-budget regression review.
- Documentation and ADR consistency.
- Manual verification paths and release-blocker triage.

Non-goals:

- No new product expansion that delays v1 hardening.
- No unplanned architecture rewrite.

## Phase 5 - V1 QA / Release Cut

Status: future.

Goal: verify v1 scope, resolve release blockers and prepare the release cut.

Expected work:

- Release checklist issue.
- Product surface checks.
- State and visual checks.
- Technical checks.
- Security, privacy and data-impact review.
- Sign-off notes and known limitations.

Non-goals:

- No post-v1 feature expansion.
- No merge of known release blockers without explicit documented exception.

## Phase 6 - Post-V1 Feature Expansion

Status: future.

Goal: consider new product capabilities after v1 release readiness is established.

Expected work:

- New feature triage.
- Research and ADR issues for major decisions.
- Incremental product expansion with explicit acceptance criteria.
- API-budget and privacy review before implementation.

Non-goals:

- No retroactive expansion of v1 scope.
- No implementation before phase classification.

## Idea Triage Rules

Use these categories for new issues and follow-ups:

- `Release Blocker`: prevents a release candidate or release cut. Must include blocker evidence, affected surface and release decision impact.
- `V1 Hardening`: improves correctness, clarity, visual quality, privacy posture or reliability inside planned v1 scope.
- `V1 Documentation`: updates source-of-truth docs, quickstart, guardrails, ADRs, README or release notes required for v1.
- `Post-V1 Feature`: valuable feature idea that is outside v1 scope and should not be implemented during v1 hardening.
- `Research / ADR`: decision issue with options, criteria and ADR/documentation output. No implementation in the same issue.
- `Bug Follow-up`: defect or regression that needs reproduction, expected behavior, acceptance criteria and verification.

## Review Gates

Before implementation:

- Confirm phase classification.
- Confirm scope and non-goals.
- Confirm API Budget Impact and Privacy / Data Impact.
- Confirm whether ADR or documentation output is required.

Before merge:

- Review the diff against issue acceptance criteria.
- Review API-budget impact, privacy/data impact and non-goals.
- Check for hidden provider calls in API/data-facing changes.
- Confirm documentation, changelog and phase-plan impact.

After larger PRs:

- Re-check roadmap, docs, issues and changelog.
- Update closed issues if cleanup reveals stale title/body/status.
- Create follow-up issues for deferred work instead of expanding the merged scope retroactively.
