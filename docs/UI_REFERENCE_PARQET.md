# UI Reference — Parqet App

Status: draft
Owner: AdrianR98
Last reviewed: 2026-05-04

Dieses Dokument ist das UI-Paritäts-Audit (P6-A) zwischen dem aktuellen App-Stand und den vorhandenen Parqet-Referenzen.

Wichtig: Die Parqet-Referenz ist UX-Orientierung (Informationsarchitektur, Interaktionsmuster, visuelle Dichte), **keine 1:1-Kopierpflicht**.

---

## 1. Audit-Rahmen und Methode

- Scope: Dashboard- und Activities-Erlebnis getrennt bewerten.
- Vergleichsachsen je Bereich:
  - **Ist (App heute)**
  - **Soll (Parqet-Referenzmuster)**
  - **Gap**
  - **Risiko**
  - **Empfohlener nächster Schritt**
- Priorisierung nach **Impact** (Nutzer-/Produktwirkung) und **Aufwand** (Umsetzungsgröße).
- Guardrails:
  - Bestehende globale Theme-Tokens bleiben Grundlage.
  - Keine neuen Theme-Tokens ohne ADR.
  - Dark/Light-Kompatibilität muss erhalten bleiben.
  - Keine großen UI-Refactorings in P6-A.

---

## 2. Gesamtbild (Kurzfazit)

- Die App hat bereits eine solide modulare Struktur für Dashboard und Activities.
- Parqet-nahe Muster sind erkennbar (Hero, KPI-Flächen, kompakte Tabellen/Listen, Filter, Warnhinweise).
- Größte Lücken liegen nicht in „fehlender Oberfläche“, sondern in **Konsistenz und Interaktionsschärfung**:
  - Header/Navigation-Rahmen ist uneinheitlich.
  - Loading/Empty/Error-Muster sind nicht durchgehend harmonisiert.
  - Activities und Dashboard nutzen ähnliche Patterns, aber unterschiedliche Detaillogik.
  - Warning-/Audit-Panels sind funktional, jedoch in Dichte/Terminologie teils inkonsistent.

---

## 3. Bereichs-Audit (Ist / Soll / Gap / Risiko / Nächster Schritt)

### 3.1 Dashboard (Orchestrierung, Hero, KPI, Sektionen)

| Dimension | Audit |
| --- | --- |
| Ist (App) | Dashboard orchestriert Hero, Stats, offene/geschlossene Assets sowie Warnings/Audit-Panel; Struktur ist klar getrennt und komponentisiert. |
| Soll (Referenz) | Parqet-nahes „scan-first“-Dashboard mit klarer Hierarchie: Auswahl → Status → KPIs → Tabellen → Audit-/Warnkontext. |
| Gap | Hierarchie vorhanden, aber teils konkurrierende Statusflächen (Banners vs. Hero-Meta) und nicht vollständig standardisierte Section-Rhythmen. |
| Risiko | Mittel: Informationsdichte bleibt hoch, aber prioritäre Signale (stale/auth/error) können in Detailflächen untergehen. |
| Empfohlener nächster Schritt | P6-B: einheitliches Status-Pattern definieren (Hero-Statuszeile + standardisierte Banner-Regel pro Fehlerklasse), ohne Datenlogikänderung. |

### 3.2 Activities (Audit-Flow, Gruppierung, Overrides)

| Dimension | Audit |
| --- | --- |
| Ist (App) | Activities hat Hero, KPI-/Meta-Linie, Filter, Suche, Jahr/Monat-Gruppierung, Warnungen pro Activity und Inline-Overrides. |
| Soll (Referenz) | Parqet-nahe Aktivitätsliste mit kompakter Lesbarkeit; zusätzlich auditierbare Korrekturführung klar vom Rohdatencharakter getrennt. |
| Gap | Gute Basis, aber Override-Interaktionen und Warning-Semantik sind visuell/terminologisch nicht vollständig mit Dashboard-Audit abgestimmt. |
| Risiko | Mittel bis hoch: Uneinheitliche Begriffe („Transfer ein/aus“, Review-Fall-Status) erhöhen kognitive Last bei Korrekturentscheidungen. |
| Empfohlener nächster Schritt | P6-B: gemeinsames UI-Wording-Set für Typen/Status/Warning-Schweregrad; P6-C: ADR-Regeln für Audit-Interaktionen. |

### 3.3 Portfolio-Auswahl (Dashboard + Activities)

| Dimension | Audit |
| --- | --- |
| Ist (App) | Dropdown-basierte Mehrfachauswahl mit Apply/Reset vorhanden (Dashboard); Activities nutzt Portfolio-Filter ebenfalls kompakt. |
| Soll (Referenz) | Kompakter, verlässlicher Multi-Select mit klaren Zuständen (offen/geschlossen, aktive Auswahl, Apply/Reset-Rückmeldung). |
| Gap | Kernfunktion da; fehlend sind einheitliche Rückmeldungen/Badges und konsistente Trigger-Beschriftung zwischen Seiten. |
| Risiko | Mittel: Bei vielen Portfolios sinkt Transparenz über aktive Filter. |
| Empfohlener nächster Schritt | P6-B: Shared Pattern für Filter-Triggertext, Auswahlzähler, Apply/Reset-Feedback in beiden Seiten. |

