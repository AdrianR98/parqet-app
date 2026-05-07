# ADR 0003: Shared Activity Context als kanonische Parqet-Datenpipeline

Status: accepted
Date: 2026-05-04
Owner: AdrianR98

---

## Context

Die Parqet-App erzeugt mehrere fachliche Sichten aus denselben Parqet-Aktivitäten:

- Dashboard-/Asset-Sicht,
- Activities-Audit,
- Asset-Audit,
- Reconciliation-Warnings,
- Consistency-Prüfungen,
- spätere Data-Quality- und Override-Workflows.

Vor P3 war die frühe Pipeline in mehreren Route Handlern zumindest teilweise dupliziert. Dadurch bestand das Risiko, dass Dashboard, Activities-Audit und Asset-Audit unterschiedliche Zwischenschritte oder Warnungen verwenden.

Die fachlich korrekte Reihenfolge ist zentral für die App, weil Overrides und Reconciliation-Warnings nur dann konsistent sind, wenn alle Sichten dieselbe korrigierte Activity-Grundlage nutzen.

P3-A und P3-B haben deshalb `src/lib/parqet-assets/build-activity-context.ts` eingeführt und die relevanten Routen auf diesen Shared Context umgestellt.

---

## Decision

Die Parqet-App verwendet einen Shared Activity Context als kanonischen Einstiegspunkt für die frühe Parqet-Datenpipeline.

Die zentrale Funktion ist:

```text
src/lib/parqet-assets/build-activity-context.ts
```

Sie stellt aktuell bereit:

- `authorizedPortfolios`: alle autorisierten Parqet-Portfolios,
- `selectedPortfolios`: die per `portfolioId` ausgewählten Portfolios,
- `portfolioNameById`: Mapping von Portfolio-ID auf Portfolio-Name,
- `rawActivities`: geladene Rohaktivitäten,
- `filteredActivities`: echte Wertpapieraktivitäten,
- `normalizedActivities`: normalisierte interne Activities,
- `correctedActivities`: normalisierte Activities nach Anwendung lokaler Overrides,
- `reconciliationWarnings`: fachliche Warnungen auf Basis der korrigierten Activities.

Die kanonische Pipeline lautet:

```text
fetchAuthorizedPortfolios
→ loadActivitiesForPortfolios
→ isRealSecurityActivity
→ normalizeActivities
→ readActivityOverrides
→ applyOverrides
→ buildReconciliationWarnings
```

Route Handler sollen diese Pipeline nicht erneut lokal nachbauen. Sie sollen aus dem Shared Context nur noch ihre jeweilige Response-Projektion erzeugen.

Beispiele:

```text
buildActivityContext()
→ Assets-Projektion
→ Activities-Audit-Projektion
→ Asset-Audit-Projektion
```

---

## Current implementation

Umgesetzt durch:

- #2 / PR #5: Shared Builder eingeführt und Assets-Route minimal angebunden.
- #3 / PR #6: Activities-Audit und Asset-Audit auf den Shared Context umgestellt.

Wichtiger Kompatibilitätspunkt aus P3-B:

`activities-audit` gibt im Response-Feld `portfolios` weiterhin alle autorisierten Portfolios zurück. Dafür wurde `ActivityContext.authorizedPortfolios` ergänzt. `selectedPortfolios` bleibt separat erhalten, damit spätere Projektionen bewusst zwischen kompletter Portfolioliste und ausgewähltem Scope unterscheiden können.

---

## Options considered

### Option A: Pipeline in jedem Route Handler belassen

Pros:

- Keine neue Abstraktion.
- Route Handler bleiben lokal nachvollziehbar.

Cons:

- Hohe Duplikation.
- Risiko unterschiedlicher fachlicher Ergebnisse.
- Overrides und Warnings können je Route auseinanderlaufen.
- Tests müssten mehrere Varianten derselben Pipeline absichern.
- Performance-Optimierungen müssten mehrfach eingebaut werden.

### Option B: Shared Activity Context für frühe Pipeline, Projektionen je Route

