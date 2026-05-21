import PortfolioFilter from "./PortfolioFilter";
import styles from "./HeroSection.module.css";
import type { Portfolio } from "../../lib/types";
import { formatCurrency } from "../../lib/format";

type HeroSectionProps = {
    portfolios: Portfolio[];
    selectedPortfolioIds: string[];
    draftPortfolioIds: string[];
    selectedPortfolioCount: number;
    loadedPortfolioCount: number;
    assetCount: number;
    loadingAssets: boolean;
    refreshingAssets: boolean;
    hasCachedData: boolean;
    hasPendingPortfolioSelection: boolean;
    isPortfolioDropdownOpen: boolean;
    onToggleOpen: () => void;
    onToggleDraftPortfolio: (portfolioId: string) => void;
    onApply: () => void;
    onReset: () => void;
    onLoadAssets: () => void;
    totalPositionValue?: number;
    totalUnrealizedPnL?: number;
    totalDividendNet?: number;
};

export default function HeroSection({
    portfolios,
    selectedPortfolioIds,
    draftPortfolioIds,
    selectedPortfolioCount,
    loadedPortfolioCount,
    assetCount,
    loadingAssets,
    refreshingAssets,
    hasCachedData,
    hasPendingPortfolioSelection,
    isPortfolioDropdownOpen,
    onToggleOpen,
    onToggleDraftPortfolio,
    onApply,
    onReset,
    onLoadAssets,
    totalPositionValue,
    totalUnrealizedPnL,
    totalDividendNet,
}: HeroSectionProps) {
    const invested = (totalPositionValue ?? 0) - (totalUnrealizedPnL ?? 0);

    return (
        <section className={`ui-surface ${styles.hero}`}>
            <div className={styles.topRow}>
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

                <input className={`ui-input ${styles.search}`} type="search" placeholder="Suche in Übersicht" aria-label="Suche in Übersicht" readOnly />

                <button type="button" className="ui-btn ui-btn-primary" onClick={onLoadAssets} disabled={loadingAssets || refreshingAssets}>
                    {loadingAssets ? "Lädt..." : refreshingAssets && hasCachedData ? "Aktualisiert..." : hasCachedData ? "Aktualisieren" : "Assets laden"}
                </button>
            </div>

            <div className={styles.summary}>
                <div className={styles.donut} aria-hidden="true" />
                <div className={styles.kpiGrid}>
                    <div><span>Portfoliowert</span><strong>{formatCurrency(totalPositionValue ?? 0)}</strong></div>
                    <div><span>Gewinn / Verlust</span><strong>{formatCurrency(totalUnrealizedPnL ?? 0)}</strong></div>
                    <div><span>Investiert</span><strong>{formatCurrency(invested)}</strong></div>
                    <div><span>Dividenden</span><strong>{formatCurrency(totalDividendNet ?? 0)}</strong></div>
                </div>
            </div>

            <div className={styles.meta}>{selectedPortfolioCount} ausgewählt · {loadedPortfolioCount} geladen · {assetCount} Assets{hasPendingPortfolioSelection ? " · Auswahl noch nicht geladen" : ""}</div>
        </section>
    );
}
