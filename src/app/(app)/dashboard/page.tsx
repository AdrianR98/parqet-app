"use client";

import CollapsibleAssetTableSection from "../../../components/dashboard/CollapsibleAssetTableSection";
import DataWarningsPanel from "../../../components/dashboard/DataWarningsPanel";
import HeroSection from "../../../components/dashboard/HeroSection";
import { useDashboardData } from "../../../hooks/use-dashboard-data";
import type { AssetSummary } from "../../../lib/types";

function isCryptoAsset(asset: AssetSummary): boolean {
    const typeCandidate = [asset.metadata?.assetType, asset.externalMetadata?.assetType, asset.assetMeta?.assetType]
        .find((value) => typeof value === "string")
        ?.toLowerCase() ?? "";
    return typeCandidate.includes("crypto") || typeCandidate.includes("coin") || typeCandidate.includes("token");
}

export default function DashboardPage() {
    const {
        portfolios, selectedPortfolioIds, draftPortfolioIds, selectedPortfolioCount, loadedPortfolioCount, isPortfolioDropdownOpen, showWarningsPanel, portfolioDropdownRef,
        assetCount, consistencyReport, reconciliationWarnings, hasPendingPortfolioSelection,
        loadingAssets, refreshingAssets, hasCachedData, errorMessage, authRequired, startReconnect,
        stats, sortedActiveAssets, sortedClosedAssets,
        setIsPortfolioDropdownOpen, setShowWarningsPanel,
        toggleDraftPortfolio, applyPortfolioFilter, resetPortfolioFilter, loadAssets,
    } = useDashboardData();

    const activeSecurities = sortedActiveAssets.filter((asset) => !isCryptoAsset(asset));
    const activeCrypto = sortedActiveAssets.filter((asset) => isCryptoAsset(asset));
    const soldSecurities = sortedClosedAssets.filter((asset) => !isCryptoAsset(asset));
    const soldCrypto = sortedClosedAssets.filter((asset) => isCryptoAsset(asset));

    return (
        <>
            <div className="app-content" ref={portfolioDropdownRef}>
                <div className="app-stack">
                    <HeroSection
                        portfolios={portfolios}
                        selectedPortfolioIds={selectedPortfolioIds}
                        draftPortfolioIds={draftPortfolioIds}
                        selectedPortfolioCount={selectedPortfolioCount}
                        loadedPortfolioCount={loadedPortfolioCount}
                        assetCount={assetCount}
                        loadingAssets={loadingAssets}
                        refreshingAssets={refreshingAssets}
                        hasCachedData={hasCachedData}
                        hasPendingPortfolioSelection={hasPendingPortfolioSelection}
                        isPortfolioDropdownOpen={isPortfolioDropdownOpen}
                        onToggleOpen={() => setIsPortfolioDropdownOpen((current) => !current)}
                        onToggleDraftPortfolio={toggleDraftPortfolio}
                        onApply={applyPortfolioFilter}
                        onReset={resetPortfolioFilter}
                        onLoadAssets={loadAssets}
                        totalPositionValue={stats.totalPositionValue}
                        totalUnrealizedPnL={stats.totalUnrealizedPnL}
                        totalDividendNet={stats.totalDividendNet}
                    />

                    {refreshingAssets ? <div className="ui-banner ui-banner-info">Manuelle Aktualisierung läuft. Der letzte geladene Stand bleibt sichtbar.</div> : null}
                    {errorMessage ? <div className="ui-banner ui-banner-error"><strong>{authRequired ? "Parqet-Verbindung abgelaufen" : "Fehler"}</strong><div>{errorMessage}</div>{authRequired ? <div className="ui-banner-actions"><button type="button" className="ui-btn ui-btn-secondary" onClick={startReconnect}>Erneut verbinden</button></div> : null}</div> : null}

                    <div className="app-section-stack">
                        <CollapsibleAssetTableSection title="Wertpapiere" subtitle="Aktive Positionen" assets={activeSecurities} loading={loadingAssets && !hasCachedData} defaultExpanded={true} />
                        <CollapsibleAssetTableSection title="Kryptowährungen" subtitle="Aktive Positionen" assets={activeCrypto} loading={loadingAssets && !hasCachedData} defaultExpanded={true} />
                        <CollapsibleAssetTableSection title="Verkaufte Wertpapiere" subtitle="Geschlossene Positionen" assets={soldSecurities} loading={loadingAssets && !hasCachedData} defaultExpanded={false} />
                        <CollapsibleAssetTableSection title="Verkaufte Kryptowährungen" subtitle="Geschlossene Positionen" assets={soldCrypto} loading={loadingAssets && !hasCachedData} defaultExpanded={false} />
                    </div>
                </div>
            </div>

            <DataWarningsPanel
                warnings={consistencyReport?.assetsWithWarnings ?? []}
                reconciliationWarnings={reconciliationWarnings}
                isOpen={showWarningsPanel}
                onCloseAction={() => setShowWarningsPanel(false)}
            />
        </>
    );
}