Pros:

- Eine kanonische Pipeline.
- Konsistente Korrekturen und Warnings.
- Route Handler bleiben für Response-Projektionen zuständig.
- Bessere Grundlage für Tests.
- Bessere Grundlage für spätere Performance-Optimierung.
- Reduziert Duplikation ohne sofortigen Großumbau.

Cons:

- Neue Abstraktion muss sauber typisiert bleiben.
- Context darf nicht zu einem unkontrollierten God Object werden.
- Response-Kompatibilität muss bei jeder Route bewusst geprüft werden.

### Option C: Vollständiger Data View Builder für alle Projektionen sofort

Pros:

- Noch stärkere Zentralisierung.
- Route Handler würden sehr schlank.

Cons:

- Größerer Refactor mit höherem Regressionsrisiko.
- Vermischt P3 mit späteren P4/P5-Themen.
- Erschwert Review und Rollback.

---

## Consequences

Positive:

- Die frühe Parqet-Datenpipeline ist kanonisiert.
- Dashboard-/Assets-, Activities-Audit- und Asset-Audit-Routen können dieselbe korrigierte Activity-Grundlage nutzen.
- Reconciliation-Warnings werden konsistenter.
- Spätere Tests können gezielt am Shared Context und an Projektionen ansetzen.
- P4-Performance-Arbeit kann an einem zentraleren Punkt beginnen.

Negative / trade-offs:

- `buildActivityContext` lädt aktuell weiterhin alle Activities für den gewählten Scope.
- Der Context enthält mehrere Zwischenstände, was bewusst, aber wartungsbedürftig ist.
- Ohne Tests bleibt die Response-Kompatibilität weiterhin reviewpflichtig.

Operational impact:

- Neue Routen oder Projektionen sollen zuerst prüfen, ob `buildActivityContext` wiederverwendet werden kann.
- Route Handler sollen keine eigene Fetch/Filter/Normalize/Override/Reconciliation-Kette mehr aufbauen.
- Bei neuen Context-Feldern muss klar sein, ob sie vollständigen autorisierten Scope oder ausgewählten Portfolio-Scope abbilden.

Testing impact:

- Unit-Tests sollen später mindestens prüfen:
  - Normalisierung,
  - Override-Anwendung,
  - Reconciliation-Warnings,
  - Projektionen aus `correctedActivities`,
  - Portfolio-Scope-Unterscheidung zwischen `authorizedPortfolios` und `selectedPortfolios`.

Documentation impact:

- `docs/ARCHITECTURE.md` und `docs/DATA_MODEL.md` müssen bei strukturellen Änderungen am Context aktualisiert werden.

---

## Boundaries

Diese ADR entscheidet ausdrücklich nicht:

- bounded concurrency für Activity-Fetching,
- serverseitige Pagination für Activities-Audit,
- Cache-Strategie für Dashboard oder Activities,
- Umstellung der Override-Persistenz,
- Einführung von Vitest oder Playwright,
- UI-Änderungen.

Diese Themen bleiben Folgephasen:

- P4-A: Bounded Concurrency,
- P4-B: Serverseitige Pagination,
- P4-C: Cache und Loading States,
- P7-A/P7-B: Test-Infrastruktur.

---

## Rollback / revision plan

Kurzfristiger Rollback:

- PR #5 und PR #6 revertieren, um die Route-lokale Pipeline wiederherzustellen.

Mittelfristige Revision:

- Wenn `buildActivityContext` zu breit wird, können Projektionen in eigene Builder ausgelagert werden:

```text
buildActivityContext()
→ buildAssetsProjection(context)
→ buildActivitiesAuditProjection(context)
→ buildAssetAuditProjection(context)
```

Eine solche Aufteilung wäre eine spätere, kleinere Architekturentscheidung und muss die bestehenden Response-Verträge erneut prüfen.

---

## Related issues / PRs

- Refs #1
- Refs #2
- Refs #3
- Fixes #4
- PR #5
- PR #6
