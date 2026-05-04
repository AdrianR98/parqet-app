# Codex Task Catalog — Parqet App

Status: draft
Owner: AdrianR98
Scope: phased work packages for `AdrianR98/parqet-app`

Use this catalog together with `docs/CODEX_MASTERPROMPT.md`. Each task below is intended to become a focused GitHub issue or Codex task.

---

## Phase order

1. GitHub and governance foundation
2. Documentation single source of truth
3. Canonical data pipeline
4. Performance and pagination
5. Feature and data-quality workflows
6. UI parity and UX consistency
7. QA, tests and CI

Do not implement later phases in a way that bypasses earlier architectural decisions.

---

## Task catalog

| ID | Title | Intent | Read first | Modify | Acceptance | Labels | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1-A | GitHub basis issues | Create parent issue and 7 child issues for the phased roadmap | `README.md`, `.github/*` | GitHub issues | Parent and child issues exist, each with checklist and DoD | `meta`, `planning` | High |
| P1-B | Issue forms and PR template | Standardize intake and PR reviews | `.github/*`, `README.md` | `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md` | Feature/bug/tech-debt forms and PR template exist | `meta`, `dx` | High |
| P1-C | Board and branch rules docs | Document Project board fields and branch protection plan | `.github/*`, `docs/*` | `docs/ROADMAP.md`, optional ADR | Board setup and branch-protection plan documented | `meta`, `governance` | High |
| P2-A | Replace default README | Bring README to product state | `README.md`, `package.json` | `README.md` | Install, env, routes, scripts and architecture links documented | `docs` | High |
| P2-B | Docs SSoT | Create core documentation set | `README.md`, `package.json`, `src/app/**/*`, `src/lib/**/*` | `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/ROADMAP.md` | Docs are consistent and link to each other | `docs`, `architecture` | High |
| P2-C | UI reference and ADR templates | Create UI reference mapping and ADR folder | Parqet reference material, existing UI files | `docs/UI_REFERENCE_PARQET.md`, `docs/adr/*` | UI reference and ADR template exist | `docs`, `adr`, `ux` | Medium |
| P3-A | Build activity context | Extract shared pipeline service | `src/lib/parqet-assets/*`, `src/lib/types.ts` | `src/lib/parqet-assets/build-activity-context.ts` | One shared context builder exists, no response regression | `backend`, `refactor` | High |
| P3-B | Refactor assets and audit routes | Reuse shared context in route handlers | `src/app/api/parqet/**/*`, `src/lib/parqet-assets/*` | affected route handlers and types | Less duplicated logic, same responses, build green | `backend`, `api` | High |
| P3-C | Pipeline ADR | Document canonical pipeline | pipeline files, docs | `docs/adr/*` | ADR documents context, decision, alternatives and consequences | `adr`, `architecture` | Medium |
| P4-A | Bounded concurrency | Avoid sequential activity loading waterfalls | `src/lib/parqet-assets/fetch-activities.ts` | same file, optional `concurrency.ts` | Configurable bounded concurrency, safe error handling | `performance`, `backend` | High |
| P4-B | Server pagination | Move activity audit pagination/filtering server-side | `src/app/api/parqet/activities-audit/route.ts`, `src/hooks/use-activities-audit.ts`, `src/app/(app)/activities/page.tsx` | same files | `page`, `pageSize`, filters, total and hasNextPage supported | `performance`, `api`, `ux` | High |
| P4-C | Cache and loading states | Improve dashboard refresh UX | `src/hooks/use-dashboard-data.ts`, dashboard route files | same files, `loading.tsx` | Cached state, stale warning, loading UI, no hard blocking | `performance`, `ux` | Medium |
| P5-A | Override workflow | Turn warnings into reviewable cases | activities page, types, override store | affected UI/lib files | Status, reset, source and light audit history visible | `feature`, `audit` | High |
| P5-B | Naming and closed positions | Make asset display names and closed positions reliable | assets route, metadata files, aggregation files | affected lib and route files | Single resolver, clear active/closed split | `feature`, `data-quality` | High |
| P5-C | New activity decision | Remove misleading CTA or document minimal future flow | activities page, roadmap | same files | No misleading CTA remains | `ux`, `feature` | Medium |
| P6-A | UI parity audit | Compare UI components against Parqet reference | `src/components/**/*`, `src/app/globals.css`, reference HTML | `docs/UI_REFERENCE_PARQET.md`, maybe components | Ist/Soll/Gap/Next-step mapping exists | `ux`, `design` | Medium |
| P6-B | Theme tokens and skeletons | Harmonize tokens, spacing and loading | CSS modules, globals, route files | affected UI files | No token drift, usable skeletons | `ux`, `frontend` | Medium |
| P6-C | UI guidelines ADR | Guard future UI PRs | UI docs, globals | `docs/adr/*` | ADR documents tokens, references and deviation rules | `adr`, `ux` | Low |
| P7-A | Introduce Vitest | Add unit test infrastructure | `package.json`, TS config, lib files | `package.json`, `vitest.config.*`, `__tests__/*` | `npm run test` exists; core logic tests added | `qa`, `testing` | High |
| P7-B | Playwright smoke | Add E2E smoke tests | app routes, package config | `playwright.config.*`, `e2e/*`, workflows optional | Dashboard and activities smoke tests exist | `qa`, `e2e`, `ci` | Medium |
| P7-C | CI and merge gates | Add lint/build/test workflow and branch protection docs | `package.json`, `.github/*` | `.github/workflows/ci.yml`, docs/PR template | CI runs lint/build/test; required checks documented | `ci`, `governance` | High |

---

## Compact task prompt format

Use this for each issue:

```text
Use docs/CODEX_MASTERPROMPT.md and docs/CODEX_TASK_CATALOG.md.

Task ID: <P...>
mode: code
repo: AdrianR98/parqet-app
base_branch: main
target_branch: <branch-name>

task_title: <catalog title>
task_intent: <catalog intent plus issue-specific notes>

read_files:
- <from catalog, adjusted after inspection>

modify_files:
- <from catalog, adjusted after inspection>

acceptance_criteria:
- <specific criterion>
- npm run lint passes
- npm run build passes
- npm run test -- --run passes if available; otherwise explicitly report missing test script

non_goals:
- No broad redesign
- No unrelated refactor
- No secret or private data commits

risks_to_watch:
- API response compatibility
- Performance regressions
- UI token drift
- Hidden data-quality regressions
```

---

## Open assumptions to track in issues

- Exact Parqet API support for delta/since queries is not confirmed.
- Real Parqet API rate limits are not documented in this repo.
- Productive secret names and local env strategy must be documented before CI/E2E work.
- Override persistence target is currently file-oriented unless a later issue changes it.
- Test data and mocking strategy must avoid committing private portfolio exports.
- Final entry route (`/` or `/dashboard`) must be decided explicitly.
- The `Neue Aktivität` CTA must not imply a write flow unless implemented.
