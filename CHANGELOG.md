# Changelog

All notable repository governance changes will be documented in this file.

The format follows a slim version of Keep a Changelog. This project does not define release versions yet.

## Unreleased

### Added

- Added DP-08 warning, confidence and blocked-metrics policy documentation for stable warning categories, user/diagnostic redaction boundaries, metric-specific confidence and read-model source/freshness expectations.
- Added DP-06 cost-basis, PnL and price-source policy documentation for weighted-average remaining cost basis, provider-reference boundaries, fallback price semantics, blocked metrics and validation evidence before implementation.
- Added DP-07 dividend, fee, tax and currency policy documentation for same-currency-only money aggregation, gross/net dividend handling, closed-position income, blocked metrics, FX deferral and audit/read-model expectations.
- Added DP-05 transfer handling documentation for deterministic transfer pairing, ambiguity statuses, warning categories, blocked metrics and audit/read-model expectations.
- Added DP-04 activity normalization contract documentation for app-owned normalized activities, warning-code boundaries, ID/date/currency rules and raw-provider-payload privacy limits.
- Added DP-03 asset identity and metadata boundary documentation for ISIN-only calculation identity, display-only metadata, identity warnings, confidence impact and blocked-metric handling.
- Added scope-based Codex verification profiles so local checks are selected by task type while GitHub Actions remains the final PR gate.
- Added a local Settings preference for Dashboard, Timeline and Reports reveal block size with 20, 50 and 100 row options.
- Added a GitHub Actions PR check for the V1 Playwright smoke suite with standard Chromium dependency installation and no default Playwright media artifacts.
- Added Codex token/context budget guardrails for broad tasks, including smaller-slice stop rules, targeted diff reporting and optional browser inspection boundaries.
- Added local asset metadata maintenance workflow documentation for safe CSV generation, privacy review, fallback order and provider-call-free v1 metadata handling.
- Extended the local/manual Playwright V1 smoke tests with privacy-safe synthetic browser-local state and interaction coverage for Activities, Timeline, Settings and Reports.
- Added a local/manual Playwright V1 smoke-test foundation for hydration and API-budget regressions without real Parqet credentials or provider data.
- Added app-neutral `docs/PHASE_PLAN.md`, `docs/V1_GUARDRAILS.md` and `docs/LOCAL_QUICKSTART.md` as the current governance document structure.
- Added GitHub Issue Forms for feature, bug, v1 hardening, research/ADR, documentation, cleanup/consistency and release checklist issues.

- Added a local-first Activities product surface with read-only cards, safe detail panel, local filters, sort controls, pagination and freshness/source status.
- Added a global read-only Timeline product surface with month/year grouping, local timeline filters, portfolio-scope mismatch notice and no automatic provider or audit-route loading.
- Added shared local Activity read-model helpers for safe display projection, German activity labels, local filtering/sorting and timeline grouping.

- Added bounded in-memory Activity snapshot reuse with safe freshness metadata for AssetTrace v1 API-budget flows.
- Added snapshot-backed Activities rendering from the local Dashboard read model so opening Activities does not trigger a hidden provider fetch.
- Documented the v1 production cache boundary: no durable server/database persistence before a separate ADR.

- Local Reports v1 surface with loaded-data report tiles, portfolio breakdown, data-quality summary and local Markdown/CSV export actions without new provider calls.
- Chart-based Assetdetail Timeline v1 with local marker visualization, range controls, disabled unsafe chart modes and marker-only empty fallback without new provider calls.
- Asset detail foundation route with local Dashboard-cache lookup, readable slug plus stable `id` query key, read-only sections and a timeline placeholder without new provider calls.
- AssetTrace Settings page with local appearance mode, portfolio scope, privacy/reset controls and safe development diagnostics.
- Local AssetTrace quickstart covering connection, explicit refresh, global portfolio scope, appearance mode, reset controls and API-budget guidance.
- AssetTrace v1 UI foundation with main navigation placeholders for Dashboard, Aktivitäten, Timeline, Reports and Einstellungen.
- Local AssetTable search, clearer loaded/empty/loading states and future drilldown affordance without implementing an Assetdetail route.
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
- AssetTrace v1 guardrails for provider/internal/UI model separation, purpose-specific data sources, API-budget review, feature capability matrix and analytics safety disclosure.
- Refined Global Asset negative quantity candidate metadata for ratio and factor mismatch cases.
- Configurable Parqet activity fetch concurrency for local audit rate-limit mitigation.
- Project-wide API budget minimization principle for Parqet and external provider calls.
- Lightweight `/api/parqet/health` route for auth/portfolio checks without Activity fetches.
- Shared Parqet API diagnostics helpers and safe API-budget metadata for asset/audit flows.
- Lightweight local Parqet connection status indicator in the app shell and Settings without new provider calls.

