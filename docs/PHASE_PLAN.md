# Phase Plan

Status: active after Phase 0

## Phase 0 - Collaboration And Repo Operating System

Status: completed.

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
- Vercel ignored-build helper for documentation/governance-only changes.

Non-goals:

- No product features.
- No dashboard redesign.
- No OAuth/token/API changes.
- No activity or asset calculation changes.
- No Vitest or Playwright setup.
- No Branch Protection activation.
- No auto-merge activation.

## Phase 0.1 - Workflow Hardening And Agent Readiness

Status: in progress.

Goal: harden the Phase-0 collaboration system before product and architecture work begins.

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

Implementation groups:

1. Rules / Docs / YAML.
2. GitHub Project / Labels.
3. Agent Workflows.

Non-goals:

- No product feature implementation.
- No Parqet API/OAuth/token behavior changes.
- No dashboard, activity, asset or calculation logic changes.
- No unrestricted autonomous agents.
- No direct `main` writes by agents.
- No private data in repository files, issues, PRs or logs.

## Phase 1 - Product, Architecture And Pipeline Decisions

Status: planned after Phase 0.1.

Goal: decide and document the product target and architecture for shared Parqet data flow before larger implementation work.

Entry gate:

- Phase-1 specification may be prepared during Phase 0.1.
- Phase-1 implementation starts only after Phase 0.1 is merged.
- Phase 1 starts with product goal definition.
- The current app is audited against that product goal afterwards.
- First product implementation starts only after an Implementation Entry Checklist.

Likely work:

- Define target product goal and non-goals.
- Define priority user flows.
- Decide whether the current app is continued/refactored, partially rebuilt or fully rebuilt.
- Define shared activity/asset context boundary.
- Identify duplicated route or library responsibilities.
- Decide pipeline consolidation approach.
- Define API compatibility requirements.
- Decide caching/persistence concept.
- Decide test strategy for pipeline work.
- Add ADRs for pipeline and any persistence/caching decision.

Guardrails:

- Existing app remains the stable baseline during Phase 1.
- No second activity or asset pipeline before Phase 1 decision or ADR.
- OAuth/Auth remains unchanged until a dedicated Full Review issue exists.
- Real Parqet reference files stay local/ignored and must not enter issues, PRs or logs.

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
