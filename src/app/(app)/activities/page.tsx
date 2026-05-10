"use client";

import { useMemo, useState } from "react";
import styles from "./ActivitiesPage.module.css";
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
  type ActivitySort,
  type ProjectedActivity,
} from "../../../lib/local-activity-read-model";
import type { AuditActivityType } from "../../../lib/types";

const PAGE_SIZE = 30;

const SORT_OPTIONS: Array<{ value: ActivitySort["key"]; label: string }> = [
  { value: "date", label: "Datum" },
  { value: "asset", label: "Asset" },
  { value: "type", label: "Typ" },
  { value: "amount", label: "Betrag" },
];

function DetailPanel({ activity, onClose }: { activity: ProjectedActivity; onClose: () => void }) {
  return (
    <aside className={`ui-surface ${styles.detailPanel}`} aria-label="Aktivitätsdetails">
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.eyebrow}>Lokale Detailansicht</p>
          <h2>{activity.typeLabel}</h2>
        </div>
        <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>
          Schließen
        </button>
      </div>

      <dl className={styles.detailGrid}>
        <div>
          <dt>Datum</dt>
          <dd>{activity.dateLabel}</dd>
        </div>
        <div>
          <dt>Asset</dt>
          <dd>{activity.assetLabel}</dd>
        </div>
        <div>
          <dt>Kennung</dt>
          <dd>{activity.assetMeta}</dd>
        </div>
        <div>
          <dt>Portfolio</dt>
          <dd>{activity.portfolioLabel}</dd>
        </div>
        <div>
          <dt>Stückzahl</dt>
          <dd>{activity.sharesLabel}</dd>
        </div>
        <div>
          <dt>Preis</dt>
          <dd>{activity.priceLabel}</dd>
        </div>
        <div>
          <dt>Betrag</dt>
          <dd>{activity.amountLabel}</dd>
        </div>
        <div>
          <dt>Netto-Betrag</dt>
          <dd>{activity.amountNetLabel}</dd>
        </div>
      </dl>

      {activity.hasWarnings ? (
        <div className={styles.detailBlock}>
          <h3>Warnungen</h3>
          <ul>
            {activity.warningMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="ui-banner ui-banner-info">Keine lokalen Warnungen für diese Aktivität.</div>
      )}

      {activity.overrideLabel ? (
        <div className="ui-banner ui-banner-info">
          {activity.overrideLabel}. Diese v1-Ansicht ist read-only und zeigt keine Bearbeitungssteuerung.
        </div>
      ) : null}
    </aside>
  );
}

function ActivityCard({ activity, onSelect }: { activity: ProjectedActivity; onSelect: () => void }) {
  return (
    <button type="button" className={styles.activityCard} onClick={onSelect}>
      <div className={styles.activityTop}>
        <span className={styles.typeBadge}>{activity.typeLabel}</span>
        <span className={styles.dateText}>{activity.dateLabel}</span>
      </div>

      <div className={styles.assetName}>{activity.assetLabel}</div>
      <div className={styles.assetMeta}>{activity.assetMeta}</div>
      <div className={styles.portfolioLine}>{activity.portfolioLabel}</div>

      <div className={styles.metricsGrid}>
        <div>
          <span>Stückzahl</span>
          <strong>{activity.sharesLabel}</strong>
        </div>
        <div>
          <span>Preis</span>
          <strong>{activity.priceLabel}</strong>
        </div>
        <div>
          <span>Betrag</span>
          <strong>{activity.amountLabel}</strong>
        </div>
        <div>
          <span>Netto</span>
          <strong>{activity.amountNetLabel}</strong>
        </div>
      </div>

      <div className={styles.badgeRow}>
        {activity.hasWarnings ? <span className={styles.warningBadge}>Warnung</span> : null}
        {activity.overrideLabel ? <span className={styles.overrideBadge}>{activity.overrideLabel}</span> : null}
      </div>
    </button>
  );
}

function toggleType(current: AuditActivityType[], type: AuditActivityType) {
  return current.includes(type)
    ? current.filter((entry) => entry !== type)
    : [...current, type];
}

