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
    lastUpdatedAt?: string | null;
    showStaleWarning?: boolean;
    showWarningsPanel?: boolean;
    onToggleWarningsPanel: () => void;
};

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
    lastUpdatedAt = null,
    showStaleWarning = false,
    showWarningsPanel = false,
    onToggleWarningsPanel,
}: HeroSectionProps) {
    const investedAmount = totalPositionValue - totalUnrealizedPnL;

    return (
        <section className={styles.hero}>
            <div className={styles.left}>
                <div className={styles.ringPlaceholder}>
                    <div className={styles.ringValue}>
                        {formatCurrency(totalPositionValue)}
                    </div>
                </div>

                <div className={styles.copy}>
                    <h1 className={styles.title}>Deine Gesamtansicht</h1>

                    <div className={styles.metaRow}>
                        <span>{assetCount} Assets gesamt</span>
                        <span>·</span>
                        <span>{selectedPortfolioCount} Portfolios</span>
                        <span>·</span>
                        <span>EUR</span>
                        {lastUpdatedAt ? (
                            <>
                                <span>·</span>
                                <span>
                                    Stand: {new Date(lastUpdatedAt).toLocaleString("de-DE")}
                                </span>
                            </>
                        ) : null}
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.metrics}>
                        <div className={styles.metricBlock}>
                            <div className={styles.metricLabel}>Portfoliowert</div>
                            <div className={styles.metricMainValue}>
                                {formatCurrency(totalPositionValue)}
                            </div>

                            <div className={styles.metricRows}>
                                <div className={styles.metricRow}>
                                    <span className={styles.metricKey}>Investiert</span>
                                    <span className={styles.metricVal}>
                                        {formatCurrency(investedAmount)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.metricBlock}>
                            <div className={styles.metricLabel}>Kursgewinn</div>
                            <div className={`${styles.metricMainValue} ${styles.positive}`}>
                                {formatCurrency(totalUnrealizedPnL)}
                            </div>

                            <div className={styles.metricRows}>
                                <div className={styles.metricRow}>
                                    <span className={styles.metricKey}>Dividenden</span>
                                    <span className={styles.metricVal}>
                                        {formatCurrency(totalDividendNet)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.metricBlock}>
                            <div className={styles.metricLabel}>Ansicht</div>
                            <div className={styles.metricMainValueSmall}>ISIN-konsolidiert</div>

                            <div className={styles.metricRows}>
                                <div className={styles.metricRow}>
                                    <span className={styles.metricKey}>Aktive Portfolios</span>
                                    <span className={styles.metricVal}>
                                        {selectedPortfolioCount}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        className={styles.warningTileButton}
                        onClick={onToggleWarningsPanel}
                    >
                        <div className={styles.warningTile}>
                            <div className={styles.warningTileLabel}>Datenkonsistenz</div>
                            <div
                                className={`${styles.warningTileValue} ${consistencyWarningCount > 0
                                        ? styles.warningTileAlert
                                        : styles.warningTileOk
                                    }`.trim()}
                            >
                                {consistencyWarningCount > 0
                                    ? `${consistencyWarningCount} Warnung(en)`
                                    : "Keine Warnungen"}
                            </div>
                            <div className={styles.warningTileHint}>
                                {showWarningsPanel
                                    ? "Detailansicht ausblenden"
                                    : "Detailansicht einblenden"}
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            <div className={styles.right}>
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

                <div className={styles.refreshWrap}>
                    <button
                        type="button"
                        className={styles.refreshButton}
                        onClick={onLoadAssets}
                    >
                        {loadingAssets ? "Lade..." : "Aktualisieren"}
                    </button>

                    {showStaleWarning ? (
                        <div className={styles.refreshStaleWarning}>
                            Letzte Aktualisierung älter als 5 Tage
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
}