# Roadmap und Governance — Parqet App

Status: draft
Owner: AdrianR98
Scope: `AdrianR98/parqet-app`
Last reviewed: 2026-05-04

Dieses Dokument beschreibt die Arbeitsorganisation für die Weiterentwicklung der Parqet-App. Es ergänzt `docs/CODEX_MASTERPROMPT.md` und `docs/CODEX_TASK_CATALOG.md`.

---

## 1. Ziel der Roadmap

Die App soll schrittweise von einer funktionalen Parqet-Integration zu einer stabil dokumentierten, testbaren und performant erweiterbaren Anwendung ausgebaut werden.

Priorität hat nicht der schnelle Umbau einzelner UI-Bereiche, sondern eine tragfähige Grundlage:

1. Governance und Issue-Struktur,
2. Dokumentation als Single Source of Truth,
3. konsolidierte Datenpipeline,
4. Performance-Verbesserung,
5. fachliche Audit- und Override-Workflows,
6. UI/UX-Konsistenz nach Parqet-Referenz,
7. Tests und CI.

---

## 2. Arbeitsprinzipien

- Jede fachliche oder technische Änderung läuft über ein Issue.
- Jede Codeänderung läuft über einen Pull Request.
- Große Änderungen werden in kleine, reviewbare PRs zerlegt.
- Codex-Aufträge müssen `docs/CODEX_MASTERPROMPT.md` referenzieren.
- Task-spezifische Vorgaben sollen aus `docs/CODEX_TASK_CATALOG.md` abgeleitet werden.
- Keine privaten Portfolio-Exports, Secrets oder `.env`-Dateien ins Repo committen.
- Keine stillschweigenden Breaking Changes an API-Responses.
- Keine neue Designwelt und keine neuen Theme-Tokens ohne explizite Begründung oder ADR.

---

## 3. Phasenplan

### P1 — GitHub- und Governance-Grundlage

Ziel: Das Repo bekommt ein stabiles Arbeitsraster für Issues, PRs, Codex-Aufträge und Review.

Status:

- [x] P1-A Parent-Roadmap-Issue angelegt
- [x] P1-B Issue Forms und PR Template angelegt
- [x] P1-C Roadmap-/Governance-Dokumentation angelegt

Deliverables:

- `docs/CODEX_MASTERPROMPT.md`
- `docs/CODEX_TASK_CATALOG.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/ROADMAP.md`
- Parent-Issue `#1`

### P2 — Dokumentation als Single Source of Truth

