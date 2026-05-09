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

### Fixed

- Consolidated obsolete duplicated masterprompt guidance into the new `prompts/` structure.

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

### Governance

- Established Codex task modes, PR expectations, issue templates, branch rules, security guardrails and manual-only placeholder agent workflows.
- Defined agent categories, maturity levels and initial permissions for Role-Agents, Automation-Agents and GitHub-native automations.
- Established Phase-0.1 implementation grouping: Rules / Docs / YAML, GitHub Project / Labels, and Agent Workflows.
- Defined baseline label allowlist and Project Board v1 field model.
- Replaced the Translation-Agent placeholder with a constrained manual workflow.
- Replaced the Issue-Agent placeholder with a constrained manual metadata workflow.
- Started Phase 1 with API field audit before Global Asset Timeline implementation.

### Security

- Added local reference and environment file rules, including `.local/` and `.env*` ignore policy with `.env.example` allowed.
- Reinforced private-data and log-handling rules for API/Auth/Data-related work.
- Kept Translation-Agent v1 free of external translation services and app-code access.
- Added feature-flag and production-blocking requirements for Parqet API audit routes.
- Added feature-flag, production-blocking and redaction rules for the Global Asset audit/report route.
- Documented that local audit helpers must not print cookies, tokens, `.env.local` values or raw payloads.
