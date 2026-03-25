// src/components/dashboard/HeroSection.tsx

import PortfolioFilter from "./PortfolioFilter";
import styles from "./HeroSection.module.css";
import type { Portfolio } from "../../lib/types";
import { formatCurrency } from "../../lib/format";

/**
 * ---------------------------------------------------------------------------
 * Props
 * ---------------------------------------------------------------------------
 */

type HeroSectionProps = {
    portfolios: Portfolio[];
    selectedPortfolioIds: string[];
    draftPortfolioIds: string[];
    selectedPortfolioCount: number;
    assetCount: number;
    loadingAssets: boolean;
    isPortfolioDropdownOpen: boolean;
    onToggleOpen: () => void;
    onToggleDraftPortfolio: (portfolioId: string) => void;
    onApply: () => void;
    onReset: () => void;
    onLoadAssets: () => void;
    totalPositionValue?: number;
    totalUnrealizedPnL?: number;
    totalDividendNet?: number;
    consistencyWarningCount?: number;
    reconciliationWarningCount?: number;
    lastUpdatedAt?: string | null;
    showStaleWarning?: boolean;
    showWarningsPanel?: boolean;
    onToggleWarningsPanel: () => void;
};

/**
 * ---------------------------------------------------------------------------
 * Lokale Helper
 * ---------------------------------------------------------------------------
 */

function formatDateTime(value: string | null | undefined): string {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function getTotalWarningCount(
    consistencyWarningCount?: number,
    reconciliationWarningCount?: number
): number {
    return (consistencyWarningCount ?? 0) + (reconciliationWarningCount ?? 0);
}

/**
 * ---------------------------------------------------------------------------
 * Komponente
 * ---------------------------------------------------------------------------
 */

export default function HeroSection({
    portfolios,
    selectedPortfolioIds,
    draftPortfolioIds,
    selectedPortfolioCount,
    assetCount,
    loadingAssets,
    isPortfolioDropdownOpen,
    onToggleOpen,
    onToggleDraftPortfolio,
    onApply,
    onReset,
    onLoadAssets,
    totalPositionValue = 0,
    totalUnrealizedPnL = 0,
    totalDividendNet = 0,
    consistencyWarningCount = 0,
    reconciliationWarningCount = 0,
    lastUpdatedAt = null,
    showStaleWarning = false,
    showWarningsPanel = false,
    onToggleWarningsPanel,
}: HeroSectionProps) {
    const totalWarningCount = getTotalWarningCount(
        consistencyWarningCount,
        reconciliationWarningCount
    );

    return (
        <section className={styles.hero}>
            {/* ------------------------------------------------------------------ */}
            {/* Linker Inhaltsbereich                                               */}
            {/* ------------------------------------------------------------------ */}
            <div className={styles.content}>
                <div className={styles.topRow}>
                    <div>
                        <div className={styles.eyebrow}>Parqet Connect Dashboard</div>
                        <h1 className={styles.title}>Portfolioübergreifende Asset-Sicht</h1>
                        <p className={styles.subtitle}>
                            Konsolidierte Bestände, Erträge und Prüfhinweise über alle ausgewählten
                            Portfolios.
                        </p>
                    </div>

                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.loadButton}
                            onClick={onLoadAssets}
                            disabled={loadingAssets}
                        >
                            {loadingAssets ? "Daten werden geladen..." : "Assets laden"}
                        </button>
                    </div>
                </div>

                {/* ------------------------------------------------------------------ */}
                {/* KPI-Zeile                                                          */}
                {/* ------------------------------------------------------------------ */}
                <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard}>
                        <div className={styles.kpiLabel}>Portfolios</div>
                        <div className={styles.kpiValue}>{selectedPortfolioCount}</div>
                        <div className={styles.kpiMeta}>
                            von {portfolios.length} autorisierten Portfolios
                        </div>
                    </div>

                    <div className={styles.kpiCard}>
                        <div className={styles.kpiLabel}>Assets</div>
                        <div className={styles.kpiValue}>{assetCount}</div>
                        <div className={styles.kpiMeta}>konsolidierte Positionen</div>
                    </div>

                    <div className={styles.kpiCard}>
                        <div className={styles.kpiLabel}>Positionswert</div>
                        <div className={styles.kpiValue}>{formatCurrency(totalPositionValue)}</div>
                        <div className={styles.kpiMeta}>über alle geladenen Assets</div>
                    </div>

                    <div className={styles.kpiCard}>
                        <div className={styles.kpiLabel}>Kursgewinn</div>
                        <div className={styles.kpiValue}>{formatCurrency(totalUnrealizedPnL)}</div>
                        <div className={styles.kpiMeta}>unrealisiert</div>
                    </div>

                    <div className={styles.kpiCard}>
                        <div className={styles.kpiLabel}>Dividenden</div>
                        <div className={styles.kpiValue}>{formatCurrency(totalDividendNet)}</div>
                        <div className={styles.kpiMeta}>netto erfasst</div>
                    </div>
                </div>

                {/* ------------------------------------------------------------------ */}
                {/* Warnungs- und Statusbereich                                        */}
                {/* ------------------------------------------------------------------ */}
                <div className={styles.statusRow}>
                    <button
                        type="button"
                        className={`${styles.warningCard} ${totalWarningCount > 0 ? styles.warningCardActive : ""
                            }`}
                        onClick={onToggleWarningsPanel}
                    >
                        <div className={styles.warningTitle}>Datenwarnungen</div>

                        <div className={styles.warningCountRow}>
                            <span className={styles.warningCount}>{totalWarningCount}</span>
                            <span className={styles.warningCountLabel}>
                                {totalWarningCount === 1 ? "Hinweis" : "Hinweise"}
                            </span>
                        </div>

                        <div className={styles.warningBreakdown}>
                            <span>Konsistenz: {consistencyWarningCount}</span>
                            <span>Reconciliation: {reconciliationWarningCount}</span>
                        </div>

                        <div className={styles.warningFooter}>
                            {showWarningsPanel ? "Panel ausblenden" : "Panel anzeigen"}
                        </div>
                    </button>

                    <div className={styles.updateCard}>
                        <div className={styles.updateLabel}>Letztes Update</div>
                        <div className={styles.updateValue}>{formatDateTime(lastUpdatedAt)}</div>

                        {showStaleWarning ? (
                            <div className={styles.staleWarning}>
                                Achtung: Die angezeigten Daten sind älter als 5 Tage.
                            </div>
                        ) : (
                            <div className={styles.updateHint}>Datenstand aus letzter erfolgreicher Ladung</div>
                        )}
                    </div>
                </div>
            </div>

            {/* -------------------------------------------------------------------- */}
            {/* Rechter Filterbereich                                                */}
            {/* -------------------------------------------------------------------- */}
            <div className={styles.filterPanel}>
                <PortfolioFilter
                    portfolios={portfolios}
                    selectedPortfolioIds={selectedPortfolioIds}
                    draftPortfolioIds={draftPortfolioIds}
                    isOpen={isPortfolioDropdownOpen}
                    onToggleOpen={onToggleOpen}
                    onToggleDraftPortfolio={onToggleDraftPortfolio}
                    onApply={onApply}
                    onReset={onReset}
                />
            </div>
        </section>
    );
}