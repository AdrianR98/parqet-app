# Architecture — Parqet App

Status: draft
Owner: AdrianR98
Last reviewed: 2026-05-04

Dieses Dokument beschreibt die technische Architektur der Parqet-App. Es ist der Ausgangspunkt für spätere Refactorings und ADRs.

---

## 1. Architekturziel

Die App soll Parqet-Daten aus autorisierten Portfolios laden, in eine interne kanonische Datenform bringen und daraus verschiedene Views erzeugen:

- Dashboard,
- Asset-Übersicht,
- geschlossene Positionen,
- Asset-Audit,
- Activities-Audit,
- Reconciliation- und Consistency-Warnings.

Langfristig sollen alle Views auf derselben normalisierten, override-bereinigten Activity-Grundlage basieren.

---

## 2. Technologie

- Next.js App Router
- React Client Components für Dashboard/Activities
- TypeScript
- Route Handler unter `src/app/api/*`
- Lokale Lib-Schicht unter `src/lib/*`
- CSS Modules und globale UI-Klassen
- Tailwind CSS v4 im Projektkontext

---

## 3. Grobe Layer-Struktur

```text
Browser / React UI
  ↓
Hooks
  ↓
Next.js Route Handler
  ↓
Parqet API + lokale Lib-Schicht
  ↓
Normalisierung / Overrides / Reconciliation / Projection
  ↓
API Response
  ↓
UI Views
```

---

## 4. App-Routen

### `/dashboard`

Dashboard-Orchestrator.

Verantwortlichkeiten:

- Portfolioauswahl anzeigen und anwenden,
- Assets laden,
- Statistiken anzeigen,
- offene und geschlossene Wertpapiere darstellen,
- Warnungen anzeigen,
- Asset-Audit-Panel öffnen.

Wichtige Komponenten:

- `HeroSection`
- `StatsGrid`
- `CollapsibleAssetTableSection`
- `DataWarningsPanel`
- `AssetAuditPanel`

Wichtiger Hook:

- `useDashboardData`

### `/activities`

Activities-Audit-Ansicht.

Verantwortlichkeiten:

- Aktivitäten anzeigen,
- nach Portfolio und Suchbegriff filtern,
- nach Jahr/Monat gruppieren,
- Warnungen je Aktivität anzeigen,
- Overrides inline bearbeiten.

Wichtige Hooks:

- `useActivitiesAudit`
- `useActivityOverrides`

Bekannter offener Punkt:

- `Neue Aktivität` ist sichtbar, aber noch kein implementierter Schreibpfad.

---

## 5. API-Routen

### `/api/auth/start`

Startet Parqet OAuth mit PKCE.

Benötigt:

- `PARQET_CLIENT_ID`
- `PARQET_REDIRECT_URI`

Scope:

- `portfolio:read`

### `/api/auth/callback`

Verarbeitet den OAuth-Callback, tauscht Authorization Code gegen Tokens und speichert Tokens in HttpOnly-Cookies.

Bekannter offener Punkt:

- Die Weiterleitung ist aktuell lokal hart auf `http://localhost:3000/dashboard` gesetzt und sollte später konfigurierbar werden.

### `/api/parqet/portfolios`

Lädt autorisierte Portfolios aus Parqet.

### `/api/parqet/assets`

Erzeugt die Asset-Sicht für ausgewählte Portfolios.

Aktuelle Verantwortlichkeiten:

- Token prüfen,
- Refresh-Fallback,
- Portfolios laden,
- Activities laden,
- echte Wertpapieraktivitäten filtern,
- normalisieren,
- Overrides anwenden,
- Reconciliation-Warnungen erzeugen,
- Assets aggregieren,
- lokale Metadaten anreichern,
- aktive und geschlossene Positionen trennen,
- Consistency-Report erzeugen.

Geplanter Refactor:

- Pipeline-Logik in Shared Service extrahieren.

### `/api/parqet/activities-audit`

Erzeugt die Activities-Audit-Sicht.

Bekannter offener Punkt:

- Sollte mittelfristig serverseitige Pagination und Filter erhalten.
- Sollte denselben Shared Activity Context wie Assets verwenden.

### `/api/parqet/asset-audit`

Erzeugt eine assetbezogene Audit-Sicht.

Bekannter offener Punkt:

- Muss mit Shared Activity Context konsistent bleiben.

---

## 6. Lib-Schicht

