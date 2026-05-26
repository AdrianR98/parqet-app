# V1 API-Budget QA Checklist

Status: active release-readiness checklist

Scope: manual QA for provider-call-safe v1 UI flows

## Purpose

Use this checklist before the v1 release decision and for PRs that touch v1 UI, report, diagnostics or local-data behavior.

The goal is to catch API-budget regressions where normal local UI interactions accidentally trigger hidden provider calls, broad reloads, background sync, polling or audit routes.

This checklist is documentation-only. It does not introduce provider calls, test tooling, fixtures, screenshots or app behavior changes.

## Required Setup

- Run against local development only.
- Use already loaded local/snapshot data, a synthetic privacy-safe local state or an intentionally empty local state.
- Do not connect to a real provider only to run this checklist.
- Do not add Playwright, Vitest or other new test tooling for this checklist.
- Keep browser developer tools open on the Network tab when manually checking UI flows.
- Clear the Network log immediately before each flow.
- Filter or inspect requests for provider-facing paths, Parqet routes, audit routes, reloads, background sync and polling.

Allowed during this checklist:

- Static assets and normal Next.js/client-side route assets.
- Browser-local state reads and writes.
- Snapshot/local read-model reads that do not call the provider.
- Empty states that ask for an explicit Dashboard load/refresh.

Forbidden during local-only flows:

- New provider/API requests.
- Hidden full portfolio, holdings, activity, analytics or report fetches.
- Audit routes unless the flow explicitly documents a local snapshot-only read.
- Automatic refresh, polling, background sync or implicit reload.
- Retrying provider calls after local filtering, sorting, pagination, detail expansion, report preview or export actions.

## Privacy Rules

- Do not commit or paste raw provider payloads, tokens, cookies, OAuth codes, authorization headers, `.env` values, private Parqet exports, real depot/portfolio data or private screenshots.
- Screenshots are optional and must use synthetic or privacy-safe data only.
- Logs and diagnostics must be redacted and count/scope-oriented.
- If private data appears in a diff, PR description, issue comment, log excerpt or screenshot, the PR is blocked until the exposure is removed and reviewed.
- Local reference files belong only in ignored paths such as `.local/`.

## Manual Verification Matrix

For each row:

1. Clear the browser Network log.
2. Perform the listed local interaction.
3. Confirm no hidden provider/API call, audit refresh, full reload, polling or background sync appears.
4. Record `pass`, `fail` or `not applicable` in the PR or release checklist, with a short reason for failures or skips.

| Flow | Local interactions to check | Expected API-budget result | Privacy/data check |
| --- | --- | --- | --- |
| App navigation | Navigate between Dashboard, Activities, Timeline, Reports, Settings and existing asset detail pages after data is already loaded, and repeat with no local data where possible. | Client-side navigation reuses local/snapshot state or shows explicit empty states. No hidden provider calls, full reloads, audit refreshes or background sync. | URLs and visible state must not expose tokens, cookies, OAuth codes or raw provider identifiers beyond safe stable asset keys already intended for routing. |
| Dashboard table | Use Dashboard local search, sort, filters and table interactions over loaded assets. | Filtering and sorting are browser-local. No provider reload, no activity fetch and no retry path starts. | Table values must be read-model fields, not raw provider payload dumps. |
| AssetTable columns | Toggle AssetTable columns and display options. | Column visibility changes are local UI state only. No provider calls or hidden refresh. | Hidden fields must not reveal raw payloads, private debug values or internal secrets when shown again. |
| Asset detail navigation | Open asset detail from Dashboard and navigate between existing asset detail URLs that can be satisfied from local data. | Detail pages use loaded Dashboard/read-model data or ask for explicit Dashboard load/refresh. No audit route, provider call or full activity fetch starts. | Route slugs and query keys must remain safe, stable identifiers; no private raw payloads in the page or URL. |
| Asset detail chart/range | Change chart range, zoom/range controls and local chart modes for an already loaded asset. | Chart controls operate on already loaded points/markers. Missing data shows a local empty or marker-only state instead of fetching. | Chart labels/tooltips must not show raw provider payloads or private debug data. |
| Activities list | Use Activities filters, text search, sorting, grouping if available, pagination/load-more and detail panel open/close. | Interactions operate on loaded Activity Items. Pagination is local over the loaded set. No provider calls, audit refreshes, automatic reloads or retries. | Detail panel shows only safe read-model fields and no tokens, cookies, raw payloads, hidden technical IDs or private notes beyond approved safe fields. |
| Timeline | Change Timeline filters, grouping/scope controls and local summary interactions. | Summary counts and filters are calculated from loaded local Activity Items. No provider call or background sync starts. | Warnings and summaries must be redacted and count/scope-oriented. |
| Reports | Open Reports, change preview/local report options, copy Markdown and export CSV. | Opening, previewing, copying and exporting use the selected local snapshot/read model only. No provider refresh is triggered by report actions. | Exports contain only visible, loaded and safe report/read-model fields. No raw payloads, tokens, cookies, hidden IDs, debug data or private screenshots. |
| Settings appearance | Change System/Hell/Dunkel appearance mode. | Appearance changes write local UI state only. No provider call, reload, sync or audit route starts. | Settings must not display secrets or raw provider payloads. |

## Reviewer Notes

- This checklist supports release-readiness triage for #213 and partial API-budget guardrail work for #157 without closing #157 by itself.
- Use `Refs` for #157, #179 and #213 unless a linked issue is fully verified against all acceptance criteria.
- A failing row is a release-readiness finding. Do not work around it by repeatedly refreshing provider data during review.
- If a flow truly needs missing provider data, the UI must make that explicit through a user-initiated load/refresh action with scope and freshness visible.
- For API/data-facing PRs, pair this manual checklist with the `docs/V1_GUARDRAILS.md` review checklist and the PR template API Budget Impact section.