### Changed

- Improved large local dataset responsiveness for Dashboard AssetTable, Activities, Timeline and Reports with clearer progressive reveal while keeping totals and provider-call behavior unchanged.
- Improved V1 asset metadata display fallbacks so local/enriched metadata names are preferred over identifier-only asset labels, including Activities and Timeline local read models.
- V1 warning, data-quality and confidence wording is now more consistent across Dashboard, Asset Detail, Timeline and Reports without adding provider calls or new warning logic.
- User-facing Parqet auth, rate-limit and provider error wording is now clearer in German, discourages repeated refresh attempts during rate limits and keeps raw/debug details out of normal Dashboard and Asset Audit UI states.
- Neutralized governance, workflow, v1 guardrail and template wording so durable repository rules do not depend on the current visible product name.
- Strengthened the PR template with required Phase, Scope, Non-goals, API Budget Impact, Privacy / Data Impact, UI / UX Impact, Testing, Reviewer Checklist and Post-merge Cleanup sections.
- Strengthened Codex task governance so non-trivial prompts must include scope, non-goals, acceptance criteria, verification, API Budget Impact and Privacy/Data Impact before issue.
- Renamed the phase-plan, v1-guardrail, local quickstart and ADR 0005 references to the app-neutral document structure.
- Removed deprecated app-name-specific compatibility docs after all repository references moved to neutral targets.

- Documented that Activities and Timeline use local/snapshot-backed Activity Items and require explicit Dashboard refresh for new provider data.
- AssetTrace v1 navigation, activity detail fields, timeline summary, app-bar status and user-facing severity/freshness wording are now more consistent across local snapshot-backed surfaces.
- Clarified Portfolio scope wording across Dashboard, selector, app bar and Settings so selected scope and loaded data scope are easier to distinguish without automatic refreshes.

- German financial, quantity, date and warning severity formatting is now centralized and reused by report/dashboard surfaces.
- Dashboard portfolio selection now persists through the local global portfolio scope without triggering hidden provider refreshes.
- App shell theme control now reflects the persisted System/Hell/Dunkel appearance mode.
- Dashboard branding, refresh wording, app-shell status area and empty-state copy now consistently present AssetTrace as an analysis and transparency layer for Parqet data.
- AssetTable interactions now emphasize local filtering, sorting and column selection without provider calls.
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

- Fixed remaining Activities, Timeline and Reports hydration risks by applying browser-local snapshot/read-model state only after hydration.
- Fixed page-level hydration mismatches from browser-local Settings and Asset Detail state.
- Fixed local app-shell hydration mismatches from browser-only theme, connection and local activity status state.
- Hardened Snapshot/API-budget follow-up behavior so explicit refresh semantics, snapshot-first audit routes and local diagnostics reset state stay provider-call-safe.
- Activity asset-name links now navigate to local Asset Detail without also opening the Activity Detail panel.
- Consolidated obsolete duplicated masterprompt guidance into the new `prompts/` structure.
- Improved Global Asset audit error classification so provider rate limits are not misreported as expired sessions.
- Prevented `/api/parqet/assets` from retrying the full Activity pipeline after non-auth failures such as provider rate limits.

### Docs

- Added the DP-02 provider data-source strategy for current-state, activity-history, snapshot/read-model, local metadata, provider-reference and blocked metric ownership.
- Aligned README, roadmap, project status, architecture and v1 guardrail links with the #248/#249 pipeline-readiness workflow and `docs/PIPELINE_INVENTORY.md`.
- Added a Parqet pipeline inventory and replacement-gate checklist for #248/#249 route/read-model migration planning.
- Added a v1 API-budget manual QA checklist for provider-call-safe local UI flows, release-readiness review and privacy-safe verification.
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

- Added Mermaid-based workflow documentation for ChatGPT intake, Codex execution, mode selection and mode-specific read sets, and clarified that Codex never creates PRs.
- Added Codex prompt governance for task-relevant plugin/tool use, including Superpowers, Vercel, Figma and Browser/Playwright boundaries.
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
