# UI Reference — Parqet App

Status: draft
Owner: AdrianR98
Last reviewed: 2026-05-04

Dieses Dokument beschreibt die UI-/UX-Leitplanken für die Parqet-App. Es dient als Referenz für spätere UI-PRs und Codex-Aufträge.

Wichtig: Ziel ist eine Parqet-nahe Nutzerführung und visuelle Anmutung, nicht das Kopieren fremder Implementierung, Assets oder proprietärer Styles.

---

## 1. Zielbild

Die App soll sich wie ein fokussiertes Portfolio-Dashboard anfühlen:

- klare Navigation,
- kompakte Kennzahlen,
- ruhige Flächen,
- gut lesbare Tabellen und Listen,
- sichtbare Datenqualitätshinweise,
- nachvollziehbare Audit- und Override-Bedienung,
- Dark-/Light-Mode-kompatible Gestaltung.

Die App heißt im UI-Kontext `Asset View`.

---

## 2. Referenzmaterial

Als visuelle und strukturelle Referenz dienen lokal gespeicherte Parqet-Exports aus dem Projektkontext, insbesondere:

- Portfolioübersicht / Gesamtansicht,
- Aktivitätenübersicht,
- Aktivität-bearbeiten-Ansicht,
- Holding-Detailseite,
- Dividenden-/Historienseite.

Diese Referenzen dienen nur zur Produkt- und Layoutorientierung:

- Informationsarchitektur,
- Seitenrhythmus,
- Card-/Panel-Struktur,
- Tabellenverhalten,
- Filter- und Dropdown-Patterns,
- Sidebar-/Navigationsgefühl,
- Aktivitätsbearbeitung als Audit-Flow.

Nicht übernehmen:

- proprietären Quellcode,
- externe Tracking-/Script-Strukturen,
- geschützte Assets,
- exakte CSS-Klassen oder Build-Artefakte,
- fremde Marken-/Logo-Nutzung über das Notwendige hinaus.

---

## 3. Layout-Prinzipien

### App-Rahmen

Ziel:

```text
Sidebar / Navigation
→ Hauptinhalt
→ modulare Sections
→ optionale Panels / Drawers
```

Regeln:

- Navigation soll stabil und wiedererkennbar sein.
- Dashboard und Activities sollen denselben App-Rahmen verwenden.
- Hauptinhalt soll nicht in viele konkurrierende Layout-Systeme zerfallen.
- Seiten sollten mit klaren Header-/Hero-Bereichen starten.

### Flächen

Regeln:

- Wiederverwendbare Card-/Surface-Muster nutzen.
- Keine zufälligen Sonderstile je Komponente.
- Warnungen und Audit-Flächen visuell von normalen Datenflächen trennen.
- Dichte Tabellen benötigen klare Zeilenabstände und Hover-/Trennzustände.

---

## 4. Design Tokens

Bestehende globale Theme-Tokens sind verbindlich.

Regeln:

- Keine neuen Tokens ohne wiederverwendbaren Bedarf.
- Keine hart codierten Farben in Komponenten, wenn Token vorhanden sind.
- Dark und Light Mode müssen weiterhin funktionieren.
- CSS Modules dürfen Tokens verwenden, aber keine eigene Designwelt definieren.

Bei neuem Tokenbedarf muss der PR erklären:

- warum kein bestehender Token passt,
- wo der Token wiederverwendet wird,
- ob er für Dark und Light Mode definiert ist.

---

## 5. Navigation

Zielbild:

- linke Sidebar oder sidebarähnliche Navigation,
- eindeutige Einträge für Dashboard und Aktivitäten,
- App-Name `Asset View` oben links,
- klare aktive Zustände,
- keine doppelte oder widersprüchliche Navigation.

Geplante Navigationseinträge:

- Dashboard,
- Aktivitäten,
- später ggf. Einstellungen / Datenqualität / Audit.

---

## 6. Dashboard-UI

Dashboard soll folgende Bereiche klar trennen:

1. Hero / Portfolio-Auswahl / Aktualisieren,
2. Stale-Data- und Warnungsstatus,
3. KPI-Kacheln,
4. offene Wertpapiere,
5. geschlossene Wertpapiere,
6. Datenqualität / Reconciliation,
7. Asset-Audit-Panel.

### Portfolio-Auswahl

Regeln:

- Dropdown darf mehrere Portfolios auswählbar machen.
- Auswahlzustand muss klar sichtbar sein.
- Apply/Reset müssen eindeutig sein.
- Dropdown-Verhalten soll Parqet-ähnlich kompakt sein.

### Asset-Tabelle

Regeln:

