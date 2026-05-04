# Parqet App

Parqet App ist eine Next.js-App zur Auswertung von Parqet-Portfolios. Die Anwendung verbindet sich über Parqet Connect, lädt autorisierte Portfolios und Aktivitäten, normalisiert Wertpapierbewegungen, wendet lokale Korrekturen an und erzeugt daraus Dashboard-, Asset- und Activities-Audit-Ansichten.

Dieses Repository ist aktuell in einer strukturierten Überarbeitungsphase. Die verbindlichen Arbeitsregeln für Codex-gestützte Änderungen stehen in:

- `docs/CODEX_MASTERPROMPT.md`
- `docs/CODEX_TASK_CATALOG.md`
- `docs/ROADMAP.md`

---

## Aktueller Funktionsumfang

### OAuth / Parqet Connect

Die App startet den OAuth-Flow über `/api/auth/start`. Dafür werden `PARQET_CLIENT_ID` und `PARQET_REDIRECT_URI` benötigt. Der Flow nutzt PKCE mit `code_challenge_method=S256` und dem Scope `portfolio:read`.

Der Callback unter `/api/auth/callback` tauscht den Authorization Code gegen Tokens und speichert Access Token und Refresh Token in HttpOnly-Cookies. Aktuell leitet der Callback noch fest auf `http://localhost:3000/dashboard` weiter. Das ist ein bekannter Punkt für spätere Konfiguration.

### Dashboard

Die Dashboard-Seite unter `/dashboard` orchestriert:

- Portfolioauswahl,
- Asset-Laden,
- Hero- und KPI-Bereich,
- Statistik-Kacheln,
- offene Wertpapiere,
- geschlossene Wertpapiere,
- Reconciliation- und Konsistenzwarnungen,
- Asset-Audit-Panel.

Die Dashboard-UI ist modular aufgebaut, unter anderem mit `HeroSection`, `StatsGrid`, `CollapsibleAssetTableSection`, `DataWarningsPanel` und `AssetAuditPanel`.

### Assets-API

`GET /api/parqet/assets` erwartet mindestens einen `portfolioId`-Query-Parameter.

Die Route führt derzeit die zentrale Build-Pipeline aus:

```text
Token prüfen
→ Portfolios / Activities laden
→ echte Wertpapieraktivitäten filtern
→ Aktivitäten normalisieren
→ Overrides anwenden
→ Reconciliation-Warnungen bauen
→ bereinigte Assets erzeugen
→ lokale CSV-Metadaten anreichern
→ aktive und geschlossene Assets trennen
→ Konsistenzreport berechnen
```

Die Pipeline soll in einer späteren Phase in einen gemeinsamen Service extrahiert werden, damit Assets-, Dashboard- und Activities-Audit-Sichten nicht mehrfach eigene Varianten derselben Logik pflegen.

### Activities

Die Activities-Seite unter `/activities` zeigt eine auditierbare Aktivitätenansicht mit:

- Portfoliofilter,
- Suche nach Name, WKN, ISIN, Symbol oder Portfolio,
- Gruppierung nach Jahr und Monat,
- Typ-Labels wie Kauf, Verkauf und Dividende,
- Warnungsanzeige je Aktivität,
- Inline-Override-Bearbeitung für Felder wie Stücke, Preis, Betrag, Netto und Typ.

Die Activities-Seite zeigt keinen CTA mehr für `Neue Aktivität`, damit kein nicht implementierter Schreibpfad suggeriert wird. Ein Hinweis auf der Seite grenzt stattdessen klar ab: Activity-Erstellung ist nicht implementiert; Korrekturen laufen über Overrides.

### Lokale Metadaten und Overrides

Die App unterstützt lokale Metadaten-Anreicherung per ISIN. Ziel ist eine robuste Anzeige von Name, Symbol, WKN und weiteren Asset-Feldern, auch wenn die Parqet-API nicht alle gewünschten Darstellungsdaten liefert.

Overrides dienen als auditierbare Korrekturschicht über normalisierten Aktivitäten. Rohdaten sollen dadurch nicht stillschweigend verändert werden. Originalwerte, Override-Werte und Warnungen bleiben fachlich relevant.

---

## Datenpipeline

Die Zielarchitektur folgt dieser kanonischen Reihenfolge:

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

Diese Reihenfolge ist bewusst, weil spätere Sichten auf denselben bereinigten Aktivitätskontext zugreifen sollen. Details stehen in `docs/CODEX_MASTERPROMPT.md` und `docs/ROADMAP.md`.

---

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- ESLint
- Vercel-kompatibler Betrieb

Siehe `package.json` für die konkrete Versionslage.

---

## Lokale Entwicklung

### Voraussetzungen

- Node.js
- npm
- Parqet Connect Client-Konfiguration

### Installation

```bash
npm install
```

### Umgebungsvariablen

Mindestens erforderlich:

```bash
PARQET_CLIENT_ID=...
PARQET_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

Keine `.env`-Dateien oder Secrets committen.

### Development Server

```bash
npm run dev
```

Danach die App lokal öffnen:

```text
http://localhost:3000
```

Je nach Routing kann der direkte Einstieg über `/dashboard` sinnvoll sein.

---

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run generate:asset-metadata
```

Aktuell gibt es noch kein `test`-Script. Tests sind als Roadmap-Punkt vorgesehen.

---

## Qualitätssicherung

Vor Pull Requests mindestens ausführen:

```bash
npm run lint
npm run build
```

Sobald die Test-Infrastruktur eingeführt ist, zusätzlich:

```bash
npm run test -- --run
```

Für Änderungen an Normalisierung, Overrides, Reconciliation, Aggregation oder Namensauflösung sollen Unit-Tests ergänzt werden, sobald Vitest eingerichtet ist.

---

## GitHub-Workflow

Die weitere Arbeit läuft über Issues und Pull Requests.

Aktueller Steuerungsanker:

- Parent-Issue `#1`: Roadmap für Codex-gesteuerte Phasenarbeit
- `docs/CODEX_MASTERPROMPT.md`: dauerhafte Codex-Regeln
- `docs/CODEX_TASK_CATALOG.md`: phasenweiser Task-Katalog
- `docs/ROADMAP.md`: Governance, Branch-Strategie, Board- und PR-Regeln

Pull Requests sollen klein und reviewbar bleiben. Keine privaten Parqet-Exporte, Tokens, Secrets oder `.env`-Dateien committen.

---

## Bekannte offene Punkte

- README ist mit diesem Stand erstmals produktbezogen, weitere Detaildokumente folgen in P2-B.
- Die Datenpipeline ist noch nicht vollständig in einen gemeinsamen Service extrahiert.
- Activity-Laden ist als Performance-Hotspot bekannt und soll über bounded concurrency verbessert werden.
- Activities-Audit lädt/filtert aktuell noch zu viel clientseitig und soll serverseitige Pagination erhalten.
- Dashboard-Cache soll weiter vervollständigt werden.
- Activity-Erstellung ist weiterhin nicht implementiert; die Activities-Seite kennzeichnet dies explizit und verweist für Korrekturen auf Overrides.
- Test-Infrastruktur und CI sind noch nicht final eingerichtet.
- OAuth-Callback enthält aktuell noch eine localhost-Weiterleitung, die konfigurierbar werden sollte.

---

## Nicht-Ziele

Dieses Repository soll keine privaten Portfolio-Exports, keine produktiven Secrets und keine ungeprüften großen Refactorings enthalten. UI-Änderungen sollen vorhandene Theme-Tokens nutzen und sich an der Parqet-Referenz orientieren, statt eine neue Designwelt einzuführen.
