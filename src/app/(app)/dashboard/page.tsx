"use client";

import CollapsibleAssetTableSection from "../../../components/dashboard/CollapsibleAssetTableSection";
import DataWarningsPanel from "../../../components/dashboard/DataWarningsPanel";
import AssetAuditPanel from "../../../components/dashboard/AssetAuditPanel";
import HeroSection from "../../../components/dashboard/HeroSection";
import StatsGrid from "../../../components/dashboard/StatsGrid";
import { useDashboardData } from "../../../hooks/use-dashboard-data";
import { useAssetAudit } from "../../../hooks/use-asset-audit";
import { useState } from "react";
import type { AssetSummary } from "../../../lib/types";

export default function DashboardPage() {
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
        authRequired,
        startReconnect,

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
        authRequired: auditAuthRequired,
        loadAudit,
        resetAudit,
        startReconnect: startAuditReconnect,
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
        <>
            <div className="parqet-content" ref={portfolioDropdownRef}>
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
                        <strong>{authRequired ? "Parqet-Verbindung abgelaufen" : "Fehler"}</strong>
                        <div>{errorMessage}</div>

                        {authRequired ? (
                            <div className="parqet-banner-actions">
                                <button
                                    type="button"
                                    className="parqet-banner-button"
                                    onClick={startReconnect}
                                >
                                    Erneut verbinden
                                </button>
                            </div>
                        ) : null}
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
                authRequired={auditAuthRequired}
                isOpen={Boolean(auditAsset)}
                onCloseAction={handleCloseAudit}
                onReconnectAction={startAuditReconnect}
                onOverridesSavedAction={async () => {
                    await loadAssets();

                    if (auditAsset) {
                        await handleAuditAsset(auditAsset);
                    }
                }}
            />
        </>
    );
}