- Asset-Name, ISIN/WKN/Symbol und Logo/Fallback müssen robust sein.
- Sortierung über Spaltenköpfe ist langfristiges Ziel.
- Spalten-Sichtbarkeit per Gear-Menü ist langfristiges Ziel.
- `Portfolios`-Spalte kann in der Listenansicht ausgeblendet werden, wenn sie keinen Mehrwert bringt.
- `letzte Aktivität` ist nicht zwingend und kann entfallen.
- Offene und geschlossene Positionen sollen klar getrennt sein.

### Warnungen

Regeln:

- Warnungen nicht dauerhaft breit ausklappen.
- Standard: kompakter Hinweis mit optionalem Panel.
- Warnungen müssen verständlich und prüfbar bleiben.
- Bearbeitungs-/Audit-Flows dürfen Warnungen nicht verstecken.

---

## 7. Activities-UI

Activities-Seite soll Parqet-nah funktionieren, aber stärker auditierbar sein.

Kernelemente:

- Hero-Bereich mit Zählern,
- Portfoliofilter,
- Suchfeld,
- Reset,
- Gruppierung nach Jahr und Monat,
- Activity Cards oder kompakte Zeilen,
- Inline-Override-Bearbeitung,
- Warnungen je Activity.

### Activity-Typen

User-facing Labels:

| Technischer Typ | UI-Label |
| --- | --- |
| `buy` | Kauf |
| `sell` | Verkauf |
| `dividend` | Dividende |
| `transfer_in` | Einbuchung / Transfer ein |
| `transfer_out` | Ausbuchung / Transfer aus |
| `unknown` | Unbekannt |

Offener Punkt:

- Begriffe für Transfers fachlich finalisieren.

### Override-Interaktion

Regeln:

- Originalwert und Override-Wert sichtbar halten.
- Bearbeiten, Speichern, Abbrechen und Reset eindeutig trennen.
- Fehler pro Zeile anzeigen.
- Nach Speichern Daten neu laden oder lokal konsistent aktualisieren.
- Kein Override darf als Änderung an Parqet-Rohdaten missverstanden werden.

### CTA `Neue Aktivität`

Aktueller Stand:

- CTA ist sichtbar, aber nicht implementiert.

Regel:

- Der CTA muss entweder entfernt, deaktiviert/markiert oder in einem separaten Issue implementiert werden.
- Kein Button ohne fachlich belastbaren Handler.

---

## 8. Asset-Identität und Logos

Ziel:

- Asset-Zeilen sollen auch bei unvollständigen API-Daten stabil aussehen.

Regeln:

- ISIN ist die primäre technische Identität.
- Name aus lokaler Metadatenquelle hat hohe Priorität.
- Fallback-Reihenfolge dokumentieren und konsistent anwenden.
- Logo-URL kann über ISIN gebildet werden, sofern zulässig und robust.
- Falls kein Logo verfügbar ist, neutraler Initialen-/Ticker-Fallback.

Geplantes Muster:

```text
Name
ISIN · WKN · Symbol
```

---

## 9. Loading, Empty und Error States

Jede datenladende Ansicht braucht:

- Loading State,
- Empty State,
- Error State,
- Auth-Reconnect State,
- ggf. Stale-Data State.

Regeln:

- Loading darf Layout nicht stark springen lassen.
- Auth-Probleme müssen klar zur Neuverbindung führen.
- Empty States dürfen nicht wie Fehler wirken.
- Fehlertexte sollen Nutzerhandlung ermöglichen.

---

## 10. Accessibility und Bedienbarkeit

Mindestregeln:

- Buttons müssen klare Labels haben.
- Inputs brauchen erkennbare Funktion.
- Fokuszustände dürfen nicht entfernt werden.
- Tabellen und Listen müssen ohne rein farbliche Bedeutung funktionieren.
- Warnungen brauchen Text, nicht nur Icon/Farbe.
- Click Targets dürfen nicht zu klein werden.

---

## 11. UI-PR-Checkliste

Jeder UI-PR soll prüfen:

- [ ] bestehende Theme-Tokens verwendet,
- [ ] Dark und Light Mode nicht gebrochen,
- [ ] keine neue Designwelt eingeführt,
- [ ] Loading/Empty/Error State berücksichtigt,
- [ ] responsive Verhalten plausibel,
- [ ] Warnungen/Audit-Infos bleiben sichtbar,
- [ ] keine irreführenden CTAs,
- [ ] Screenshots oder kurze Beschreibung bei sichtbaren Änderungen ergänzt.

---

## 12. Offene UI-Themen

- Sidebar finalisieren.
- Portfolio-Dropdown weiter an Parqet-Pattern angleichen.
- Asset-Tabelle mit Sortierung und Spalten-Sichtbarkeit ausbauen.
- Activities serverseitig paginieren und UX dafür definieren.
- Override-Workflow als Review-Fälle weiterentwickeln.
- Skeleton-Komponenten vereinheitlichen.
- UI-Guidelines per ADR absichern.
