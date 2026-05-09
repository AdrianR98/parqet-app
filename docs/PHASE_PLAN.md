# Phase Plan

Status: active in Phase 1

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

Status: completed.

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

## Project-Wide API Budget Principle

External API budget minimization is a permanent product and architecture principle.

Every phase must avoid unnecessary Parqet/provider calls, repeated full scans, accidental retries and implicit heavy reloads.

Required across all phases:

- Prefer cached snapshots and explicit refresh/sync actions.
- Prefer provider-side filters, pagination, narrow portfolio/date/asset scopes and bounded concurrency.
- Distinguish small response payloads from actually reduced provider calls.
- Classify errors before retrying expensive requests.
- Surface rate limits and stale data clearly.
- Avoid full Activity reloads during normal navigation, filtering, rendering or editing.
- Document request impact in API/data-pipeline PRs.

## Phase 1 - Global Asset Timeline Foundation

Status: active.

Parent issue: #57

Goal: define and prepare the product and architecture foundation for an asset-centric, portfolio-wide Global Asset Timeline.

The app is a Parqet Integration Dashboard. Parqet remains the data source through Parqet Connect / OAuth. This app adds a consolidated analysis layer across authorized portfolios.

Core product goal:

- consolidate the same security across multiple portfolios,
- use a Global Asset model centered on security identity,
- preserve portfolio origin,
- preserve activity history, dividends, fees and taxes,
- represent transfer-related events explicitly,
- produce warnings/confidence instead of hiding ambiguous data,
- minimize Parqet/API usage through bounded requests, cache-aware flows and explicit refresh semantics,
- keep the existing product implementation stable until the implementation gate is met.

Completed work:

- #58 P1-1: API field audit completed and recorded in `docs/PARQET_API_AUDIT.md`.

Current work:

- #62 P1-2: ADR Global Asset Timeline.

Planned next work:

- P1-3: Type model for `NormalizedActivity`, `GlobalAsset`, portfolio breakdowns, timeline entries, warnings and confidence.
- P1-4: Normalization pipeline.
- P1-5: Global Asset builder / aggregation.
- P1-6: Transfer representation and later transfer pairing.
- P1-7: Reconciliation warnings and confidence.
- P1-8: Audit JSON report / debug UI.

Entry / implementation gate:

- API audit completed.
- API budget impact understood for the affected data flow.
- Global Asset Timeline ADR accepted.
- Type model defined.
- Normalization boundary defined.
- Warning/confidence model defined.
- Audit/report mode exists.
- Existing asset calculation remains unchanged until explicit decision.
- No real Parqet reference files enter repository files, issues, PRs or logs.

Guardrails:

- Existing app remains the stable baseline during Phase 1.
- No product UI switch to Global Asset data before the implementation gate.
- No automatic transfer pairing before a dedicated issue.
- OAuth/Auth remains unchanged until a dedicated Full Review issue exists.
- Real Parqet reference files stay local/ignored and must not enter issues, PRs or logs.
- No new broad provider reload path without explicit API-budget justification.

Known follow-ups:

- Transfer pairing / matching model for `transfer_in` and `transfer_out`.
- OpenAPI cross-check against the official Parqet Connect specification.
- Cost-basis and realized-gain decision after type model and audit/report mode.
- Lightweight auth/portfolio health check without Activity fetch.
- Server-side Activity or normalized snapshot cache with TTL and explicit refresh.
- Provider-call count diagnostics for local audit/debug routes.

## Phase 2 - Implementation Foundations

Placeholder.

Likely themes:

- Shared pipeline implementation work.
- Focused tests for core data logic.
- Safer metadata and reconciliation verification.
- Cache and sync model foundations.
- Request-budget observability for provider calls.

## Phase 3 - Performance And UX Reliability

Placeholder.

Likely themes:

- Bounded concurrency.
- Pagination/filtering improvements.
- Cache and stale-state decisions.
- Explicit sync/refresh flows.
- Loading and error-state reliability.
- Avoiding full scans for normal UI interactions.

## Phase 4 - Quality Gates And Automation

Placeholder.

Likely themes:

- Test expansion.
- CI hardening.
- Branch Protection activation.
- Later documentation-only CI optimization.
- Possible constrained auto-merge for documentation or prompt-only changes.
