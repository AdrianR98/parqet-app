// src/app/page.tsx

"use client";

import AssetTable from "../../components/dashboard/AssetTable";
import DataWarningsPanel from "../../components/dashboard/DataWarningsPanel";
import HeaderBar from "../../components/dashboard/HeaderBar";
import HeroSection from "../../components/dashboard/HeroSection";
import StatsGrid from "../../components/dashboard/StatsGrid";
import { useDashboardData } from "../../hooks/use-dashboard-data";
import { useTheme } from "../../hooks/use-theme";

/**
 * Dashboard-Seite.
 *
 * Die Seite konzentriert sich auf Rendering und Komposition.
 * Datenlogik liegt im Hook useDashboardData(),
 * Theme-Logik liegt im Hook useTheme().
 */
export default function DashboardPage() {
    const { theme, toggleTheme, themeStyle } = useTheme();

    const {
        portfolios,
        selectedPortfolioIds,
        draftPortfolioIds,
        selectedPortfolioCount,
        isPortfolioDropdownOpen,
        showWarningsPanel,
        portfolioDropdownRef,

        assetCount,
        consistencyReport,
        reconciliationWarnings,
        lastUpdatedAt,

        loadingPortfolios,
        loadingAssets,
        errorMessage,

        stats,
        showStaleWarning,

        sortedActiveAssets,
        sortedClosedAssets,

        setIsPortfolioDropdownOpen,
        setShowWarningsPanel,

        toggleDraftPortfolio,
        applyPortfolioFilter,
        resetPortfolioFilter,
        loadAssets,
    } = useDashboardData();

    return (
        <main
            className={`parqet-page theme-${theme}`}
            style={themeStyle}
            data-theme={theme}
        >
            <HeaderBar theme={theme} onToggleTheme={toggleTheme} />

            <div className="parqet-content" ref={portfolioDropdownRef}>
                <HeroSection
                    portfolios={portfolios}
                    selectedPortfolioIds={selectedPortfolioIds}
                    draftPortfolioIds={draftPortfolioIds}
                    selectedPortfolioCount={selectedPortfolioCount}
                    assetCount={assetCount}
                    loadingAssets={loadingAssets}
                    isPortfolioDropdownOpen={isPortfolioDropdownOpen}
                    onToggleOpen={() => setIsPortfolioDropdownOpen((current) => !current)}
                    onToggleDraftPortfolio={toggleDraftPortfolio}
                    onApply={applyPortfolioFilter}
                    onReset={resetPortfolioFilter}
                    onLoadAssets={loadAssets}
                    totalPositionValue={stats.totalPositionValue}
                    totalUnrealizedPnL={stats.totalUnrealizedPnL}
                    totalDividendNet={stats.totalDividendNet}
                    consistencyWarningCount={consistencyReport?.warningCount ?? 0}
                    reconciliationWarningCount={reconciliationWarnings.length}
                    lastUpdatedAt={lastUpdatedAt}
                    showStaleWarning={showStaleWarning}
                    showWarningsPanel={showWarningsPanel}
                    onToggleWarningsPanel={() => setShowWarningsPanel((current) => !current)}
                />

                {loadingPortfolios ? (
                    <div className="parqet-info-banner">Portfolios werden geladen...</div>
                ) : null}

                {errorMessage ? (
                    <div className="parqet-error-banner">
                        <strong>Fehler</strong>
                        <div>{errorMessage}</div>
                    </div>
                ) : null}

                {showWarningsPanel ? (
                    <div style={{ marginBottom: 18 }}>
                        <DataWarningsPanel
                            warnings={consistencyReport?.assetsWithWarnings ?? []}
                            reconciliationWarnings={reconciliationWarnings}
                        />
                    </div>
                ) : null}

                <StatsGrid stats={stats} />

                <AssetTable
                    assets={sortedActiveAssets}
                    title="Assets"
                    subtitle="Aktuell noch in Portfolios vorhandene Positionen"
                />

                <div style={{ marginTop: 18 }}>
                    <AssetTable
                        assets={sortedClosedAssets}
                        title="Geschlossene Assets"
                        subtitle="Historisch gehaltene Assets, die aktuell in keinem Portfolio mehr auftauchen"
                    />
                </div>
            </div>
        </main>
    );
}