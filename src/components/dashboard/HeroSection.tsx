import PortfolioFilter from "./PortfolioFilter";
import styles from "./HeroSection.module.css";
import type { Portfolio } from "../../lib/types";
import { formatCurrency } from "../../lib/format";

export type AllocationSegment = {
    label: string;
    value: number;
    color: string;
};

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
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    totalPositionValue?: number;
    totalUnrealizedPnL?: number;
    totalDividendNet?: number;
    allocationSegments: AllocationSegment[];
};

function buildDonutGradient(segments: AllocationSegment[]): string {
    if (segments.length === 0) {
        return "conic-gradient(#d6e2ef 0 100%)";
    }

    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    let offset = 0;

    const stops = segments.map((segment) => {
        const start = offset;
        const size = total > 0 ? (segment.value / total) * 100 : 0;
        offset += size;
        return `${segment.color} ${start}% ${offset}%`;
    });

    return `conic-gradient(${stops.join(", ")})`;
}

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
    searchQuery,
    onSearchQueryChange,
    totalPositionValue,
    totalUnrealizedPnL,
    totalDividendNet,
    allocationSegments,
}: HeroSectionProps) {
    const invested = (totalPositionValue ?? 0) - (totalUnrealizedPnL ?? 0);
    const donutGradient = buildDonutGradient(allocationSegments);

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

                <input
                    className={`ui-input ${styles.search}`}
                    type="search"
                    placeholder="Suche nach Wertpapieren, ETFs, Kryptowährungen …"
                    aria-label="Globale Suche"
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                />

                <button type="button" className="ui-btn ui-btn-secondary" onClick={onLoadAssets} disabled={loadingAssets || refreshingAssets}>
                    {loadingAssets ? "Lädt..." : refreshingAssets && hasCachedData ? "Lädt neu..." : "Daten neu laden"}
                </button>
            </div>

            <div className={styles.summary}>
                <div className={styles.donutWrap}>
                    {allocationSegments.length > 0 ? <div className={styles.donut} aria-hidden="true" style={{ background: donutGradient }} /> : <div className={styles.donutEmpty}>Keine Allokationsdaten</div>}
                    {allocationSegments.length > 0 ? (
                        <div className={styles.legend}>
                            {allocationSegments.map((segment) => {
                                const total = allocationSegments.reduce((sum, item) => sum + item.value, 0);
                                const ratio = total > 0 ? (segment.value / total) * 100 : 0;
                                return (
                                    <span key={segment.label} className={styles.legendItem}>
                                        <i style={{ background: segment.color }} />
                                        {segment.label} {ratio.toFixed(1)}%
                                    </span>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
                <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard}><span>Portfoliowert</span><strong>{formatCurrency(totalPositionValue ?? 0)}</strong></div>
                    <div className={styles.kpiCard}><span>Gewinn / Verlust</span><strong className={(totalUnrealizedPnL ?? 0) >= 0 ? styles.positive : styles.negative}>{formatCurrency(totalUnrealizedPnL ?? 0)}</strong></div>
                    <div className={styles.kpiCard}><span>Investiert</span><strong>{formatCurrency(invested)}</strong></div>
                    <div className={styles.kpiCard}><span>Dividenden</span><strong>{formatCurrency(totalDividendNet ?? 0)}</strong></div>
                </div>
            </div>

            <div className={styles.meta}>Lokale Daten vorhanden · {assetCount} Assets{hasPendingPortfolioSelection ? " · Auswahl noch nicht geladen" : " · Aktuell"}</div>
        </section>
    );
}
