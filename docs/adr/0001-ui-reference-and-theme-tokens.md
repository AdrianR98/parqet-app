# ADR 0001: UI-Referenz und Theme-Token-Regeln

Status: accepted
Date: 2026-05-04
Owner: AdrianR98

---

## Context

Die Parqet-App soll sich visuell und funktional an Parqet orientieren. Gleichzeitig darf die App keine fremden Implementierungsdetails, proprietären Assets oder kopierten Styles übernehmen.

Im Projektkontext liegen gespeicherte Parqet-HTML-Referenzen vor, unter anderem für Portfolioübersicht, Aktivitäten, Aktivität bearbeiten, Holding-Detailseite und Dividenden-/Historienseite. Diese Referenzen sind hilfreich für Informationsarchitektur, Layout-Rhythmus, Card-/Panel-Struktur, Filter, Dropdowns und Audit-Flows.

Aktuell existieren bereits globale Theme-Tokens und UI-Klassen. Neue UI-Arbeit soll diese Grundlage nutzen, statt eine zweite Designwelt einzuführen.

---

## Decision

Die Parqet-Referenzen werden als Produkt- und Layoutreferenz verwendet, nicht als Quelle für kopierten Code oder kopierte Styles.

Für UI-Änderungen gelten folgende Regeln:

1. Bestehende Theme-Tokens und globale UI-Patterns sind bevorzugt zu verwenden.
2. Neue Theme-Tokens dürfen nur eingeführt werden, wenn ein wiederverwendbarer Bedarf besteht.
3. Neue Tokens müssen für Dark und Light Mode definiert sein.
4. UI-Komponenten sollen modular bleiben und keine isolierten Sonderdesigns einführen.
5. Irreführende CTAs sind zu vermeiden; ein Button muss funktionieren, deaktiviert/markiert sein oder entfernt werden.
6. Loading, Empty, Error und Auth-Reconnect States sind bei datenladenden Ansichten mitzudenken.
7. Warnungen und Audit-Informationen dürfen nicht durch Styling versteckt werden.
8. Sichtbare UI-Änderungen sollen im PR beschrieben oder mit Screenshots dokumentiert werden.

Die detaillierten Leitplanken stehen in `docs/UI_REFERENCE_PARQET.md`.

---

## Options considered

### Option A: Parqet sehr eng kopieren

Pros:

- Hohe visuelle Nähe.
- Schnelleres subjektives Zielbild.

Cons:

- Risiko unzulässiger Übernahme fremder Implementierungsdetails.
- Technische Abhängigkeit von fremden Build-Artefakten.
- Keine saubere eigene Designbasis.

### Option B: Eigene UI ohne Parqet-Orientierung

Pros:

- Vollständig eigenständig.
- Weniger Risiko durch Referenzmaterial.

Cons:

- Verfehlt das gewünschte Parqet-nahe Nutzungserlebnis.
- Höheres Risiko für inkonsistente UI-Entscheidungen.

### Option C: Parqet als Referenz, eigene tokenbasierte Umsetzung

Pros:

- Parqet-nahe UX ohne Kopieren fremder Implementierung.
- Konsistente eigene Wartbarkeit.
- Dark-/Light-Mode bleibt steuerbar.
- UI-PRs haben klare Leitplanken.

Cons:

- Erfordert bewusstes Nachbauen von Patterns statt Copy-Paste.
- UI-Parität entsteht schrittweise, nicht sofort.

---

## Consequences

Positive:

- UI-Entscheidungen werden nachvollziehbarer.
- Spätere PRs können gegen klare Regeln geprüft werden.
- Token-Drift wird reduziert.
- Parqet-Referenzen bleiben nutzbar, ohne technische Abhängigkeit zu schaffen.

Negative / trade-offs:

- UI-Entwicklung ist etwas langsamer als Copy-Paste.
- Manche Parqet-Details werden bewusst nur angenähert.

Operational impact:

- UI-PRs müssen `docs/UI_REFERENCE_PARQET.md` beachten.
- Neue Tokens brauchen Begründung.

Testing impact:

- Spätere E2E-/Smoke-Tests sollten Dashboard und Activities abdecken.
- Visuelle Regressionstests sind optional, aber langfristig sinnvoll.

Documentation impact:

- UI-Änderungen können Updates in `docs/UI_REFERENCE_PARQET.md` erfordern.

---

## Rollback / revision plan

Diese ADR kann durch eine spätere ADR ersetzt werden, wenn ein dediziertes Designsystem oder eine andere Referenzstrategie beschlossen wird.

---

## Related issues / PRs

- Refs #1
