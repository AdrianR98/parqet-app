"use client";

import styles from "./ActivitiesPage.module.css";
import { useActivitiesAudit } from "../../../hooks/use-activities-audit";
import type { ActivitiesAuditItem } from "../../../lib/types";
import { formatCurrency } from "../../../lib/format";

function getTypeLabel(type: ActivitiesAuditItem["type"]) {
    switch (type) {
        case "buy":
            return "Kauf";
        case "sell":
            return "Verkauf";
        case "dividend":
            return "Dividende";
        case "transfer_in":
            return "Transfer ein";
        case "transfer_out":
            return "Transfer aus";
        case "unknown":
        default:
            return "Unbekannt";
    }
}

function formatDateTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function ActivityRow({ item }: { item: ActivitiesAuditItem }) {
    return (
        <article className={styles.activityRow}>
            <div className={styles.activityMain}>
                <div className={styles.activityTopLine}>
                    <div className={styles.activityTitleWrap}>
                        <strong className={styles.activityType}>
                            {getTypeLabel(item.type)}
                        </strong>

                        {item.hasOverrides ? (
                            <span className={styles.overrideBadge}>
                                Override aktiv
                            </span>
                        ) : null}

                        {item.warningMessages.length > 0 ? (
                            <span className={styles.warningBadge}>
                                {item.warningMessages.length} Warnung
                                {item.warningMessages.length === 1 ? "" : "en"}
                            </span>
                        ) : null}
                    </div>

                    <span className={styles.activityDate}>
                        {formatDateTime(item.datetime)}
                    </span>
                </div>

                <div className={styles.assetLine}>
                    <span className={styles.assetName}>
                        {item.name ?? item.isin}
                    </span>
                    <span className={styles.assetMeta}>
                        {item.isin}
                        {item.symbol ? ` · ${item.symbol}` : ""}
                        {item.wkn ? ` · ${item.wkn}` : ""}
                    </span>
                </div>

                <div className={styles.activityMetaGrid}>
                    <span>Portfolio: {item.portfolioName}</span>
                    <span>Stücke: {item.shares}</span>
                    <span>Preis: {formatCurrency(item.price ?? 0)}</span>
                    <span>Betrag: {formatCurrency(item.amount ?? 0)}</span>
                    <span>Netto: {formatCurrency(item.amountNet ?? 0)}</span>
                    <span>Raw Type: {item.rawType}</span>
                </div>

                {item.hasOverrides && item.overrideFlags ? (
                    <div className={styles.overrideFields}>
                        {Object.keys(item.overrideFlags).map((field) => (
                            <span key={field} className={styles.overrideFieldBadge}>
                                {field}
                            </span>
                        ))}
                    </div>
                ) : null}

                {item.warningMessages.length > 0 ? (
                    <div className={styles.warningList}>
                        {item.warningMessages.map((warning, index) => (
                            <div
                                key={`${item.id}-warning-${index}`}
                                className={styles.warningItem}
                            >
                                {warning}
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </article>
    );
}

export default function ActivitiesPage() {
    const {
        portfolios,
        filteredItems,
        filteredSummary,
        reconciliationWarnings,
        generatedAt,
        loading,
        errorMessage,
        authRequired,
        startReconnect,
        selectedPortfolioIds,
        selectedTypes,
        searchTerm,
        showPortfolioMenu,
        showTypeMenu,
        selectedPortfolioLabel,
        selectedTypeLabel,
        groupedYears,
        setSearchTerm,
        setShowPortfolioMenu,
        setShowTypeMenu,
        togglePortfolio,
        toggleType,
        clearFilters,
        reload,
    } = useActivitiesAudit();

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Aktivitäten</h1>

                    <div className={styles.summaryLine}>
                        <span>{filteredSummary.buyCount} Käufe</span>
                        <span>·</span>
                        <span>{filteredSummary.sellCount} Verkäufe</span>
                        <span>·</span>
                        <span>{filteredSummary.dividendCount} Dividenden</span>
                        <span>·</span>
                        <span>
                            {filteredSummary.transferInCount +
                                filteredSummary.transferOutCount +
                                filteredSummary.unknownCount}{" "}
                            Andere
                        </span>
                    </div>

                    <div className={styles.statusLine}>
                        <span>{filteredItems.length} sichtbare Aktivitäten</span>
                        <span>·</span>
                        <span>
                            {reconciliationWarnings.length} Reconciliation-Warnungen
                        </span>

                        {generatedAt ? (
                            <>
                                <span>·</span>
                                <span>
                                    Stand: {formatDateTime(generatedAt)}
                                </span>
                            </>
                        ) : null}
                    </div>
                </div>

                <div className={styles.headerRight}>
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={reload}
                    >
                        Neu laden
                    </button>
                </div>
            </header>

            <section className={styles.filtersBar}>
                <div className={styles.filterGroup}>
                    <div className={styles.dropdown}>
                        <button
                            type="button"
                            className={styles.filterButton}
                            onClick={() => setShowPortfolioMenu((current) => !current)}
                        >
                            {selectedPortfolioLabel}
                        </button>

                        {showPortfolioMenu ? (
                            <div className={styles.dropdownMenu}>
                                {portfolios.map((portfolio) => {
                                    const checked = selectedPortfolioIds.includes(
                                        portfolio.id
                                    );

                                    return (
                                        <label
                                            key={portfolio.id}
                                            className={styles.dropdownItem}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() =>
                                                    togglePortfolio(portfolio.id)
                                                }
                                            />
                                            <span>{portfolio.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>

                    <div className={styles.dropdown}>
                        <button
                            type="button"
                            className={styles.filterButton}
                            onClick={() => setShowTypeMenu((current) => !current)}
                        >
                            {selectedTypeLabel}
                        </button>

                        {showTypeMenu ? (
                            <div className={styles.dropdownMenu}>
                                {selectedTypes.length > 0 &&
                                    selectedTypes.length <= 6 ? null : null}

                                {[
                                    "buy",
                                    "sell",
                                    "dividend",
                                    "transfer_in",
                                    "transfer_out",
                                    "unknown",
                                ].map((type) => {
                                    const checked = selectedTypes.includes(
                                        type as ActivitiesAuditItem["type"]
                                    );

                                    return (
                                        <label
                                            key={type}
                                            className={styles.dropdownItem}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() =>
                                                    toggleType(
                                                        type as ActivitiesAuditItem["type"]
                                                    )
                                                }
                                            />
                                            <span>
                                                {getTypeLabel(
                                                    type as ActivitiesAuditItem["type"]
                                                )}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>

                    <input
                        className={styles.searchInput}
                        type="text"
                        placeholder="Suche nach Name, ISIN, Symbol, WKN oder Portfolio"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />

                    <button
                        type="button"
                        className={styles.clearButton}
                        onClick={clearFilters}
                    >
                        Filter löschen
                    </button>
                </div>
            </section>

            {loading ? (
                <div className={styles.infoBanner}>Aktivitäten werden geladen...</div>
            ) : null}

            {errorMessage ? (
                <div className={styles.errorBanner}>
                    <strong>
                        {authRequired
                            ? "Parqet-Verbindung abgelaufen"
                            : "Fehler"}
                    </strong>
                    <div>{errorMessage}</div>

                    {authRequired ? (
                        <div className={styles.bannerActions}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={startReconnect}
                            >
                                Erneut verbinden
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : null}

            <section className={styles.content}>
                {groupedYears.map((yearGroup) => (
                    <div key={yearGroup.year} className={styles.yearBlock}>
                        <div className={styles.yearHeader}>
                            <h2 className={styles.yearTitle}>{yearGroup.year}</h2>
                            <div className={styles.yearSummary}>
                                {yearGroup.items.length} Aktivitäten
                            </div>
                        </div>

                        {yearGroup.months.map((monthGroup) => (
                            <div key={monthGroup.monthKey} className={styles.monthBlock}>
                                <div className={styles.monthHeader}>
                                    <h3 className={styles.monthTitle}>
                                        {monthGroup.monthLabel}
                                    </h3>
                                    <div className={styles.monthSummary}>
                                        {monthGroup.items.length} Aktivitäten
                                    </div>
                                </div>

                                <div className={styles.monthItems}>
                                    {monthGroup.items.map((item) => (
                                        <ActivityRow key={item.id} item={item} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                {!loading && groupedYears.length === 0 ? (
                    <div className={styles.emptyState}>
                        Keine Aktivitäten für die aktuelle Filterung.
                    </div>
                ) : null}
            </section>
        </div>
    );
}