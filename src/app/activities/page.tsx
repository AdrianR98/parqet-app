"use client";

import { useMemo, useState } from "react";
import { useTheme } from "../../hooks/use-theme";
import { ALL_TYPES, useActivitiesAudit } from "../../hooks/use-activities-audit";
import type { ActivitiesAuditItem, AuditActivityType } from "../../lib/types";
import styles from "./ActivitiesPage.module.css";

function formatDateTime(datetime: string): string {
    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(datetime));
}

function formatCurrency(value: number): string {
    if (!Number.isFinite(value) || value === 0) {
        return "—";
    }

    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
    }).format(value);
}

function formatNumber(value: number): string {
    if (!Number.isFinite(value) || value === 0) {
        return "—";
    }

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    }).format(value);
}

function getTypeLabel(type: AuditActivityType): string {
    switch (type) {
        case "buy":
            return "Kauf";
        case "sell":
            return "Verkauf";
        case "dividend":
            return "Dividende";
        case "transfer_in":
            return "Transfer In";
        case "transfer_out":
            return "Transfer Out";
        default:
            return "Unbekannt";
    }
}

function getTypeClassName(type: AuditActivityType): string {
    switch (type) {
        case "buy":
            return styles.typeBuy;
        case "sell":
            return styles.typeSell;
        case "dividend":
            return styles.typeDividend;
        case "transfer_in":
            return styles.typeTransferIn;
        case "transfer_out":
            return styles.typeTransferOut;
        default:
            return styles.typeUnknown;
    }
}

function ActivityRow({ item }: { item: ActivitiesAuditItem }) {
    return (
        <article className={styles.activityCard}>
            <div className={styles.activityLeft}>
                <div className={`${styles.typeBadge} ${getTypeClassName(item.type)}`}>
                    {getTypeLabel(item.type)}
                </div>

                <div className={styles.activityDate}>{formatDateTime(item.datetime)} Uhr</div>
            </div>

            <div className={styles.activityMain}>
                <div className={styles.activityMeta}>
                    <span>{item.symbol || "—"}</span>
                    <span>·</span>
                    <span>{item.isin}</span>
                    {item.wkn ? (
                        <>
                            <span>·</span>
                            <span>{item.wkn}</span>
                        </>
                    ) : null}
                </div>

                <div className={styles.activityName}>{item.name ?? item.isin}</div>

                <div className={styles.activityPortfolio}>{item.portfolioName}</div>

                {item.warningMessages.length > 0 ? (
                    <div className={styles.warningList}>
                        {item.warningMessages.slice(0, 2).map((warning, index) => (
                            <span key={`${item.id}-warning-${index}`} className={styles.warningBadge}>
                                {warning}
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>

            <div className={styles.activityNumbers}>
                <div className={styles.activityNumberBlock}>
                    <div className={styles.activityNumberLabel}>Betrag</div>
                    <div className={styles.activityNumberValue}>{formatCurrency(item.amount)}</div>
                </div>

                <div className={styles.activityNumberBlock}>
                    <div className={styles.activityNumberLabel}>Anteile</div>
                    <div className={styles.activityNumberValue}>{formatNumber(item.shares)}</div>
                </div>

                <div className={styles.activityNumberBlock}>
                    <div className={styles.activityNumberLabel}>Preis</div>
                    <div className={styles.activityNumberValue}>{formatCurrency(item.price)}</div>
                </div>
            </div>
        </article>
    );
}

export default function ActivitiesPage() {
    const { theme, toggleTheme, themeStyle } = useTheme();

    const {
        loading,
        errorMessage,
        generatedAt,
        portfolios,
        reconciliationWarnings,
        selectedPortfolioIds,
        selectedTypes,
        searchTerm,
        setSearchTerm,
        togglePortfolio,
        toggleType,
        clearFilters,
        reload,
        filteredItems,
        filteredSummary,
        groupedYears,
    } = useActivitiesAudit();

    const [showPortfolioMenu, setShowPortfolioMenu] = useState(false);
    const [showTypeMenu, setShowTypeMenu] = useState(false);

    const selectedPortfolioLabel = useMemo(() => {
        if (selectedPortfolioIds.length === 0) {
            return "Keine Portfolios";
        }

        if (selectedPortfolioIds.length === portfolios.length) {
            return `${portfolios.length} Portfolios`;
        }

        if (selectedPortfolioIds.length === 1) {
            const portfolio = portfolios.find((entry) => entry.id === selectedPortfolioIds[0]);
            return portfolio?.name ?? "1 Portfolio";
        }

        return `${selectedPortfolioIds.length} Portfolios`;
    }, [portfolios, selectedPortfolioIds]);

    const selectedTypeLabel = useMemo(() => {
        if (selectedTypes.length === 0) {
            return "Alle Aktivitäten";
        }

        if (selectedTypes.length === 1) {
            return getTypeLabel(selectedTypes[0]);
        }

        return `${selectedTypes.length} Typen`;
    }, [selectedTypes]);

    return (
        <main className={`parqet-page theme-${theme}`} style={themeStyle}>
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
                            <span>{reconciliationWarnings.length} Reconciliation-Warnungen</span>
                            {generatedAt ? (
                                <>
                                    <span>·</span>
                                    <span>
                                        Stand:{" "}
                                        {new Intl.DateTimeFormat("de-DE", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        }).format(new Date(generatedAt))}
                                    </span>
                                </>
                            ) : null}
                        </div>
                    </div>

                    <div className={styles.headerRight}>
                        <button type="button" className={styles.secondaryButton} onClick={reload}>
                            Neu laden
                        </button>

                        <button type="button" className={styles.secondaryButton} onClick={toggleTheme}>
                            {theme === "dark" ? "Light Mode" : "Dark Mode"}
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
                                        const checked = selectedPortfolioIds.includes(portfolio.id);

                                        return (
                                            <label key={portfolio.id} className={styles.dropdownItem}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => togglePortfolio(portfolio.id)}
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
                                    {ALL_TYPES.map((type) => {
                                        const checked = selectedTypes.includes(type);

                                        return (
                                            <label key={type} className={styles.dropdownItem}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleType(type)}
                                                />
                                                <span>{getTypeLabel(type)}</span>
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

                        <button type="button" className={styles.clearButton} onClick={clearFilters}>
                            Filter löschen
                        </button>
                    </div>
                </section>

                {loading ? (
                    <div className={styles.infoBanner}>Aktivitäten werden geladen...</div>
                ) : null}

                {errorMessage ? (
                    <div className={styles.errorBanner}>
                        <strong>Fehler</strong>
                        <div>{errorMessage}</div>
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
                                        <h3 className={styles.monthTitle}>{monthGroup.monthLabel}</h3>
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
                        <div className={styles.emptyState}>Keine Aktivitäten für die aktuelle Filterung.</div>
                    ) : null}
                </section>
            </div>
        </main>
    );
}