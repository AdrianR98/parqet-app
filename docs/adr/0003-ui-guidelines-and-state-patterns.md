# ADR 0003 — UI Guidelines and State Patterns

Status: accepted  
Date: 2026-05-04  
Owners: AdrianR98

## Kontext

Mit P6-A (UI-Paritäts-Audit) und P6-B (Theme-/Pattern-Konsolidierung) wurden zentrale UX-Muster für Dashboard und Activities bereits identifiziert und vereinheitlicht. Bisher fehlte jedoch ein verbindlicher Architekturanker, der diese Regeln für zukünftige UI-PRs eindeutig festlegt.

Ohne einen solchen ADR-Rahmen entstehen typischerweise:

- inkonsistente State-Darstellungen zwischen Dashboard und Activities,
- schleichende Token-Drifts (ad-hoc Farben/Abstände statt zentraler Tokens),
- missverständliche Audit-/Override-Interaktionen,
- divergierende Filter- und Navigationsmuster.

Gleichzeitig gilt: Die App orientiert sich an Parqet als UX-Referenz (Informationsdichte, Scanbarkeit, Statusklarheit), aber sie ist **keine 1:1-Kopie** von Parqet-HTML, -Komponenten oder -Implementierungsdetails.

## Entscheidung

Für alle zukünftigen UI-PRs gelten die folgenden Guardrails als verbindlich.

### 1) Parqet als Orientierung, nicht als Kopie

- Parqet bleibt UX-Leitbild für IA, visuelle Dichte und Interaktionsrhythmen.
- Implementierungen in dieser App bleiben eigenständig und auf bestehende Architektur zugeschnitten.
- Kein „Pixel-Matching“ als Zielkriterium; entscheidend sind Verständlichkeit, Konsistenz und auditierbare Zustände.

### 2) Theme-Token-Guardrails (verbindlich)

- Die bestehenden globalen Tokens in `src/app/globals.css` sind die primäre Designbasis.
- Neue Farben, Radien, Schatten, Spacing- oder Zustandswerte dürfen nicht ad hoc in Komponenten eingeführt werden.
- Neue Theme-Tokens sind nur mit separater Begründung/ADR zulässig.
- Komponenten-Styles müssen auf vorhandene Token/Utility-Klassen aufsetzen.

### 3) Dark-/Light-Kompatibilität

- Jede UI-Änderung muss explizit für Dark und Light lesbar und nutzbar bleiben.
- Kontrastkritische Elemente (Text, Badges, Tabellenzeilen, Focus-Ringe, Banner) dürfen keine mode-spezifischen Informationsverluste erzeugen.
- State-Signale (z. B. Error/Warning/Info) müssen in beiden Modi eindeutig unterscheidbar sein.

### 4) Verbindliche State-Matrix

Jede relevante View (mindestens Dashboard, Activities, zugehörige Panels) folgt dieser Matrix:

- **Loading**: sichtbarer Ladezustand (Skeleton oder klarer Loading-State), kein irreführender „fertig“-Eindruck.
- **Empty**: erklärter Leerzustand mit kontextbezogener Hilfestellung (z. B. Filter zurücksetzen, Portfolios wählen).
- **Error**: klarer Fehlerzustand inkl. nächstem sinnvollen Schritt (Retry/Reconnect/Details).
- **Auth/Reconnect**: bei Auth-Problemen priorisierte Reconnect-Führung statt stiller Degradierung.
- **Stale**: sichtbarer Hinweis bei veralteten Daten; stale ist informiert nutzbar, aber klar markiert.

### 5) Warning-/Review-Semantik

Warn- und Review-Fälle verwenden konsistente, domänennahe Semantik:

- Schweregrade: **Kritisch**, **Prüfen**, **Info**.
- Review-Status: **Offen**, **Bestätigt**, **Korrigiert**, **Zurückgestellt**.

Regeln:

- Schweregrad beschreibt fachliche/technische Dringlichkeit.
- Review-Status beschreibt Bearbeitungsstand.
- Beide Dimensionen dürfen nicht vermischt werden.

### 6) Portfolio-Filter-Pattern

Portfolio-Filter in Dashboard und Activities folgen einem gemeinsamen Pattern:

