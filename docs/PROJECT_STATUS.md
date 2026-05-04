# Project Status — Parqet App

Status: draft
Owner: AdrianR98
Last reviewed: 2026-05-04

Dieses Dokument beschreibt den aktuellen Projektstand der Parqet-App. Es ist bewusst nüchtern gehalten: Implementierte Funktionen, bekannte Einschränkungen und nächste Schritte werden getrennt.

---

## 1. Kurzbeschreibung

Die Parqet-App ist eine Next.js-App zur Auswertung von Parqet-Portfolios. Sie nutzt Parqet Connect, lädt autorisierte Portfolios und Aktivitäten, normalisiert Wertpapierbewegungen und erzeugt daraus Dashboard-, Asset- und Activities-Audit-Ansichten.

Der aktuelle Fokus liegt auf Stabilisierung, Dokumentation, Pipeline-Konsolidierung, Performance und Qualitätssicherung.

---

## 2. Aktueller Repo-Stand

### Erledigt

- Next.js-App mit App Router vorhanden.
- Dashboard-Route vorhanden.
- Activities-Route vorhanden.
- Parqet OAuth Start- und Callback-Routen vorhanden.
- API-Routen für Portfolios, Assets, Activities-Audit und Asset-Audit sind im Projektkontext vorhanden.
- Dashboard lädt Portfolios und Assets über API-Routen.
- Assets werden in offene und geschlossene Positionen getrennt.
- Reconciliation-Warnungen und Consistency-Report existieren als fachliche Prüfschicht.
- Activities-Seite zeigt Audit-Items, Warnungen und Inline-Override-Bearbeitung.
- Lokale Asset-Metadaten-Anreicherung ist vorgesehen und teilweise umgesetzt.
- Dashboard-Cache existiert, ist aber noch nicht vollständig finalisiert.
- Codex-Masterprompt, Task-Katalog, Issue-Templates, PR-Template und Roadmap-Dokument sind angelegt.
- README wurde vom Next.js-Standardtext auf eine produktbezogene Projekt-README umgestellt.

### Teilweise umgesetzt / in Arbeit

- Gemeinsame Datenpipeline ist fachlich erkennbar, aber technisch noch nicht vollständig als Shared Service extrahiert.
- Assets-Route und Activities-Audit-Route enthalten noch potenziell duplizierte Pipeline-Logik.
- Performance-Hotspot beim vollständigen Laden von Activities je Portfolio ist bekannt.
- Activities-Audit filtert und gruppiert aktuell stark clientseitig.
- Test-Infrastruktur fehlt noch.
- CI/Merge-Gates sind noch nicht final eingerichtet.

### Noch nicht umgesetzt

- `npm run test` existiert noch nicht.
- Vitest ist noch nicht eingerichtet.
- Playwright ist noch nicht eingerichtet.
- Branch Protection ist noch nicht final dokumentiert/aktiviert.
- `build-activity-context` oder vergleichbarer Shared Pipeline Service existiert noch nicht.
- Serverseitige Pagination für Activities-Audit ist noch nicht umgesetzt.
- Bounded Concurrency für Portfolio-Activities ist noch nicht umgesetzt.
- CTA `Neue Aktivität` wurde entfernt; Activity-Erstellung ist weiterhin nicht implementiert und wird auf der Activities-Seite explizit abgegrenzt (Korrekturen via Overrides).

---

## 3. Aktuelle Phasenlage

### P1 — GitHub- und Governance-Grundlage

Status: abgeschlossen.

Deliverables:

- `docs/CODEX_MASTERPROMPT.md`
- `docs/CODEX_TASK_CATALOG.md`
- `docs/ROADMAP.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/PULL_REQUEST_TEMPLATE.md`
- Parent-Issue `#1`

### P2 — Dokumentation als Single Source of Truth

Status: in Arbeit.

Erledigt:

- README ersetzt.
- `docs/PROJECT_STATUS.md` angelegt.
- `docs/ARCHITECTURE.md` angelegt.
- `docs/DATA_MODEL.md` angelegt.

Ausstehend:

