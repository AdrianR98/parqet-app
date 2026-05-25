"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./ActivitiesPage.module.css";
import {
  ALL_ACTIVITY_TYPES,
  filterActivities,
  getEmptyLocalActivityReadModel,
  getActivityTypeLabel,
  getFreshnessLabel,
  normalizeExactIsin,
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
import {
  notifyBrowserLocalStateChanged,
  useHydrationSafeLocalSnapshot,
} from "../../../hooks/use-hydration-safe-local-snapshot";
import { ensureParqetLocalBootstrap } from "../../../lib/parqet-local-bootstrap";

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
          <dt>Typ</dt>
          <dd>{activity.typeLabel}</dd>
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
        {activity.feeLabel ? (
          <div>
            <dt>Gebühren</dt>
            <dd>{activity.feeLabel}</dd>
          </div>
        ) : null}
        {activity.taxLabel ? (
          <div>
            <dt>Steuern</dt>
            <dd>{activity.taxLabel}</dd>
          </div>
        ) : null}
        {activity.noteLabel ? (
          <div>
            <dt>Notiz</dt>
            <dd>{activity.noteLabel}</dd>
          </div>
        ) : null}
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
    <article
      className={styles.activityCard}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${activity.typeLabel} ${activity.assetLabel} öffnen`}
    >
      <div className={styles.activityTop}>
        <span className={styles.typeBadge}>{activity.typeLabel}</span>
        <span className={styles.dateText}>{activity.dateLabel}</span>
      </div>

      <div className={styles.assetName}>
        {activity.assetHref ? (
          <Link
            href={activity.assetHref}
            className={styles.assetLink}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {activity.assetLabel}
          </Link>
        ) : (
          activity.assetLabel
        )}
      </div>
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
        {activity.hasWarnings ? <span className={styles.warningBadge}>Prüfung nötig</span> : null}
        {activity.overrideLabel ? <span className={styles.overrideBadge}>{activity.overrideLabel}</span> : null}
      </div>
    </article>
  );
}

function toggleType(current: AuditActivityType[], type: AuditActivityType) {
  return current.includes(type)
    ? current.filter((entry) => entry !== type)
    : [...current, type];
}

function getDefaultActivityFilters(): ActivityFilters {
  return {
    portfolioIds: [],
    query: "",
    exactIsin: "",
    types: ALL_ACTIVITY_TYPES,
    dateFrom: "",
    dateTo: "",
    warningsOnly: false,
    overridesOnly: false,
  };
}

function ActivitiesPageContent() {
  const searchParams = useSearchParams();
  const initialIsinFilter = normalizeExactIsin(searchParams.get("isin"));
  const { value: readModel } = useHydrationSafeLocalSnapshot(
    loadLocalActivityReadModel,
    getEmptyLocalActivityReadModel,
  );
  const [filters, setFilters] = useState<ActivityFilters>(() => ({
    ...getDefaultActivityFilters(),
    exactIsin: initialIsinFilter,
  }));
  const [useHydratedPortfolioScope, setUseHydratedPortfolioScope] = useState(true);
  const [sort, setSort] = useState<ActivitySort>({ key: "date", direction: "desc" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [preparingLocalData, setPreparingLocalData] = useState(false);

  const scopedItems = useMemo(() => {
    const scopedIds = new Set(readModel.scopedPortfolioIds);

    if (readModel.scope.mode === "all") {
      return readModel.items;
    }

    return readModel.items.filter((item) => item.portfolioId && scopedIds.has(item.portfolioId));
  }, [readModel]);

  const effectiveFilters = useMemo(
    () => useHydratedPortfolioScope
      ? { ...filters, portfolioIds: readModel.scopedPortfolioIds }
      : filters,
    [filters, readModel.scopedPortfolioIds, useHydratedPortfolioScope],
  );

  const filteredItems = useMemo(
    () => sortActivities(filterActivities(scopedItems, effectiveFilters), sort),
    [effectiveFilters, scopedItems, sort],
  );
  const visibleActivities = useMemo(
    () => filteredItems.slice(0, visibleCount).map(projectActivity),
    [filteredItems, visibleCount],
  );
  const groups = useMemo(() => groupProjectedActivities(visibleActivities, "month"), [visibleActivities]);
  const selectedActivity = useMemo(() => {
    const activity = filteredItems.find((item) => item.id === selectedActivityId);
    return activity ? projectActivity(activity) : null;
  }, [filteredItems, selectedActivityId]);
  const portfolioOptions = readModel.portfolios.filter((portfolio) =>
    readModel.scopedPortfolioIds.includes(portfolio.id),
  );
  const hasLocalData = readModel.items.length > 0;
  const hasMore = visibleCount < filteredItems.length;
  const hasEmptyManualScopeIntersection =
    readModel.scope.mode === "manual" &&
    readModel.scope.selectedPortfolioIds.length > 0 &&
    readModel.scopedPortfolioIds.length === 0;

  useEffect(() => {
    let cancelled = false;

    async function bootstrapIfMissing() {
      if (hasLocalData || preparingLocalData) {
        return;
      }

      setPreparingLocalData(true);
      await ensureParqetLocalBootstrap();
      if (!cancelled) {
        notifyBrowserLocalStateChanged();
        setPreparingLocalData(false);
      }
    }

    void bootstrapIfMissing();

    return () => {
      cancelled = true;
    };
  }, [hasLocalData, preparingLocalData]);

  function updateFilter(next: Partial<ActivityFilters>) {
    if ("portfolioIds" in next) {
      setUseHydratedPortfolioScope(false);
    }

    setVisibleCount(PAGE_SIZE);
    setSelectedActivityId(null);
    setFilters((current) => ({ ...current, ...next }));
  }

  function reloadFromLocalCache() {
    notifyBrowserLocalStateChanged();
    setUseHydratedPortfolioScope(true);
    setFilters({
      ...getDefaultActivityFilters(),
      exactIsin: initialIsinFilter,
    });
    setVisibleCount(PAGE_SIZE);
    setSelectedActivityId(null);
  }

  function clearFilters() {
    setUseHydratedPortfolioScope(true);
    setVisibleCount(PAGE_SIZE);
    setSelectedActivityId(null);
    setFilters({
      ...getDefaultActivityFilters(),
      exactIsin: initialIsinFilter,
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
            <strong>{filteredItems.length} von {scopedItems.length}</strong>
          </div>
        </div>
      </section>

      {readModel.missingScopePortfolioIds.length ? (
        <div className="ui-banner ui-banner-info">
          Der gespeicherte Portfolio-Scope enthält Portfolios, die im lokalen Datenstand nicht vorhanden sind.
          Bitte aktualisiere die Daten bei Bedarf explizit im Dashboard; diese Seite lädt nicht automatisch nach.
        </div>
      ) : null}
      {hasEmptyManualScopeIntersection ? (
        <div className="ui-banner ui-banner-info">
          Für die ausgewählten Portfolios liegen lokal keine Aktivitäten vor.
        </div>
      ) : null}
      {effectiveFilters.exactIsin ? (
        <div className="ui-banner ui-banner-info">
          Gefiltert nach ISIN {effectiveFilters.exactIsin}.
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
              value={effectiveFilters.query}
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
            <input className="ui-input" type="date" value={effectiveFilters.dateFrom} onChange={(event) => updateFilter({ dateFrom: event.target.value })} />
          </label>

          <label>
            <span>Bis</span>
            <input className="ui-input" type="date" value={effectiveFilters.dateTo} onChange={(event) => updateFilter({ dateTo: event.target.value })} />
          </label>

          <div className={styles.checkGroup}>
            <span>Portfolio</span>
            {portfolioOptions.length ? portfolioOptions.map((portfolio) => (
              <label key={portfolio.id} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={effectiveFilters.portfolioIds.includes(portfolio.id)}
                  onChange={() => updateFilter({ portfolioIds: effectiveFilters.portfolioIds.includes(portfolio.id) ? effectiveFilters.portfolioIds.filter((id) => id !== portfolio.id) : [...effectiveFilters.portfolioIds, portfolio.id] })}
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
                  checked={effectiveFilters.types.includes(type)}
                  onChange={() => updateFilter({ types: toggleType(effectiveFilters.types, type) })}
                />
                {getActivityTypeLabel(type)}
              </label>
            ))}
          </div>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={effectiveFilters.warningsOnly} onChange={(event) => updateFilter({ warningsOnly: event.target.checked })} />
            Nur mit Warnungen
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={effectiveFilters.overridesOnly} onChange={(event) => updateFilter({ overridesOnly: event.target.checked })} />
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
          <h2>{preparingLocalData ? "Lokale Aktivitäten werden vorbereitet" : "Lokaler Datenstand noch leer"}</h2>
          <p>
            {preparingLocalData
              ? "Die App lädt den lokalen Stand automatisch. Bitte kurz warten."
              : "Noch keine lokalen Aktivitätsdaten verfügbar. Die App versucht automatisch, den lokalen Stand neu aufzubauen."}
          </p>
        </section>
      ) : filteredItems.length === 0 ? (
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
                Mehr lokal anzeigen ({Math.min(PAGE_SIZE, filteredItems.length - visibleCount)} weitere)
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

export default function ActivitiesPage() {
  return (
    <Suspense fallback={(
      <main className={`app-content ${styles.page}`}>
        <section className={`ui-surface ${styles.emptyState}`}>
          <p className={styles.eyebrow}>AssetTrace · Aktivitäten</p>
          <h2>Lokale Aktivitäten werden geladen</h2>
          <p>Die gefilterte Read-only Ansicht wird vorbereitet.</p>
        </section>
      </main>
    )}
    >
      <ActivitiesPageContent />
    </Suspense>
  );
}
