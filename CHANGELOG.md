# Changelog

All notable repository governance changes will be documented in this file.

The format follows a slim version of Keep a Changelog. This project does not define release versions yet.

## Unreleased

### Added

- Phase-0 repository operating baseline for collaboration, documentation, prompts, templates and CI.
- Conservative Vercel ignored-build helper for documentation/governance-only changes.
- Phase-0.1 Parent/Sub-Issue plan for workflow hardening and agent readiness.
- Detailed Codex mode, task execution, issue lifecycle, PR review, documentation impact, Phase-1 gate, CI and Vercel verification rules.
- GitHub Project Board v1 setup guide with fields, label allowlist, automation limits and manual fallback.
- Guarded manual Translation-Agent v1 workflow for German documentation review markers and Draft PR creation.
- Manual Issue-Agent v1 workflow with dry-run/apply modes for allowlisted issue metadata.
- Phase-1 Global Asset Timeline Foundation parent and privacy-safe Parqet API field audit route.
- ADR 0002 for the Phase-1 Global Asset Timeline architecture decision.
- Phase-1 Global Asset Timeline type model under `src/lib/parqet/global-assets/`.
- Phase-1 Global Asset activity normalization pipeline under `src/lib/parqet/global-assets/`.
- Phase-1 Global Asset aggregation layer under `src/lib/parqet/global-assets/`.
- Phase-1 guarded Global Asset audit/report mode and local debug route.
- Windows-first local Global Asset audit helper scripts.
- Global Asset unresolved negative quantity decision foundation.
- Narrow Global Asset `ignore_activity_for_position` override application for position quantity effects.
- Persistent local cookie-jar support for Global Asset audit helpers.
- Safe diagnostic output for Global Asset audit failures, including category and retry hints where available.
- Refined Global Asset negative quantity candidate metadata for ratio and factor mismatch cases.
- Configurable Parqet activity fetch concurrency for local audit rate-limit mitigation.
- Project-wide API budget minimization principle for Parqet and external provider calls.
- Lightweight `/api/parqet/health` route for auth/portfolio checks without Activity fetches.
- Shared Parqet API diagnostics helpers and safe API-budget metadata for asset/audit flows.

### Changed

- README structure rebuilt around English source-of-truth documentation and Phase-0 workflow links.
- Development workflow updated from Phase-0 baseline to active post-Phase-0 operating rules.
- Prompt YAML files expanded as the operational source for Codex and agent behavior.
- Phase plan updated with Phase 0.1 and a stricter Phase-1 entry gate.
- Project status updated to reflect active Phase 0.1 work.
- Development workflow now references the GitHub Project Board guide as the operational board setup reference.
- Agent workflow guidance now documents the guarded Translation-Agent v1 implementation.
- Project status now marks Phase 1 as active and Phase 0.1 as complete.
- Vercel ignored-build helper now skips local/development-only Parqet audit tooling changes.
- Phase plan now describes Phase 1 as Global Asset Timeline Foundation.
- Global Asset aggregation now classifies unresolved negative quantity cases without applying corrections.
- Global Asset audit reports now expose redacted applied override metadata and applied override counts.
- Local audit helpers now support `-UseCookieJar` so refreshed cookies can persist across terminal calls.
- Local audit helpers now print safe diagnostic and error sections when returned by the audit route.
- Local audit helpers now print safe API-budget metadata when returned by the audit route.
- Global Asset negative quantity suggestions are now more conservative for non-duplicate ratio mismatch cases.
- Global Asset audit docs now distinguish response-size reduction from provider-call reduction.
- Assets route now classifies non-auth provider failures before retrying after token refresh.
- Activity fetching now requests security assets by default and uses a larger page limit to reduce unnecessary provider payload for current asset flows.

### Fixed

- Consolidated obsolete duplicated masterprompt guidance into the new `prompts/` structure.
- Improved Global Asset audit error classification so provider rate limits are not misreported as expired sessions.
- Prevented `/api/parqet/assets` from retrying the full Activity pipeline after non-auth failures such as provider rate limits.

### Docs

- Added Phase-0 documentation set, ADR template and collaboration ADR.
- Documented the Vercel ignored-build strategy in the development workflow.
- Documented review levels, documentation impact rules, verification vocabulary and privacy guardrails.
- Documented GitHub Project Board v1 manual setup and connector fallback.
- Documented Translation-Agent v1 modes, scope and prohibitions.
- Documented Issue-Agent v1 manual usage, dry-run/apply behavior and hard limits.
- Added `docs/PARQET_API_AUDIT.md` for Phase-1 API field audit guidance.
- Recorded non-private local Parqet API field audit findings for Phase 1.
- Documented the Global Asset Timeline architecture decision in `docs/adr/0002-global-asset-timeline.md`.
- Added `docs/GLOBAL_ASSET_TYPE_MODEL.md` for the Phase-1 type boundary.
- Added `docs/GLOBAL_ASSET_NORMALIZATION.md` for the Phase-1 normalization mapping.
- Added `docs/GLOBAL_ASSET_AGGREGATION.md` for the Phase-1 aggregation mapping.
- Added `docs/GLOBAL_ASSET_AUDIT_REPORT.md` for the Phase-1 audit/report mode.
- Added `docs/LOCAL_AUDIT_WORKFLOW.md` for terminal-based local audit helpers.
- Added `docs/GLOBAL_ASSET_OVERRIDES.md` for future user-confirmed correction decisions.
- Documented narrow `ignore_activity_for_position` override application and audit visibility.
- Documented persistent local audit authentication with a gitignored cookie jar.
- Documented refined negative quantity cause categories and ratio metadata.
- Documented local audit activity fetch concurrency guidance.
- Documented API budget minimization in the master prompt, agent entrypoint, workflow and phase plan.
- Documented `/api/parqet/health` as the preferred lightweight auth/session check before expensive audits.

### Governance

- Established Codex task modes, PR expectations, issue templates, branch rules, security guardrails and manual-only placeholder agent workflows.
- Defined agent categories, maturity levels and initial permissions for Role-Agents, Automation-Agents and GitHub-native automations.
- Established Phase-0.1 implementation grouping: Rules / Docs / YAML, GitHub Project / Labels, and Agent Workflows.
- Defined baseline label allowlist and Project Board v1 field model.
- Replaced the Translation-Agent placeholder with a constrained manual workflow.
- Replaced the Issue-Agent placeholder with a constrained manual metadata workflow.
- Started Phase 1 with API field audit before Global Asset Timeline implementation.
- Required API budget impact analysis for future Parqet/API-touching issues and pull requests.

### Security

- Added local reference and environment file rules, including `.local/` and `.env*` ignore policy with `.env.example` allowed.
- Reinforced private-data and log-handling rules for API/Auth/Data-related work.
- Kept Translation-Agent v1 free of external translation services and app-code access.
- Added feature-flag and production-blocking requirements for Parqet API audit routes.
- Added feature-flag, production-blocking and redaction rules for the Global Asset audit/report route.
- Documented that local audit helpers must not print cookies, tokens, `.env.local` values or raw payloads.
- Added safety rules for future user-confirmed Global Asset overrides.
- Documented that real local override decisions must not be committed.
- Documented that local audit cookie jars remain under `.local/` and must not be committed.
- Redacted local audit diagnostic error messages before returning them from guarded API-budget/audit routes.