export default function ActivitiesPage() {
  const [readModel, setReadModel] = useState(() => loadLocalActivityReadModel());
  const [filters, setFilters] = useState<ActivityFilters>(() => ({
    portfolioIds: readModel.scopedPortfolioIds,
    query: "",
    types: ALL_ACTIVITY_TYPES,
    dateFrom: "",
    dateTo: "",
    warningsOnly: false,
    overridesOnly: false,
  }));
  const [sort, setSort] = useState<ActivitySort>({ key: "date", direction: "desc" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const scopedItems = useMemo(() => {
    const scopedIds = new Set(readModel.scopedPortfolioIds);

    if (readModel.scope.mode === "all") {
      return readModel.items;
    }

    return readModel.items.filter((item) => item.portfolioId && scopedIds.has(item.portfolioId));
  }, [readModel]);

  const filteredItems = useMemo(
    () => sortActivities(filterActivities(scopedItems, filters), sort),
    [filters, scopedItems, sort],
  );
  const projected = useMemo(() => filteredItems.map(projectActivity), [filteredItems]);
  const visibleActivities = projected.slice(0, visibleCount);
  const groups = groupProjectedActivities(visibleActivities, "month");
  const selectedActivity = projected.find((activity) => activity.id === selectedActivityId) ?? null;
  const portfolioOptions = readModel.portfolios.filter((portfolio) =>
    readModel.scopedPortfolioIds.includes(portfolio.id),
  );
  const hasLocalData = readModel.items.length > 0;
  const hasMore = visibleCount < projected.length;

  function updateFilter(next: Partial<ActivityFilters>) {
    setVisibleCount(PAGE_SIZE);
    setSelectedActivityId(null);
    setFilters((current) => ({ ...current, ...next }));
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
    setVisibleCount(PAGE_SIZE);
    setSelectedActivityId(null);
  }

  function clearFilters() {
    updateFilter({
      portfolioIds: readModel.scopedPortfolioIds,
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
      <section className={`ui-surface ${styles.heroCard}`}>
        <div className={styles.heroTop}>
          <div>
            <p className={styles.eyebrow}>AssetTrace · Aktivitäten</p>
            <h1 className={styles.pageTitle}>Aktivitätshistorie</h1>
            <p className={styles.description}>
              Read-only Verlauf aus lokal geladenen Dashboard-/Snapshot-Daten. Öffnen, Filtern, Sortieren,
              Pagination und Detailansicht bleiben vollständig lokal.
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
            <span>Aktivitäten</span>
            <strong>{projected.length} von {scopedItems.length}</strong>
          </div>
        </div>
      </section>

      {readModel.missingScopePortfolioIds.length ? (
        <div className="ui-banner ui-banner-info">
          Der gespeicherte Portfolio-Scope enthält Portfolios, die im lokalen Datenstand nicht vorhanden sind.
          Bitte aktualisiere die Daten bei Bedarf explizit im Dashboard; diese Seite lädt nicht automatisch nach.
        </div>
      ) : null}

      <section className={`ui-surface ${styles.filtersCard}`}>
        <div className={styles.filtersHeader}>
          <div>
            <h2>Lokale Filter</h2>
            <p>Alle Filter arbeiten auf dem bereits geladenen Datenbestand.</p>
          </div>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setFiltersOpen((open) => !open)}>
            {filtersOpen ? "Filter einklappen" : "Filter anzeigen"}
          </button>
        </div>

        <div className={`${styles.filtersGrid} ${filtersOpen ? styles.filtersGridOpen : ""}`}>
          <label>
            <span>Suche</span>
            <input
              className="ui-input"
              value={filters.query}
              onChange={(event) => updateFilter({ query: event.target.value })}
              placeholder="Asset, ISIN, Symbol, Portfolio"
            />
          </label>

          <label>
            <span>Sortieren nach</span>
            <select
              className="ui-select"
              value={sort.key}
              onChange={(event) => setSort((current) => ({ ...current, key: event.target.value as ActivitySort["key"] }))}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Richtung</span>
            <select
              className="ui-select"
              value={sort.direction}
              onChange={(event) => setSort((current) => ({ ...current, direction: event.target.value as ActivitySort["direction"] }))}
            >
              <option value="desc">Absteigend</option>
              <option value="asc">Aufsteigend</option>
            </select>
          </label>

          <label>
            <span>Von</span>
            <input className="ui-input" type="date" value={filters.dateFrom} onChange={(event) => updateFilter({ dateFrom: event.target.value })} />
          </label>

          <label>
            <span>Bis</span>
            <input className="ui-input" type="date" value={filters.dateTo} onChange={(event) => updateFilter({ dateTo: event.target.value })} />
          </label>

          <div className={styles.checkGroup}>
            <span>Portfolio</span>
            {portfolioOptions.length ? portfolioOptions.map((portfolio) => (
              <label key={portfolio.id} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={filters.portfolioIds.includes(portfolio.id)}
                  onChange={() => updateFilter({ portfolioIds: filters.portfolioIds.includes(portfolio.id) ? filters.portfolioIds.filter((id) => id !== portfolio.id) : [...filters.portfolioIds, portfolio.id] })}
                />
                {portfolio.name}
              </label>
            )) : <p>Keine lokalen Portfolios im Scope.</p>}
          </div>

          <div className={styles.checkGroup}>
            <span>Typ</span>
            {ALL_ACTIVITY_TYPES.map((type) => (
              <label key={type} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={filters.types.includes(type)}
                  onChange={() => updateFilter({ types: toggleType(filters.types, type) })}
                />
                {getActivityTypeLabel(type)}
              </label>
            ))}
          </div>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={filters.warningsOnly} onChange={(event) => updateFilter({ warningsOnly: event.target.checked })} />
            Nur mit Warnungen
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={filters.overridesOnly} onChange={(event) => updateFilter({ overridesOnly: event.target.checked })} />
            Nur mit Overrides
          </label>

          <button type="button" className="ui-btn ui-btn-secondary" onClick={clearFilters}>
            Zurücksetzen
          </button>
        </div>
      </section>

      {!hasLocalData ? (
        <section className={`ui-surface ${styles.emptyState}`}>
          <p className={styles.eyebrow}>Keine lokalen Aktivitätsdaten</p>
          <h2>Aktivitäten zuerst im Dashboard laden</h2>
          <p>
            Diese Seite startet bewusst keine Parqet- oder Audit-Route. Lade oder aktualisiere die Daten explizit
            im Dashboard; danach werden die lokalen Snapshot-/Read-Model-Daten hier angezeigt.
          </p>
        </section>
      ) : projected.length === 0 ? (
        <section className={`ui-surface ${styles.emptyState}`}>
          <p className={styles.eyebrow}>Keine Treffer</p>
          <h2>Filter liefern keine lokalen Aktivitäten</h2>
          <p>Ändere Suche, Zeitraum, Portfolio, Typ oder Warnungs-/Override-Filter. Es wird nichts nachgeladen.</p>
        </section>
      ) : (
        <div className={styles.contentGrid}>
          <section className={styles.activityList}>
            {groups.map((group) => (
              <div key={group.key} className={styles.groupSection}>
                <div className={styles.groupHeader}>
                  <h2>{group.label}</h2>
                  <span>{group.items.length} angezeigt</span>
                </div>
                <div className={styles.cardGrid}>
                  {group.items.map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} onSelect={() => setSelectedActivityId(activity.id)} />
                  ))}
                </div>
              </div>
            ))}

            {hasMore ? (
              <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Mehr lokal anzeigen ({Math.min(PAGE_SIZE, projected.length - visibleCount)} weitere)
              </button>
            ) : null}
          </section>

          {selectedActivity ? (
            <DetailPanel activity={selectedActivity} onClose={() => setSelectedActivityId(null)} />
          ) : (
            <aside className={`ui-surface ${styles.detailPanel}`}>
              <p className={styles.eyebrow}>Detail</p>
              <h2>Aktivität auswählen</h2>
              <p>Wähle eine Aktivität, um sichere lokale Felder ohne Rohpayloads oder interne Debugdaten zu sehen.</p>
            </aside>
          )}
        </div>
      )}
    </main>
  );
}
