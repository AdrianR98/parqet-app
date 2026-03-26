// src/components/dashboard/HeroSection.tsx

import PortfolioFilter from "./PortfolioFilter";
import styles from "./HeroSection.module.css";
import type { Portfolio } from "../../lib/types";
import { formatCurrency } from "../../lib/format";

// ============================================================
// Props
// ============================================================

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
            <div className={styles.topRow}>
                <div className={styles.titleBlock}>
                    <div className={styles.eyebrow}>Parqet Connect Dashboard</div>
                    <h1 className={styles.title}>Portfolioübergreifende Asset-Sicht</h1>
                    <p className={styles.subtitle}>
                        Konsolidierte Bestände, Erträge und Prüfhinweise über alle
                        ausgewählten Portfolios.
                    </p>
                </div>

                <div className={styles.topActions}>
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

                    <button
                        type="button"
                        className={`${styles.actionButton} ${
                            totalWarningCount > 0 ? styles.actionButtonAlert : ""
                        }`.trim()}
                        onClick={onToggleWarningsPanel}
                    >
                        Warnungen ({totalWarningCount})
                    </button>

                    <button
                        type="button"
                        className={`${styles.actionButton} ${
                            showWarningsPanel ? styles.actionButtonActive : ""
                        }`.trim()}
                        onClick={onLoadAssets}
                        disabled={loadingAssets}
                    >
                        {loadingAssets ? "Daten werden geladen..." : "Assets laden"}
                    </button>
                </div>
            </div>

            <div className={styles.summaryRow}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Portfolios</div>
                    <div className={styles.summaryValue}>{selectedPortfolioCount}</div>
                    <div className={styles.summaryMeta}>
                        von {portfolios.length} autorisierten Portfolios
                    </div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Assets</div>
                    <div className={styles.summaryValue}>{assetCount}</div>
                    <div className={styles.summaryMeta}>konsolidierte Positionen</div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Positionswert</div>
                    <div className={styles.summaryValue}>
                        {formatCurrency(totalPositionValue)}
                    </div>
                    <div className={styles.summaryMeta}>über alle geladenen Assets</div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Kursgewinn</div>
                    <div className={styles.summaryValue}>
                        {formatCurrency(totalUnrealizedPnL)}
                    </div>
                    <div className={styles.summaryMeta}>unrealisiert</div>
                </div>

                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Dividenden</div>
                    <div className={styles.summaryValue}>
                        {formatCurrency(totalDividendNet)}
                    </div>
                    <div className={styles.summaryMeta}>netto erfasst</div>
                </div>
            </div>

            <div className={styles.statusRow}>
                <div className={styles.updateCard}>
                    <div className={styles.updateLabel}>Letztes Update</div>
                    <div className={styles.updateValue}>{formatDateTime(lastUpdatedAt)}</div>
                    <div className={styles.updateMetaRow}>
                        <span>Konsistenz: {consistencyWarningCount}</span>
                        <span>Reconciliation: {reconciliationWarningCount}</span>
                    </div>

                    {showStaleWarning ? (
                        <div className={styles.staleWarning}>
                            Achtung: Die angezeigten Daten sind älter als 5 Tage.
                        </div>
                    ) : (
                        <div className={styles.updateHint}>
                            Datenstand aus letzter erfolgreicher Ladung
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
