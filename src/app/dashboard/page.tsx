// ============================================================
// src/app/dashboard/page.tsx
// ------------------------------------------------------------
// Dashboard Root Page
// - reine UI-Komposition
// - Datenlogik bleibt in den Hooks
// ============================================================

"use client";

import { useState } from "react";

import HeaderBar from "../../components/dashboard/HeaderBar";
import HeroSection from "../../components/dashboard/HeroSection";
import StatsGrid from "../../components/dashboard/StatsGrid";
import DataWarningsPanel from "../../components/dashboard/DataWarningsPanel";
import CollapsibleAssetTableSection from "../../components/dashboard/CollapsibleAssetTableSection";
import AssetAuditPanel from "../../components/dashboard/AssetAuditPanel";

import { useDashboardData } from "../../hooks/use-dashboard-data";
import { useTheme } from "../../hooks/use-theme";
import { useAssetAudit } from "../../hooks/use-asset-audit";

import type { AssetSummary } from "../../lib/types";

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

    const [auditAsset, setAuditAsset] = useState<AssetSummary | null>(null);

    const {
        data: auditData,
        loading: loadingAudit,
        error: auditError,
        loadAudit,
        resetAudit,
    } = useAssetAudit();

    async function handleAuditAsset(asset: AssetSummary) {
        setAuditAsset(asset);

        await loadAudit({
            isin: asset.isin,
            portfolioIds: selectedPortfolioIds,
        });
    }

    function handleCloseAudit() {
        setAuditAsset(null);
        resetAudit();
    }

    return (
        <main
            className={`parqet-page theme-${theme}`}
            style={themeStyle}
            data-theme={theme}
        >
            <HeaderBar theme={theme} onToggleTheme={toggleTheme} />

            <div className="parqet-content" ref={portfolioDropdownRef}>
                <div className="parqet-dashboard-stack">
                    <HeroSection
                        portfolios={portfolios}
                        selectedPortfolioIds={selectedPortfolioIds}
                        draftPortfolioIds={draftPortfolioIds}
                        selectedPortfolioCount={selectedPortfolioCount}
                        assetCount={assetCount}
                        loadingAssets={loadingAssets}
                        isPortfolioDropdownOpen={isPortfolioDropdownOpen}
                        onToggleOpen={() =>
                            setIsPortfolioDropdownOpen((current) => !current)
                        }
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
                        onToggleWarningsPanel={() =>
                            setShowWarningsPanel((current) => !current)
                        }
                    />

                    {loadingPortfolios ? (
                        <div className="parqet-info-banner">
                            Portfolios werden geladen...
                        </div>
                    ) : null}

                    {errorMessage ? (
                        <div className="parqet-error-banner">
                            <strong>Fehler</strong>
                            <div>{errorMessage}</div>
                        </div>
                    ) : null}

                    <StatsGrid stats={stats} />

                    <div className="parqet-section-stack">
                        <CollapsibleAssetTableSection
                            title="Wertpapiere"
                            subtitle="Offene Positionen über alle ausgewählten Portfolios"
                            assets={sortedActiveAssets}
                            defaultExpanded={true}
                            onAuditAssetAction={handleAuditAsset}
                        />

                        <CollapsibleAssetTableSection
                            title="Geschlossene Wertpapiere"
                            subtitle="Positionen ohne aktuellen Bestand"
                            assets={sortedClosedAssets}
                            defaultExpanded={false}
                            onAuditAssetAction={handleAuditAsset}
                        />
                    </div>
                </div>
            </div>

            <DataWarningsPanel
                warnings={consistencyReport?.assetsWithWarnings ?? []}
                reconciliationWarnings={reconciliationWarnings}
                isOpen={showWarningsPanel}
                onCloseAction={() => setShowWarningsPanel(false)}
            />

            <AssetAuditPanel
                asset={auditAsset}
                data={auditData}
                loading={loadingAudit}
                error={auditError}
                isOpen={Boolean(auditAsset)}
                onCloseAction={handleCloseAudit}
            />
        </main>
    );
}