### 3.4 Asset-Tabelle (offen/geschlossen, Dichte, Identität)

| Dimension | Audit |
| --- | --- |
| Ist (App) | Offene/geschlossene Bereiche getrennt; Tabellenlayout kompakt, Sticky Header, Row-Hover, Asset-Identity mit Name + Meta + Logo/Fallback. |
| Soll (Referenz) | Hohe Scannability, stabile Asset-Identität, optionale Komplexität (Sortierung/Spaltensteuerung) ohne visuelle Überfrachtung. |
| Gap | Grundmuster stimmt; fortgeschrittene Interaktion (Sortierklarheit, Spaltensteuerung) ist nur teilweise ausgeprägt/noch Zielbild. |
| Risiko | Niedrig bis mittel: Funktional nutzbar, aber bei wachsenden Datenmengen sinkt Vergleichbarkeit über Spalten hinweg. |
| Empfohlener nächster Schritt | P6-B: bestehende Tabellen-Controls konsolidieren (Toolbar-Pattern, visuelle Sortierzustände), keine neue Datenpipeline. |

### 3.5 Audit-/Warning-Panels (DataWarnings + AssetAudit)

| Dimension | Audit |
| --- | --- |
| Ist (App) | Separate Overlay-Panels, Severity-Badges, detaillierte Warning-Texte, Reconnect-Flow und Override-Bearbeitung vorhanden. |
| Soll (Referenz) | Kompakt startende Warnkontexte, klare Eskalationsstufen, konsistente Statusbegriffe, nachvollziehbare Review-Historie. |
| Gap | Panels sind reichhaltig, aber teils zu „gleichgewichtig“ (jede Warnung ähnlich dominant) und sprachlich nicht durchgehend vereinheitlicht. |
| Risiko | Hoch: Audit-Entscheidungen können inkonsistent getroffen werden, wenn Schweregrad/Status nicht sofort gleich interpretiert wird. |
| Empfohlener nächster Schritt | P6-B: visuelle Schweregrad-Hierarchie und Statuschips harmonisieren; P6-C: ADR mit verbindlichen Warning-/Review-Konventionen. |

### 3.6 Header / Navigation

| Dimension | Audit |
| --- | --- |
| Ist (App) | HeaderBar-Komponente mit Branding, Suche, User-Block existiert, aber App-Rahmen ist nicht vollständig als konsistentes Navigationssystem etabliert. |
| Soll (Referenz) | Stabile, wiedererkennbare Primärnavigation (Dashboard/Activities) mit klar aktivem Zustand und konsistentem Rahmen über Seiten hinweg. |
| Gap | Navigationsgefühl ist nur teilweise standardisiert; mögliche Doppelung zwischen seitenlokalen Controls und globalem Header. |
| Risiko | Mittel bis hoch: Orientierung leidet bei Wechsel zwischen Dashboard und Activities. |
| Empfohlener nächster Schritt | P6-B: Navigation-Frame-Backlog konkretisieren (ohne großen Umbau in P6-A); P6-C: ADR für Navigationsprinzipien. |

### 3.7 Theme / Spacing / Token-Disziplin

| Dimension | Audit |
| --- | --- |
| Ist (App) | Globale CSS-Tokens werden breit verwendet; viele Komponenten nutzen dieselben Surface-/Control-Muster und Abstände. |
| Soll (Referenz) | Tokenbasierte Konsistenz, kein Token-Drift, Dark/Light robust, keine ad-hoc-Farbcodes ohne Bedarf. |
| Gap | Gute Basis; Restlücken liegen in vereinzelten semantischen Abweichungen (z. B. unterschiedliche Betonung vergleichbarer States). |
| Risiko | Mittel: Ohne Regelwerk wächst langfristig inkonsistente Mikro-Optik. |
| Empfohlener nächster Schritt | P6-C: UI-Guidelines-ADR als Guardrail, inkl. Token-Nutzung und Abweichungsprozess. |

### 3.8 Loading / Empty / Error / Auth-Reconnect States

| Dimension | Audit |
| --- | --- |
| Ist (App) | States sind vorhanden (Banners, leere Listenhinweise, Reconnect-Buttons), aber zwischen Dashboard/Activities/Panels unterschiedlich umgesetzt. |
| Soll (Referenz) | Vorhersehbares, einheitliches Feedback-System: loading (stabil), empty (neutral), error (handlungsfähig), auth (klarer reconnect). |
| Gap | Konsistenzlücke in Tonalität, Platzierung und Priorisierung von States. |
| Risiko | Hoch: Nutzer können „kein Ergebnis“ vs. „Fehler“ vs. „abgelaufene Verbindung“ nicht immer sofort unterscheiden. |
| Empfohlener nächster Schritt | P6-B: einheitliche State-Matrix und UI-Bausteinregeln; keine neuen Komponenten nur für Optik, sondern Pattern-Alignment. |