- Trigger zeigt Auswahlstatus inklusive **Count**.
- Änderungen werden erst mit **Apply** wirksam.
- **Zurücksetzen** (Reset) stellt einen klaren Ausgangszustand wieder her.
- Beschriftungen und Feedback bleiben in beiden Views konsistent.

### 7) Audit-/Override-Prinzip

Für auditierbare Datenkorrekturen gilt:

- **Originalwert und Override müssen gleichzeitig sichtbar bleiben**.
- Korrigierte Darstellung darf nicht als „Rohdaten von Parqet“ missverstanden werden.
- Override-Hinweise bleiben nachvollziehbar und von Rohdaten semantisch getrennt.
- Keine visuelle oder textliche Vermischung von Quelle (Parqet) und Korrektur (lokale Audit-Intervention).

### 8) Navigationsprinzipien als Zielbild (ohne Umbaupflicht in diesem Task)

Navigationsziele für künftige UI-Arbeit:

- konsistenter Seitenrahmen (Header/Meta/Actions),
- eindeutige Primärnavigation zwischen Kernbereichen,
- klare Rückkehrpfade aus Panels/Overlays,
- einheitliche Benennung für identische Aktionen.

Dieser ADR dokumentiert das Zielbild; **kein** unmittelbarer Sidebar-/Navigationsumbau wird dadurch ausgelöst.

### 9) UI-PR-Checkliste (konkret)

Jede UI-PR soll diese Punkte aktiv abhaken:

1. Orientierung an Parqet-Mustern ist begründet (nicht 1:1 kopiert).
2. Keine neuen Tokens eingeführt; vorhandene Token wiederverwendet.
3. Dark/Light manuell geprüft (Lesbarkeit, Kontrast, Statussignale).
4. State-Matrix berücksichtigt: Loading / Empty / Error / Auth-Reconnect / Stale.
5. Warning-Semantik nutzt Kritisch/Prüfen/Info.
6. Review-Semantik nutzt Offen/Bestätigt/Korrigiert/Zurückgestellt.
7. Portfolio-Filter nutzt Count + Apply + Zurücksetzen.
8. Audit-/Override-Ansicht zeigt Original + Override klar getrennt.
9. Navigationswirkung bewertet (auch wenn kein Nav-Umbau erfolgt).
10. Keine API-/Datenlogik-/Override-/Pagination-Änderung als Seiteneffekt.

## Alternativen

### A) Keine ADR, nur implizite Team-Absprachen

- Vorteil: Kein zusätzlicher Doku-Aufwand.
- Nachteil: Regeln bleiben uneinheitlich, Review-Kriterien werden subjektiv.
- Ergebnis: Verworfen, da zu hohes Konsistenzrisiko.

### B) Strikte 1:1-Parqet-Replikation

- Vorteil: Visuelle Nähe kurzfristig maximal.
- Nachteil: Architektur-, Wartungs- und Produkt-Fit leiden; erhöht Copy-Risiko.
- Ergebnis: Verworfen, da Ziel explizit Orientierung statt Kopie ist.

### C) Neue umfassende Design-System-Einführung

- Vorteil: theoretisch saubere Konsolidierung.
- Nachteil: großer Scope, außerhalb P6-C, kollidiert mit „keine neuen Tokens/kein UI-Refactor“.
- Ergebnis: Verworfen für diesen Schritt.

## Konsequenzen

### Positiv

- UI-Reviews erhalten objektivere, wiederholbare Kriterien.
- Token- und Pattern-Drift wird früh begrenzt.
- Audit-/Override-Darstellungen bleiben verständlich und vertrauenswürdig.
- Dashboard und Activities konvergieren stärker in State- und Filterlogik.

### Trade-offs

- Kleinere UI-Änderungen benötigen explizitere Begründung gegen die Checkliste.
- Kurzfristig etwas höherer Review-Aufwand.

### Out of Scope (unverändert durch diese ADR)

- Kein UI-Refactor.
- Keine neue Sidebar-/Navigation-Implementierung.
- Keine CSS-/Komponentenumbauten.
- Keine neuen Theme-Tokens.
- Keine API-, Datenlogik-, Override- oder Pagination-Änderungen.
- Keine Einführung neuer Tests (dies folgt in P7-A).

## Verweise

- Refs #23
- `docs/UI_REFERENCE_PARQET.md`
- `src/app/globals.css`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
