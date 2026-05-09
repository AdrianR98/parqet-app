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

### Changed

- README structure rebuilt around English source-of-truth documentation and Phase-0 workflow links.
- Development workflow updated from Phase-0 baseline to active post-Phase-0 operating rules.
- Prompt YAML files expanded as the operational source for Codex and agent behavior.
- Phase plan updated with Phase 0.1 and a stricter Phase-1 entry gate.
- Project status updated to reflect active Phase 0.1 work.
- Development workflow now references the GitHub Project Board guide as the operational board setup reference.

### Fixed

- Consolidated obsolete duplicated masterprompt guidance into the new `prompts/` structure.

### Docs

- Added Phase-0 documentation set, ADR template and collaboration ADR.
- Documented the Vercel ignored-build strategy in the development workflow.
- Documented review levels, documentation impact rules, verification vocabulary and privacy guardrails.
- Documented GitHub Project Board v1 manual setup and connector fallback.

### Governance

- Established Codex task modes, PR expectations, issue templates, branch rules, security guardrails and manual-only placeholder agent workflows.
- Defined agent categories, maturity levels and initial permissions for Role-Agents, Automation-Agents and GitHub-native automations.
- Established Phase-0.1 implementation grouping: Rules / Docs / YAML, GitHub Project / Labels, and Agent Workflows.
- Defined baseline label allowlist and Project Board v1 field model.

### Security

- Added local reference and environment file rules, including `.local/` and `.env*` ignore policy with `.env.example` allowed.
- Reinforced private-data and log-handling rules for API/Auth/Data-related work.
