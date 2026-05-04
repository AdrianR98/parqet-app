# Data Model — Parqet App

Status: draft
Owner: AdrianR98
Last reviewed: 2026-05-04

Dieses Dokument beschreibt die zentralen Datenobjekte der Parqet-App und die fachliche Bedeutung der wichtigsten Typen. Technische Quelle ist primär `src/lib/types.ts`.

---

## 1. Ziel des Datenmodells

Das Datenmodell soll Parqet-Rohdaten in stabile interne Strukturen überführen, damit Dashboard, Activities-Audit, Asset-Audit, Reconciliation und spätere Tests dieselbe fachliche Grundlage nutzen.

Grundregel:

```text
Rohdaten bleiben Rohdaten.
Normalisierte Daten werden fachlich verarbeitet.
Overrides sind eine eigene Korrekturschicht.
Views sind Projektionen aus korrigierten Daten.
```

---

## 2. Kernobjekte

| Objekt | Typ | Zweck |
| --- | --- | --- |
| Portfolio | `Portfolio` | Autorisiertes Parqet-Portfolio |
| Asset-Metadaten | `AssetMetadata` | Lokale oder externe Asset-Anreicherung |
| Portfolio-Position | `PortfolioPosition` | Asset-Breakdown je Portfolio |
| Asset-Summary | `AssetSummary` | Aggregierte Wertpapierposition |
| Consistency Check | `AssetConsistencyCheck` | Assetbezogene Plausibilitätsprüfung |
| Consistency Report | `ConsistencyReport` | Zusammenfassung aller Consistency Checks |
| Reconciliation Warning | `ReconciliationWarning` | Fachliche Warnung auf Asset-/Activity-Ebene |
| Audit Activity Type | `AuditActivityType` | Normalisierter Activity-Typ |
| Activity Override | `ActivityOverride` | Feldbasierte manuelle Korrektur |
| Activities Audit Item | `ActivitiesAuditItem` | UI-fähige Audit-Darstellung einer Aktivität |
| Activities Audit Summary | `ActivitiesAuditSummary` | Zähler für Activities-Audit |

---

## 3. Portfolio

`Portfolio` beschreibt ein autorisiertes Parqet-Portfolio.

Wichtige Felder:

- `id`
- `name`
- `currency`
- `createdAt`
- `distinctBrokers`

Verwendung:

- Portfolioauswahl im Dashboard,
- Portfoliofilter in Activities,
- Mapping von Portfolio-ID zu Portfolio-Name in Aggregationen.

---

## 4. AssetMetadata

`AssetMetadata` beschreibt optionale Asset-Metadaten aus lokaler CSV oder später weiteren Quellen.

Wichtige Felder:

- `name`
- `assetName`
- `displayName`
- `title`
- `symbol`
- `ticker`
- `tickerSymbol`
- `wkn`
- `marketPrice`
- `marketPriceAt`
- `marketPriceSource`
- `currency`
- `assetType`
- `exchange`

Priorität für Display-Namen soll langfristig eindeutig geregelt werden:

```text
lokale Metadaten per ISIN
→ Activity-/API-Name
→ Symbol/Ticker/WKN
→ ISIN
```

Offener Punkt:

- Ein einheitlicher Display-Resolver sollte in P5-B eingeführt oder konsolidiert werden.

---

## 5. PortfolioPosition

`PortfolioPosition` beschreibt eine Asset-Teilposition innerhalb eines Portfolios.

Wichtige Felder:

- `portfolioId`
- `portfolioName`
- `netShares`
- `remainingCostBasis`
- `avgBuyPrice`
- `latestTradePrice`
- `marketPrice`
- `positionValue`
- `unrealizedPnL`
- `totalDividendNet`

Verwendung:

- Portfolio-Breakdown innerhalb eines Assets,
- spätere Detailansichten,
- Prüfung, ob ein Asset in mehreren Portfolios gehalten wird.

---

## 6. AssetSummary

`AssetSummary` ist die zentrale aggregierte Asset-Darstellung für das Dashboard.

Wichtige Gruppen:

### Identität

- `isin`
- `name`
- `symbol`
- `wkn`
- `ticker`
- `tickerSymbol`

### Portfolio-Bezug

- `portfolioIds`
- `portfolioNames`
- `portfolioBreakdown`

### Aktivitätszähler

- `activityCount`
- `buyCount`
- `sellCount`
- `dividendCount`

### Positionsberechnung

- `totalBoughtShares`
- `totalSoldShares`
- `netShares`
- `totalInvestedGross`
- `remainingCostBasis`
- `avgBuyPrice`

### Bewertung

- `latestTradePrice`
- `marketPrice`
- `marketPriceAt`
- `marketPriceSource`
- `positionValue`
- `unrealizedPnL`

### Ausschüttungen

- `totalDividendNet`

### Metadaten

- `metadata`
- `externalMetadata`
- `assetMeta`

Aktive und geschlossene Positionen werden aktuell über `netShares` getrennt:

```text
activeAssets: netShares > 0
closedAssets: netShares <= 0
```

Offener Punkt:

- Diese Trennung sollte später fachlich robuster dokumentiert und getestet werden, insbesondere bei Rundungsdifferenzen oder Transfers.

---

## 7. ReconciliationWarning

`ReconciliationWarning` beschreibt fachliche Warnungen.

Felder:

- `isin`
- `message`
- `severity`: `info`, `warning`, `error`

