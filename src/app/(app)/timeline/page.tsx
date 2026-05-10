"use client";

import { useMemo, useState } from "react";
import styles from "./TimelinePage.module.css";
import {
  ALL_ACTIVITY_TYPES,
  filterActivities,
  getActivityTypeLabel,
  getFreshnessLabel,
  getSourceLabel,
  groupProjectedActivities,
  loadLocalActivityReadModel,
  projectActivity,
  sortActivities,
  type ActivityFilters,
} from "../../../lib/local-activity-read-model";
import type { AuditActivityType } from "../../../lib/types";

function toggleType(current: AuditActivityType[], type: AuditActivityType) {
  return current.includes(type)
    ? current.filter((entry) => entry !== type)
    : [...current, type];
}

export default function TimelinePage() {
  const [readModel, setReadModel] = useState(() => loadLocalActivityReadModel());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ActivityFilters>(() => ({
    portfolioIds: readModel.scopedPortfolioIds,
    query: "",
    types: ALL_ACTIVITY_TYPES,
    dateFrom: "",
    dateTo: "",
    warningsOnly: false,
    overridesOnly: false,
  }));

  const scopedItems = useMemo(() => {
    if (readModel.scope.mode === "all") return readModel.items;
    const scopedIds = new Set(readModel.scopedPortfolioIds);
    return readModel.items.filter((item) => item.portfolioId && scopedIds.has(item.portfolioId));
  }, [readModel]);

  const projected = useMemo(() => {
    return sortActivities(filterActivities(scopedItems, filters), { key: "date", direction: "desc" }).map(projectActivity);
  }, [filters, scopedItems]);
  const groupingMode = projected.length > 140 ? "year" : "month";
  const groups = groupProjectedActivities(projected, groupingMode);
  const portfolioOptions = readModel.portfolios.filter((portfolio) => readModel.scopedPortfolioIds.includes(portfolio.id));
  const hasLocalData = readModel.items.length > 0;

  function updateFilter(next: Partial<ActivityFilters>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function clearFilters() {
    setFilters({
      portfolioIds: readModel.scopedPortfolioIds,
      query: "",
      types: ALL_ACTIVITY_TYPES,
      dateFrom: "",
      dateTo: "",
      warningsOnly: false,
      overridesOnly: false,
    });
  }

  function reloadFromLocalCache() {
    const next = loadLocalActivityReadModel();
    setReadModel(next);
    setFilters({
      portfolioIds: next.scopedPortfolioIds,
      query: "",
      types: ALL_ACTIVITY_TYPES,
      dateFrom: "",
      dateTo: "",
      warningsOnly: false,
      overridesOnly: false,
    });
  }

  return (
    <main className={`app-content ${styles.page}`}>
      <section className={`ui-surface ${styles.hero}`}>
        <div className={styles.heroTop}>
          <div>
            <p className={styles.eyebrow}>AssetTrace · Global Timeline</p>
            <h1 className={styles.title}>Globale Asset-Timeline</h1>
            <p className={styles.description}>
              Read-only Zeitachse aus lokalen Activity Items und Snapshot-backed Read Model. Die Produktseite ruft
              keine globale Audit- oder Provider-Route auf.
            </p>
          </div>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={reloadFromLocalCache}>
            Lokal neu einlesen
          </button>
        </div>

        <div className={styles.statusGrid}>
          <div>
            <span>Datenquelle</span>
            <strong>{getSourceLabel(readModel)}</strong>
          </div>
          <div>
            <span>Datenstand</span>
            <strong>{getFreshnessLabel(readModel)}</strong>
          </div>
          <div>
            <span>Timeline</span>
            <strong>{projected.length} Ereignisse · Gruppierung nach {groupingMode === "year" ? "Jahr" : "Monat"}</strong>
          </div>
        </div>
      </section>

      {readModel.missingScopePortfolioIds.length ? (
        <div className="ui-banner ui-banner-info">
          Der gespeicherte Portfolio-Scope passt nicht vollständig zum lokalen Datenstand. Timeline und Filter zeigen
          nur lokal verfügbare Portfolios im Scope; es wird nichts automatisch nachgeladen.
        </div>
      ) : null}

      <section className={`ui-surface ${styles.filters}`}>
        <div className={styles.filtersHeader}>
          <div>
            <h2>Timeline-Filter</h2>
            <p>Portfolio, Asset/Suche, Typ, Zeitraum und Warnungen werden lokal angewendet.</p>
          </div>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setFiltersOpen((open) => !open)}>
            {filtersOpen ? "Filter einklappen" : "Filter anzeigen"}
          </button>
        </div>

        <div className={`${styles.filtersGrid} ${filtersOpen ? styles.filtersGridOpen : ""}`}>
          <label>
            <span>Suche</span>
            <input className="ui-input" value={filters.query} onChange={(event) => updateFilter({ query: event.target.value })} placeholder="Asset, ISIN, Symbol, Portfolio" />
          </label>
          <label>
            <span>Von</span>
            <input className="ui-input" type="date" value={filters.dateFrom} onChange={(event) => updateFilter({ dateFrom: event.target.value })} />
          </label>
          <label>
            <span>Bis</span>
            <input className="ui-input" type="date" value={filters.dateTo} onChange={(event) => updateFilter({ dateTo: event.target.value })} />
          </label>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={filters.warningsOnly} onChange={(event) => updateFilter({ warningsOnly: event.target.checked })} />
            Nur Warnungen/Datenprobleme
          </label>

          <div className={styles.checkGroup}>
            <span>Portfolio</span>
            {portfolioOptions.length ? portfolioOptions.map((portfolio) => (
              <label key={portfolio.id} className={styles.checkRow}>
                <input type="checkbox" checked={filters.portfolioIds.includes(portfolio.id)} onChange={() => updateFilter({ portfolioIds: filters.portfolioIds.includes(portfolio.id) ? filters.portfolioIds.filter((id) => id !== portfolio.id) : [...filters.portfolioIds, portfolio.id] })} />
                {portfolio.name}
              </label>
            )) : <p>Keine lokalen Portfolios im Scope.</p>}
          </div>

          <div className={styles.checkGroup}>
            <span>Aktivitätstyp</span>
            {ALL_ACTIVITY_TYPES.map((type) => (
              <label key={type} className={styles.checkRow}>
                <input type="checkbox" checked={filters.types.includes(type)} onChange={() => updateFilter({ types: toggleType(filters.types, type) })} />
                {getActivityTypeLabel(type)}
              </label>
            ))}
          </div>

          <button type="button" className="ui-btn ui-btn-secondary" onClick={clearFilters}>
            Zurücksetzen
          </button>
        </div>
      </section>

      {!hasLocalData ? (
        <section className={`ui-surface ${styles.emptyState}`}>
          <p className={styles.eyebrow}>Keine lokalen Timeline-Daten</p>
          <h2>Dashboard-Refresh explizit starten</h2>
          <p>
            Die globale Timeline lädt beim Öffnen nicht nach. Aktualisiere die Daten explizit im Dashboard; danach
            visualisiert diese Seite die lokalen Aktivitäten als Zeitachse.
          </p>
        </section>
      ) : projected.length === 0 ? (
        <section className={`ui-surface ${styles.emptyState}`}>
          <p className={styles.eyebrow}>Keine Ereignisse im Filter</p>
          <h2>Keine lokalen Timeline-Treffer</h2>
          <p>Ändere Filter oder Portfolio-Scope. Die Seite startet keine Provider-Calls.</p>
        </section>
      ) : (
        <section className={styles.timeline} aria-label="Globale Asset-Timeline">
          {groups.map((group) => (
            <div key={group.key} className={styles.timelineGroup}>
              <div className={styles.timelineGroupHeader}>
                <h2>{group.label}</h2>
                <span>{group.items.length} Ereignisse</span>
              </div>
              <div className={styles.eventRail}>
                {group.items.map((event) => (
                  <article key={event.id} className={styles.eventCard}>
                    <div className={styles.eventTop}>
                      <span className={styles.typeBadge}>{event.hasWarnings ? "Warnung/Datenproblem" : event.typeLabel}</span>
                      <span className={styles.eventDate}>{event.dateLabel}</span>
                    </div>
                    <div className={styles.eventTitle}>{event.assetLabel}</div>
                    <div className={styles.eventMeta}>{event.assetMeta}</div>
                    <div className={styles.eventPortfolio}>{event.portfolioLabel}</div>
                    <div className={styles.eventMetrics}>
                      <span>Stückzahl {event.sharesLabel}</span>
                      <span>Preis {event.priceLabel}</span>
                      <span>Netto {event.amountNetLabel}</span>
                    </div>
                    <div className={styles.badgeRow}>
                      {event.hasWarnings ? <span className={styles.warningBadge}>{event.warningMessages.length} Warnung(en)</span> : null}
                      {event.overrideLabel ? <span className={styles.overrideBadge}>{event.overrideLabel}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
