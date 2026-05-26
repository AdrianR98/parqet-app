# Project Status

Status: Active baseline aligned to current architecture
Owner: AdrianR98
Last reviewed: 2026-05-26

## Active Documentation Refactor Context

- Refs #384: Phase 1 domain language/model-boundary hardening.
- Fixes #385: Documentation baseline for the domain refactor roadmap before implementation changes.

## Current Baseline

- Next.js Parqet Integration with Parqet OAuth for authorized portfolio access.
- User Portfolio Data is cached browser-local for Dashboard, Activities and Asset Detail.
- `/settings` is simplified to `Parqet-Verbindung` and `Darstellung`.
- Disconnect clears server-side Parqet auth cookies and Parqet-derived browser-local data while keeping appearance/UI preferences.
- Header portfolio selection is the user-facing selection path.
- Dashboard, Activities and Asset Detail can recover missing local cache via bootstrap/cache-change flow.
- `/admin` is isolated in `(admin)` and currently read-only for market-data inspection/triage.
- Runtime market-history reads are DB-only.
- Provider calls are restricted to explicit Admin/CLI workflows.

## Market-Data Direction

- Current provider workflow for validation/backfill/update is yfinance-based.
- OpenFIGI may be used as candidate lookup/admin workflow.

## Follow-Ups

1. Full Admin Auth/AuthZ hardening before production admin enablement.
2. CSP nonce/hash strategy for inline root scripts.
3. Cache-event debounce/performance pass.
4. Dark-mode asset/logo research: issue #379.
5. Future corporate-action/security-lineage planning.

## Future Corporate-Action / Lineage Work (Not Implemented)

Goal: show merged economic history across related instruments without rewriting raw activities.

Current building blocks:

- `market_actions`
- instrument successor fields/status
- yfinance split/dividend import
- admin triage workflows

Needed next:

- explicit Asset Family / Security Lineage model
- verified event sources
- cost-basis/quantity invariants
- UI toggle between concrete Instrument history and Asset Family history
