# Phase Plan

Status: active for Phase 0

## Phase 0 - Collaboration And Repo Operating System

Goal: establish the operating baseline for future repository work.

Deliverables:

- Agent entrypoint.
- Prompt structure.
- English source-of-truth documentation.
- German placeholders for README and development workflow.
- ADR template and collaboration ADR.
- Issue forms and PR template.
- CI foundation with lint and build.
- Manual-only placeholder workflows for future agents.
- Security and privacy guardrails.
- Changelog.

Non-goals:

- No product features.
- No dashboard redesign.
- No OAuth/token/API changes.
- No activity or asset calculation changes.
- No Vitest or Playwright setup.
- No Branch Protection activation.
- No auto-merge activation.

## Phase 1 - Architecture And Pipeline Decisions

Goal: decide and document the target architecture for shared Parqet data flow before larger implementation work.

Likely work:

- Define shared activity/asset context boundary.
- Identify duplicated route or library responsibilities.
- Decide pipeline consolidation approach.
- Define API compatibility requirements.
- Decide test strategy for pipeline work.
- Add ADRs for pipeline and any persistence/caching decision.

## Phase 2 - Implementation Foundations

Placeholder.

Likely themes:

- Shared pipeline implementation work.
- Focused tests for core data logic.
- Safer metadata and reconciliation verification.

## Phase 3 - Performance And UX Reliability

Placeholder.

Likely themes:

- Bounded concurrency.
- Pagination/filtering improvements.
- Cache and stale-state decisions.
- Loading and error-state reliability.

## Phase 4 - Quality Gates And Automation

Placeholder.

Likely themes:

- Test expansion.
- CI hardening.
- Branch Protection activation.
- Later documentation-only CI optimization.
- Possible constrained auto-merge for documentation or prompt-only changes.