Ziel: README und docs/* beschreiben den tatsächlichen Produkt-, Architektur- und Datenstand.

Geplante Deliverables:

- `README.md` ersetzt create-next-app-Standardtext.
- `docs/PROJECT_STATUS.md` beschreibt aktuellen Stand und offene Punkte.
- `docs/ARCHITECTURE.md` beschreibt App Router, Route Handler, Hooks, Komponenten und Datenfluss.
- `docs/DATA_MODEL.md` beschreibt Activities, normalized Activities, Overrides, Assets, Warnings und Metadata.
- `docs/UI_REFERENCE_PARQET.md` beschreibt Parqet-Referenzen und UI-Leitplanken.
- `docs/adr/0000-template.md` legt ADR-Format fest.

### P3 — Kanonische Datenpipeline

Ziel: Assets-, Dashboard-, Activities-Audit- und spätere Audit-Views nutzen eine gemeinsame Pipeline.

Kanonische Pipeline:

```text
fetchActivities
→ filterRealSecurityActivities
→ normalizeActivities
→ applyOverrides
→ buildReconciliationWarnings
→ buildCorrectedAssets / projections
→ enrichMetadata
→ buildConsistencyReport
```

Geplante Deliverables:

- Shared Service, z. B. `src/lib/parqet-assets/build-activity-context.ts`.
- Route Handler verwenden Projektionen aus diesem Context.
- Pipeline-ADR dokumentiert Entscheidung und Konsequenzen.

### P4 — Performance und Pagination

Ziel: Kein unnötiges sequentielles Laden großer Activity-Mengen; weniger blockierende UI.

Geplante Deliverables:

- Bounded Concurrency für Portfolio-Activity-Fetching.
- Serverseitige Pagination und Filter für Activities-Audit.
- Dashboard-Cache inklusive Reconciliation-Warnings und Stale-State.
- Loading-/Skeleton-/Transition-States für teure Aktualisierungen.

### P5 — Fachlogik und Data Quality

Ziel: Reconciliation-Warnings, Overrides, Namensauflösung und geschlossene Positionen werden fachlich belastbar.

Geplante Deliverables:

- Override-Workflow als Review-Fälle.
- Einheitlicher Asset-Display-Resolver.
- Aktive und geschlossene Positionen klar getrennt.
- Entscheidung zum CTA „Neue Aktivität“ umgesetzt: kein irreführender Create-CTA ohne Schreibpfad.

### P6 — UI-Parität und UX-Konsistenz

Ziel: UI bleibt modular, tokenbasiert und orientiert sich an Parqet-Referenzen.

Geplante Deliverables:

- P6-A: UI-Paritäts-Audit mit Ist/Soll/Gap/Risiko/Nächster-Schritt-Mapping.
- P6-B: Konsistenzarbeit für States, Warning-Semantik, Filter-Patterns und Spacing (ohne neue Token-Welt).
- P6-C: UI-Guidelines-ADR mit verbindlichen Guardrails für Tokens, Dark/Light, Navigation und Audit-Interaktionen.
- Keine neue Token-/Designlandschaft.

### P7 — Tests, QA und CI

Ziel: Änderungen werden durch Lint, Build und Tests abgesichert.

Geplante Deliverables:

- Vitest-Setup und Unit-Tests für Pipeline-Kernlogik.
- Playwright-Smoke-Tests für Dashboard/Activities.
- GitHub Actions Workflow für Lint, Build und Tests.
- Branch-Protection-Regeln dokumentiert und, soweit möglich, aktiviert.

---

## 4. Empfohlenes GitHub Project Board

Ein GitHub Project Board ist optional, aber für die Phasenarbeit sinnvoll.

Empfohlene Felder:

| Feld | Typ | Werte / Zweck |
| --- | --- | --- |
| Status | Single select | Backlog, Ready, In progress, Review, Blocked, Done |
| Area | Single select | docs, architecture, backend, frontend, performance, audit, qa, ci, ux |
| Priority | Single select | High, Medium, Low |
| Effort | Single select | S, M, L |
| Risk | Single select | Low, Medium, High |
| Target Phase | Single select | P1, P2, P3, P4, P5, P6, P7 |
| Issue type | Single select | feature, bug, tech-debt, docs, adr |
| Owner | Person | Verantwortliche Person |

Empfohlene Automationen:

- Neue Issues automatisch ins Board aufnehmen.
- Neue PRs automatisch ins Board aufnehmen.
- Issue/PR geschlossen → Status `Done`.
- PR geöffnet → Status `Review` oder `In progress`.
- Label `blocked` → Status `Blocked`.

---

## 5. Labels

Empfohlene Labels:

| Label | Zweck |
| --- | --- |
| `planning` | Roadmap, Parent-Issues, Strukturarbeit |
| `meta` | Repo-Governance, Templates, Organisation |
| `docs` | README, docs/*, ADRs |
| `architecture` | Architektur und Pipeline-Entscheidungen |
| `adr` | Architecture Decision Records |
| `backend` | Route Handler, Serverlogik, API-Integration |
| `api` | Öffentliche oder interne API-Kontrakte |
| `frontend` | React-Komponenten, Hooks, UI-Logik |
| `ux` | Nutzerführung, Layout, Interaktionen |
| `design` | Parqet-Parität, Tokens, Visual Design |
| `performance` | Caching, Pagination, Concurrency |
| `feature` | Neue oder ausgebaute Produktfunktion |
| `bug` | Fehler oder Regression |
| `tech-debt` | technische Schulden |
| `refactor` | begrenztes Refactoring ohne Produktänderung |
| `audit` | Override-, Reconciliation- und Review-Flows |
| `data-quality` | Namensauflösung, ISIN, Positionen, Konsistenz |
| `qa` | Tests, Qualitätssicherung |
| `testing` | Unit-/Integrationstests |
| `e2e` | Playwright oder End-to-End-Tests |
| `ci` | GitHub Actions und Merge-Gates |
| `blocked` | blockiert durch offene Entscheidung oder Abhängigkeit |

---

## 6. Branch-Strategie

Standard:

```text
main
└── <type>/<short-description>
```

Beispiele:

```text
docs/readme-product-state
chore/github-templates
refactor/build-activity-context
perf/activities-bounded-concurrency
feat/override-review-workflow
qa/vitest-pipeline-tests
```

Regeln:

- `main` bleibt stabil.
- Keine direkten Feature-Commits auf `main`, sobald Branch Protection aktiv ist.
- Branches sind klein und issuebezogen.
- PRs referenzieren Issues mit `Fixes #...` nur, wenn das Issue vollständig erledigt wird.
- Für Teilfortschritt `Refs #...` verwenden.

---

## 7. Branch Protection Plan

Empfohlene Regeln für `main`:

- Pull Request vor Merge erforderlich.
- Mindestens eine Review erforderlich, sobald mehrere Mitwirkende beteiligt sind.
- Status Checks müssen grün sein:
  - `npm run lint`
  - `npm run build`
  - `npm run test -- --run`, sobald test-Script existiert
- Branch muss aktuell sein, bevor gemerged wird.
- Direktes Pushen auf `main` deaktivieren, sobald CI stabil ist.
- Force Push auf `main` deaktivieren.
- Löschen von `main` deaktivieren.

Hinweis: Solange noch kein CI und kein `test`-Script existieren, Branch Protection nicht zu streng aktivieren. Erst P7-C finalisiert Merge-Gates.

---

## 8. Pull-Request-Regeln

Jeder PR muss enthalten:

- Ziel / verknüpftes Issue,
- Summary der Änderung,
- betroffene Dateien,
- Testplan,
- Risiken,
- Rollback-Hinweis,
- Aussage, ob `docs/CODEX_MASTERPROMPT.md` beachtet wurde.

PRs sollen klein bleiben:

- Doku-PRs nicht mit Pipeline-Refactorings vermischen.
- UI-PRs nicht mit API-Vertragsänderungen vermischen.
- Test-Infrastruktur nicht mit fachlicher Logik vermischen, sofern vermeidbar.

---

## 9. Codex-Arbeitsweise

Codex soll nicht frei interpretieren, sondern über abgeleitete Prompts arbeiten.

Minimaler Auftrag:

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
- <path>

modify_files:
- <path>

acceptance_criteria:
- <criterion>

non_goals:
- <out of scope>

verification_commands:
- npm run lint
- npm run build
- npm run test -- --run

risks_to_watch:
- <risk>
```

Codex muss am Ende ausgeben:

- Analyse,
- Plan,
- Umsetzung,
- Verifikation,
- Ergebnisartefakte,
- Risiken / offene Punkte,
- Changed files,
- Tests,
- Rollback.

---

## 10. Definition of Done pro Phase

Eine Phase gilt als erledigt, wenn:

- alle relevanten Issues geschlossen oder bewusst verschoben wurden,
- die Dokumentation den neuen Stand abbildet,
- alle Code-PRs gemerged und verifiziert sind,
- offene Annahmen in Issues oder ADRs dokumentiert sind,
- keine Folgephase auf undokumentierten Zwischenständen aufsetzt.

---

## 11. Offene Governance-Annahmen

Diese Punkte müssen in späteren Issues entschieden werden:

- Soll GitHub Projects aktiv genutzt werden oder reicht Issue-Tracking?
- Ab wann wird Branch Protection technisch aktiviert?
- Welche CI-Checks werden required?
- Wird `npm run test` mit Vitest Pflicht vor Merge?
- Gibt es später echte Releases oder nur laufende Main-Deployments über Vercel?
- Soll Auto-Merge aktiviert werden, sobald CI stabil ist?