- `docs/UI_REFERENCE_PARQET.md`
- `docs/adr/0000-template.md`
- ggf. erste ADRs für Pipeline und UI-Regeln.

### P3 — Kanonische Datenpipeline

Status: geplant.

Nächster technischer Schwerpunkt:

- Gemeinsamen Activity Context Builder extrahieren.
- Route Handler auf Projektionen aus dem gemeinsamen Kontext umstellen.
- API-Kontrakte stabil halten.

### P4 — Performance und Pagination

Status: geplant.

Schwerpunkte:

- Bounded Concurrency beim Activity-Laden.
- Serverseitige Pagination und Filter in Activities-Audit.
- Dashboard-Cache vervollständigen.
- Loading- und Stale-Data-Zustände verbessern.

### P5 — Fachlogik und Data Quality

Status: geplant.

Schwerpunkte:

- Override-Workflow als Review-Fälle.
- Namensauflösung per ISIN stabilisieren.
- offene und geschlossene Positionen sauber trennen.
- CTA-Entscheidung umgesetzt: kein aktiver Create-Button ohne Schreibpfad; stattdessen klare Abgrenzung zu Overrides.

### P6 — UI-Parität und UX-Konsistenz

Status: geplant.

Schwerpunkte:

- UI-Referenz aus vorhandenen Parqet-Exports dokumentieren.
- Theme-Tokens konsequent nutzen.
- keine neue Designwelt einführen.

### P7 — Tests, QA und CI

Status: geplant.

Schwerpunkte:

- Vitest für Unit-Tests.
- Playwright für Smoke-/E2E-Tests.
- GitHub Actions Workflow.
- Branch Protection finalisieren.

---

## 4. Bekannte Risiken

| Risiko | Bedeutung | Geplanter Umgang |
| --- | --- | --- |
| Duplizierte Pipeline-Logik | Unterschiedliche Ergebnisse zwischen Dashboard und Audit möglich | P3 Shared Service |
| Vollständiges Activity-Laden | Langsame Aktualisierung bei mehreren Portfolios | P4 Bounded Concurrency und Pagination |
| Fehlende Tests | Refactorings können Regressionen verursachen | P7 Vitest/Playwright/CI |
| Unklare Parqet-API-Limits | Performance-Optimierung kann Rate-Limits treffen | konservative Concurrency, Messung, Dokumentation |
| Lokale Override-Datei | Risiko bei Encoding/BOM oder parallelem Schreiben | strikte UTF-8-Regeln, spätere Persistenzentscheidung |
| UI-Drift | Abweichung vom Parqet-ähnlichen Zielbild | P6 UI-Referenz und ADR |
| Hardcodierte Callback-Weiterleitung | Lokal/Deployment-Konflikt möglich | spätere Konfiguration über Env/Base URL |

---

## 5. Definition of Ready für neue Issues

Ein Issue ist bereit für Codex, wenn es enthält:

- klare Problem- oder Zielbeschreibung,
- betroffene Dateien oder Suchbereiche,
- Akzeptanzkriterien,
- Nicht-Ziele,
- erwartete Verifikation,
- Hinweis auf `docs/CODEX_MASTERPROMPT.md`,
- bei Architekturentscheidungen: ADR-Anforderung.

---

## 6. Definition of Done für PRs

Ein PR ist fertig, wenn:

- der Scope des Issues eingehalten wurde,
- README/docs aktualisiert wurden, falls relevant,
- `npm run lint` ausgeführt wurde,
- `npm run build` ausgeführt wurde,
- Tests ausgeführt oder fehlendes test-Script explizit dokumentiert wurden,
- Risiken und Rollback im PR beschrieben sind,
- keine privaten Daten oder Secrets enthalten sind.

---

## 7. Nächste empfohlene Schritte

1. `docs/UI_REFERENCE_PARQET.md` anlegen.
2. ADR-Ordner und ADR-Template anlegen.
3. Erstes technisches Issue für P3-A erstellen: Shared Activity Context Builder.
4. Danach Codex mit einem abgeleiteten Prompt aus `docs/CODEX_TASK_CATALOG.md` arbeiten lassen.