---

## 4. Priorisierte UI-Gaps (Impact × Aufwand)

| Prio | Thema | Impact | Aufwand | Begründung |
| --- | --- | --- | --- | --- |
| 1 | Einheitliche State-Matrix (Loading/Empty/Error/Auth/Stale) | Hoch | Mittel | Direkt relevant für Verständlichkeit und Fehlbedienungsrisiko auf beiden Kernseiten. |
| 2 | Warning-/Review-Semantik harmonisieren (Dashboard + Activities + Panels) | Hoch | Mittel | Audit- und Datenqualitätsentscheidungen brauchen konsistente Schweregrade/Statussprache. |
| 3 | Portfolio-Filterpattern vereinheitlichen | Mittel | Niedrig-Mittel | Hoher Nutzwert bei Multi-Portfolio-Workflows, relativ kleiner UI-Eingriff. |
| 4 | Navigation-/Header-Rahmen schärfen | Mittel-Hoch | Mittel-Hoch | Wichtiger Orientierungsfaktor, aber bewusst als separater Umbau nach Audit behandeln. |
| 5 | Tabellen-Interaktionsklarheit (Sort/Columns) | Mittel | Mittel | Für große Datenbestände relevant, aber nicht blockierend für aktuelle Nutzbarkeit. |
| 6 | Token-/Spacing-Guidelines verbindlich dokumentieren | Mittel (langfristig hoch) | Niedrig | Präventiver Hebel gegen Drift, ideal als ADR absichern. |

---

## 5. Abgeleitete Folgeaufgaben

### P6-B — Theme Tokens und Skeletons (konkretisiert)

1. **State-Matrix implementierungsnah dokumentieren und angleichen**
   - einheitliche Regeln für Loading/Empty/Error/Auth/Stale in Dashboard, Activities, Audit-Panels.
2. **Warning-/Severity- und Review-Statusdarstellung angleichen**
   - gleiche visuelle Priorisierung und Terminologie in allen relevanten Bereichen.
3. **Portfolio-Filter UX harmonisieren**
   - Triggertext, Count-Badge, Apply/Reset-Feedback zwischen Dashboard und Activities synchronisieren.
4. **Tabellen-/Listenrhythmus feinjustieren**
   - Spacing und Headline-/Meta-Verhältnis vereinheitlichen, ohne neue Token einzuführen.

### P6-C — UI-Guidelines ADR (konkretisiert)

1. **ADR „UI-Referenz und Token-Guardrails“ erweitern/abschließen**
   - Abweichungsregeln zur Parqet-Referenz,
   - verbindliche Token- und State-Konventionen,
   - Dark/Light-Anforderungen.
2. **Audit-Interaktionsprinzipien festschreiben**
   - Begriffe/Statusmodell für Warnings und Overrides,
   - Mindestanforderungen an Nachvollziehbarkeit (Original vs. Override sichtbar).
3. **Navigationsprinzip dokumentieren**
   - globaler Rahmen vs. seitenlokale Controls,
   - aktive Zustände und Prioritätsregeln.

---

## 6. Guardrails für nachfolgende UI-PRs

- Keine großen Layout-Umbauten im Rahmen von P6-A-Dokumentationsnachläufen.
- Keine neuen Theme-Tokens ohne ADR-Entscheidung.
- Dark-/Light-Verhalten bei jeder UI-Anpassung mitprüfen.
- Dashboard und Activities weiterhin getrennt evaluieren, dann gezielt harmonisieren.
- Parqet als UX-Referenz verwenden, nicht als technische Kopiervorlage.

---

## 7. Audit-Fazit

Die App ist funktional bereits nah an einem robusten Parqet-inspirierten Arbeitsstil. Der höchste Mehrwert für die nächsten Schritte liegt in **Konsistenz- und Klarheitsarbeit** (State-System, Warning-/Review-Semantik, Filterverhalten, Navigationsrahmen) statt in großem Redesign. Damit sind P6-B und P6-C klar vorbereitet.


## 8. Umsetzungsstand P6-B (2026-05-04)

- State-/Filter-Wording zwischen Dashboard und Activities wurde angenähert (`Zurücksetzen`, Portfolio-Trigger mit Zähler).
- Aktivitätstypen `transfer_in`/`transfer_out` werden jetzt als `Einbuchung`/`Ausbuchung` angezeigt, analog zu den UI-Guardrails.
- Warning-/Review-Labels wurden in Panels harmonisiert (`Kritisch`, `Prüfen`, `Info`; Review-Status als `Offen`/`Bestätigt`/`Korrigiert`).
- Tabellenrhythmus wurde nur inkrementell nachgezogen (Zellen-Padding/Meta-Line), ohne neue Tokens einzuführen.