Zweck:

- Datenprobleme sichtbar machen,
- negative Bestände markieren,
- Verkäufe ohne Buy-Historie markieren,
- unbekannte Activity-Typen sichtbar halten,
- Grundlage für spätere Review-Workflows.

Offener Punkt:

- Warnungen sollten langfristig `ruleId`, Status, Acknowledgement und Override-Bezug bekommen.

---

## 8. ConsistencyReport

`ConsistencyReport` fasst Plausibilitätsprüfungen über Assets zusammen.

Wichtige Felder:

- `checkedAssets`
- `warningCount`
- `assetsWithWarnings`

`AssetConsistencyCheck` enthält unter anderem:

- `reconstructedNetShares`
- `remainingCostBasis`
- `isNegativeShares`
- `isNegativeCostBasis`
- `hasZeroSharesButCostBasis`
- `hasSharesButNoBuyHistory`
- `soldMoreThanBought`
- `warnings`

Zweck:

- Dashboard-Warnungen,
- fachliche Plausibilitätskontrolle,
- Grundlage für spätere Data-Quality-Aufgaben.

---

## 9. AuditActivityType

Interne Activity-Typen:

```text
buy
sell
dividend
transfer_in
transfer_out
unknown
```

UI-Labels sollten daraus benutzerfreundliche Begriffe ableiten:

```text
buy → Kauf
sell → Verkauf
dividend → Dividende
transfer_in → Einbuchung / Transfer ein
transfer_out → Ausbuchung / Transfer aus
unknown → Unbekannt
```

Offener Punkt:

- Die Begriffe für Transfers sollten fachlich vereinheitlicht werden.

---

## 10. ActivityOverride

`ActivityOverride` ist eine feldbasierte manuelle Korrektur einer normalisierten Aktivität.

Felder:

- `id`
- `activityId`
- `field`
- `value`
- `reason`
- `createdAt`
- `source`

Erlaubte Override-Felder sind unter anderem:

- `type`
- `datetime`
- `shares`
- `price`
- `amount`
- `amountNet`
- `portfolioId`
- `portfolioName`
- `isin`
- `name`
- `symbol`
- `wkn`

Regeln:

- Original-Parqet-Daten bleiben unverändert.
- Overrides werden nach der Normalisierung angewendet.
- UI muss Originalwert und Override-Wert unterscheidbar halten.
- Overrides dürfen Datenprobleme nicht unsichtbar machen.

Offene Punkte:

- Review-Status fehlt noch.
- Notizen und Begründungen sind noch nicht voll ausgebaut.
- Persistenz ist aktuell dateibasiert und sollte später bewertet werden.

---

## 11. ActivitiesAuditItem

`ActivitiesAuditItem` ist die UI-fähige Darstellung einer Aktivität.

Wichtige Gruppen:

### Identität und Zeit

- `id`
- `datetime`
- `year`
- `monthKey`
- `monthLabel`

### Portfolio

- `portfolioId`
- `portfolioName`

### Asset

- `isin`
- `name`
- `symbol`
- `wkn`

### Activity-Werte

- `type`
- `rawType`
- `shares`
- `price`
- `amount`
- `amountNet`

### Warnungen

- `warningMessages`

### Override-Sicht

- `hasOverrides`
- `overrideFlags`
- `overrideCount`
- `originalValues`
- `overrideValues`

Zweck:

- Activities-Seite,
- Inline-Bearbeitung,
- Warnungsanzeige,
- spätere Review-Fälle.

---

## 12. API Response Types

### PortfoliosApiResponse

Wird für Portfolio-Laden verwendet.

Auth-Reconnect-Felder:

- `authRequired`
- `reconnectUrl`
- `message`
- `details`

### AssetsApiResponse

Wird für Dashboard-/Asset-Laden verwendet.

Wichtige Felder:

- `activeAssets`
- `closedAssets`
- `rawActivityCount`
- `filteredActivityCount`
- `assetCount`
- `consistencyReport`
- `reconciliationWarnings`
- `generatedAt`

### ActivitiesAuditApiResponse

Wird für Activities-Audit verwendet.

Wichtige Felder:

- `generatedAt`
- `portfolios`
- `items`
- `reconciliationWarnings`
- `summary`

Offener Punkt:

- Response sollte später um serverseitige Pagination erweitert werden:

```text
items
page
pageSize
total
hasNextPage
```

---

## 13. Zielmodell für P3/P4

Langfristig sollen API-Routen nicht mehr jede für sich Rohdaten laden und transformieren.

Ziel:

```text
buildActivityContext(input)
→ context.correctedActivities
→ projectAssetsView(context)
→ projectActivitiesAuditView(context, filters, pagination)
→ projectAssetAuditView(context, isin)
```

Dadurch werden Tests, Performance-Optimierung und fachliche Konsistenz deutlich einfacher.

---

## 14. Testrelevante Regeln

Für spätere Unit-Tests besonders wichtig:

- Normalisierung unbekannter Activity-Typen.
- Kauf/Verkauf/Ausschüttung korrekt klassifizieren.
- Verkäufe ohne vorherige Käufe markieren.
- negative Bestände erkennen.
- Overrides korrekt und feldweise anwenden.
- Originalwerte im Audit erhalten.
- CSV-Metadaten priorisiert auflösen.
- aktive und geschlossene Positionen stabil trennen.