Die Lib-Schicht enthält fachliche Funktionen und sollte langfristig die zentrale Geschäftslogik tragen.

Wichtige Verantwortungsbereiche:

| Bereich | Zweck |
| --- | --- |
| `parqet` | Cookie-/Token-Hilfen und Parqet-Refresh |
| `parqet-assets/fetch-*` | Portfolios und Activities laden |
| `parqet-assets/filters` | echte Wertpapieraktivitäten erkennen |
| `parqet-assets/normalization` | Parqet-Rohdaten in interne Activities normalisieren |
| `parqet-assets/overrides` | Overrides auf normalisierte Activities anwenden |
| `parqet-assets/override-store` | Overrides lesen/schreiben |
| `parqet-assets/reconciliation` | fachliche Warnungen erzeugen |
| `parqet-assets/build-corrected-assets` | aggregierte Asset-Sicht berechnen |
| `parqet-assets/metadata` | lokale ISIN-Metadaten laden |
| `parqet-assets/consistency` | Consistency-Report erzeugen |
| `dashboard-cache` | Dashboard-Cache lesen/schreiben |
| `dashboard-helpers` | Dashboard-Stats, Sortierung, Stale-Data |
| `asset-metadata` | clientseitige Metadatenanreicherung |

---

## 7. Zielarchitektur für P3

Die wichtigste Architekturänderung ist ein gemeinsamer Activity Context.

Vorschlag:

```text
src/lib/parqet-assets/build-activity-context.ts
```

Ziel:

```text
Parqet token + portfolioIds
→ selected portfolios
→ raw activities
→ filtered activities
→ normalized activities
→ overrides
→ corrected activities
→ reconciliation warnings
→ metadata context
→ consistency base
```

Route Handler sollen danach nur noch Projektionen erzeugen:

```text
buildActivityContext()
→ projectAssetsView()
→ projectActivitiesAuditView()
→ projectAssetAuditView()
```

Vorteile:

- weniger duplizierte Logik,
- konsistente Ergebnisse zwischen Dashboard und Audit,
- bessere Testbarkeit,
- klarere Performance-Optimierung,
- einfachere spätere Persistenz-/Cache-Strategie.

---

## 8. Caching

Aktuell existiert ein Dashboard-Cache auf Client-Seite.

Zielbild:

- last-known-good Daten anzeigen,
- Stale-Warnung nach definierter Schwelle anzeigen,
- Reconciliation-Warnings ebenfalls cachefähig machen,
- Aktualisierung bewusst durch Nutzeraktion oder definierte Revalidation auslösen.

Offene Punkte:

- Cache-Invalidierung,
- Umgang mit Portfolioauswahl,
- Umgang mit Overrides,
- Umgang mit API-Fehlern und Token-Refresh.

---

## 9. Performance-Hotspots

Bekannte Hotspots:

- vollständiges Laden aller Activities pro Portfolio,
- potenziell sequentielles Portfolio-Laden,
- Activities-Audit mit großer clientseitiger Liste,
- wiederholter Aufbau derselben Pipeline in mehreren Routen.

Geplante Gegenmaßnahmen:

- bounded concurrency,
- serverseitige Pagination,
- gemeinsame Pipeline,
- Caching,
- Loading States und nicht-blockierende UI.

---

## 10. Auth und Security

Tokens werden in HttpOnly-Cookies gespeichert.

Regeln:

- keine Tokens loggen,
- keine `.env`-Dateien committen,
- keine privaten Parqet-Exports committen,
- Auth-Fehler müssen Reconnect-Flow ermöglichen,
- Token-Refresh darf keine Dateninkonsistenz erzeugen.

---

## 11. UI-Architektur

UI soll modular bleiben.

Regeln:

- Dashboard-Orchestrator bleibt schlank.
- Komplexe Panels bleiben eigene Komponenten.
- Hooks kapseln Datenladen und Zustand.
- CSS Modules für komponentennahe Styles.
- globale Utility-Klassen nur für wiederverwendbare UI-Muster.
- bestehende Theme-Tokens verwenden.

---

## 12. ADR-Kandidaten

Folgende Entscheidungen sollten als ADR dokumentiert werden:

- Shared Activity Context als kanonische Pipeline.
- Override-Speicherung: Datei vs. DB vs. externer Store.
- UI-Token- und Parqet-Referenzregeln.
- Teststrategie: Vitest + Playwright.
- Cache-Strategie für Dashboard und Activities.
