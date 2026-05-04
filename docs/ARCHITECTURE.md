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

Alle Views sollen auf derselben normalisierten, override-bereinigten Activity-Grundlage basieren.

Die Architekturentscheidung dazu ist in `docs/adr/0002-shared-activity-context.md` dokumentiert.

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
Shared Activity Context
  ↓
Projektionen / Aggregationen / Audit Views
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
- Shared Activity Context aufbauen,
- korrigierte Activities zu Assets aggregieren,
- lokale Metadaten anreichern,
- aktive und geschlossene Positionen trennen,
- Consistency-Report erzeugen,
- Reconciliation-Warnings aus dem Shared Context zurückgeben.

### `/api/parqet/activities-audit`

Erzeugt die Activities-Audit-Sicht.

Aktuelle Verantwortlichkeiten:

- Token prüfen,
- Refresh-Fallback,
- Shared Activity Context aufbauen,
- korrigierte Activities in Audit-Items projizieren,
- Summary erzeugen,
- Reconciliation-Warnings zurückgeben,
- im Response-Feld `portfolios` weiterhin alle autorisierten Portfolios bereitstellen.

Bekannter offener Punkt:

- Sollte mittelfristig serverseitige Pagination und Filter erhalten.

### `/api/parqet/assets/audit`

Erzeugt eine assetbezogene Audit-Sicht.

Aktuelle Verantwortlichkeiten:

- Token prüfen,
- Refresh-Fallback,
- Shared Activity Context aufbauen,
- normalized/corrected Activities für eine ISIN auswerten,
- Original-/Override-Sicht für das Asset erzeugen,
- assetbezogene Warnings ausgeben.

---

## 6. Lib-Schicht

Die Lib-Schicht enthält fachliche Funktionen und sollte langfristig die zentrale Geschäftslogik tragen.

Wichtige Verantwortungsbereiche:

| Bereich | Zweck |
| --- | --- |
| `parqet` | Cookie-/Token-Hilfen und Parqet-Refresh |
| `parqet-assets/build-activity-context` | kanonischer Shared Activity Context |
| `parqet-assets/fetch-*` | Portfolios und Activities laden |
| `parqet-assets/filters` | echte Wertpapieraktivitäten erkennen |
| `parqet-assets/normalization` | Parqet-Rohdaten in interne Activities normalisieren |
| `parqet-assets/overrides` | Overrides auf normalisierte Activities anwenden |
| `parqet-assets/override-store` | Overrides lesen/schreiben |
| `parqet-assets/reconciliation` | fachliche Warnungen erzeugen |
| `parqet-assets/build-corrected-assets` | aggregierte Asset-Sicht berechnen |
| `parqet-assets/metadata` | lokale ISIN-Metadaten laden |
| `metadata-utils` | zentrale Namens-/Symbolauflösung und Metadata-Normalisierung |
| `parqet-assets/consistency` | Consistency-Report erzeugen |
| `dashboard-cache` | Dashboard-Cache lesen/schreiben |
| `dashboard-helpers` | Dashboard-Stats, Sortierung, Stale-Data |
| `asset-metadata` | clientseitige Metadatenanreicherung |

---

## 7. Shared Activity Context

Der Shared Activity Context ist umgesetzt in:

```text
src/lib/parqet-assets/build-activity-context.ts
```

Er stellt aktuell bereit:

- `authorizedPortfolios`,
- `selectedPortfolios`,
- `portfolioNameById`,
- `rawActivities`,
- `filteredActivities`,
- `normalizedActivities`,
- `correctedActivities`,
- `reconciliationWarnings`.

Kanonische Pipeline:

```text
fetchAuthorizedPortfolios
→ loadActivitiesForPortfolios
→ isRealSecurityActivity
→ normalizeActivities
→ readActivityOverrides
→ applyOverrides
→ buildReconciliationWarnings
```

Route Handler sollen danach nur noch Projektionen erzeugen:

```text
buildActivityContext()
→ Assets-Projektion
→ Activities-Audit-Projektion
→ Asset-Audit-Projektion
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
- Activities-Audit mit großer clientseitiger Liste.

Geplante Gegenmaßnahmen:

- bounded concurrency,
- serverseitige Pagination,
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

## 12. ADRs

Bisherige ADRs:

- `docs/adr/0001-ui-reference-and-theme-tokens.md`
- `docs/adr/0002-shared-activity-context.md`

Weitere mögliche ADRs:

- Override-Speicherung: Datei vs. DB vs. externer Store.
- Teststrategie: Vitest + Playwright.
- Cache-Strategie für Dashboard und Activities.
