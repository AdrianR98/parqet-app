import PortfolioFilter from "./PortfolioFilter";
import styles from "./HeroSection.module.css";
import type { Portfolio } from "../../lib/types";
import { formatCurrency } from "../../lib/format";

type HeroSectionProps = {
    portfolios: Portfolio[];
    selectedPortfolioIds: string[];
    draftPortfolioIds: string[];
    selectedPortfolioCount: number;
    assetCount: number;
    loadingAssets: boolean;
    refreshingAssets: boolean;
    hasCachedData: boolean;
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
 * ============================================================
 * COMPONENT: HERO SECTION
 * ============================================================
 *
 * Wichtig:
 * - bewusst OHNE "use client"
 * - rein präsentationale Unterkomponente
 * - wird innerhalb einer Client-Seite verwendet
 *
 * Dadurch vermeiden wir die Next-Warnungen zu Funktionsprops
 * auf Client-Entry-Ebene.
 */
export default function HeroSection({
    portfolios,
    selectedPortfolioIds,
    draftPortfolioIds,
    selectedPortfolioCount,
    assetCount,
    loadingAssets,
    refreshingAssets,
    hasCachedData,
    isPortfolioDropdownOpen,
    onToggleOpen,
    onToggleDraftPortfolio,
    onApply,
    onReset,
    onLoadAssets,
    totalPositionValue,
    totalUnrealizedPnL,
    totalDividendNet,
    consistencyWarningCount = 0,
    reconciliationWarningCount = 0,
    lastUpdatedAt,
    showStaleWarning = false,
    onToggleWarningsPanel,
}: HeroSectionProps) {
    const totalWarningCount =
        (consistencyWarningCount ?? 0) + (reconciliationWarningCount ?? 0);

    return (
        <section className={`ui-surface ${styles.hero}`}>
            <div className={styles.topRow}>
                <div className={styles.left}>
                    <div className={styles.eyebrow}>AssetTrace · Dashboard</div>
                    <h1 className={styles.title}>Parqet-Daten verstehen</h1>

                    <div className={styles.metaLine}>
                        <span>{selectedPortfolioCount} Portfolios ausgewählt</span>
                        <span>·</span>
                        <span>{assetCount} geladene Assets</span>
                        {lastUpdatedAt ? (
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
                                    }).format(new Date(lastUpdatedAt))}
                                </span>
                            </>
                        ) : null}
                    </div>

                    {showStaleWarning ? (
                        <div className={styles.warningLine}>
                            Hinweis: Der Stand kann veraltet sein. Aktualisiere explizit, wenn du neue Parqet-Daten übernehmen möchtest.
                        </div>
                    ) : null}

                    <p className={styles.description}>
                        AssetTrace ergänzt Parqet um eine klare Analyse- und Transparenzschicht.
                        Daten werden nur über die explizite Lade- oder Aktualisierungsaktion erneuert.
                    </p>
                </div>

                <div className={styles.actions}>
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
                        className="ui-btn ui-btn-secondary"
                        onClick={onToggleWarningsPanel}
                    >
                        Datenhinweise
                        {totalWarningCount > 0 ? (
                            <span className={styles.actionBadge}>{totalWarningCount}</span>
                        ) : null}
                    </button>

                    <button
                        type="button"
                        className="ui-btn ui-btn-primary"
                        onClick={onLoadAssets}
                        disabled={loadingAssets || refreshingAssets}
                    >
                        {loadingAssets
                            ? "Erstladung läuft..."
                            : refreshingAssets && hasCachedData
                                ? "Aktualisierung läuft..."
                                : hasCachedData
                                    ? "Manuell aktualisieren"
                                    : "Assets laden"}
                    </button>
                </div>
            </div>

            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Positionswert aus geladenem Stand</span>
                    <strong className={styles.kpiValue}>
                        {formatCurrency(totalPositionValue ?? 0)}
                    </strong>
                </div>

                <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Unrealisierter Gewinn</span>
                    <strong className={styles.kpiValue}>
                        {formatCurrency(totalUnrealizedPnL ?? 0)}
                    </strong>
                </div>

                <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Dividenden netto</span>
                    <strong className={styles.kpiValue}>
                        {formatCurrency(totalDividendNet ?? 0)}
                    </strong>
                </div>
            </div>
        </section>
    );
}
