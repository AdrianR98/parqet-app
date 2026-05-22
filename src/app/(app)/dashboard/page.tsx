"use client";

import CollapsibleAssetTableSection from "../../../components/dashboard/CollapsibleAssetTableSection";
import DataWarningsPanel from "../../../components/dashboard/DataWarningsPanel";
import HeroSection, { type AllocationSegment } from "../../../components/dashboard/HeroSection";
import { useDashboardData } from "../../../hooks/use-dashboard-data";
import type { AssetSummary } from "../../../lib/types";

function getAssetTypeLabel(asset: AssetSummary): "Kryptowährungen" | "Wertpapiere" | "Sonstige" {
    const typeCandidate = [asset.metadata?.assetType, asset.externalMetadata?.assetType, asset.assetMeta?.assetType]
        .find((value) => typeof value === "string")
        ?.toLowerCase() ?? "";

    if (typeCandidate.includes("crypto") || typeCandidate.includes("coin") || typeCandidate.includes("token")) {
        return "Kryptowährungen";
    }

    if (typeCandidate.length > 0) {
        return "Wertpapiere";
    }

    return "Sonstige";
}

function isCryptoAsset(asset: AssetSummary): boolean {
    return getAssetTypeLabel(asset) === "Kryptowährungen";
}

function buildAllocationSegments(assets: AssetSummary[]): AllocationSegment[] {
    const groups: Record<string, number> = {
        Wertpapiere: 0,
        Kryptowährungen: 0,
        Sonstige: 0,
    };

    for (const asset of assets) {
        const positionValue = asset.positionValue ?? 0;

        if (positionValue <= 0) {
            continue;
        }

        const key = getAssetTypeLabel(asset);
        groups[key] += positionValue;
    }

    const total = Object.values(groups).reduce((sum, value) => sum + value, 0);

    if (total <= 0) {
        return [];
    }

    return [
        { label: "Wertpapiere", value: groups.Wertpapiere, color: "#78a7da" },
        { label: "Kryptowährungen", value: groups.Kryptowährungen, color: "#9dc0e4" },
        { label: "Sonstige", value: groups.Sonstige, color: "#bfd5eb" },
    ].filter((segment) => segment.value > 0);
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
    const allocationSegments = buildAllocationSegments(sortedActiveAssets);

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
                        allocationSegments={allocationSegments}
                    />

                    {refreshingAssets ? <div className="ui-banner ui-banner-info">Manuelle Aktualisierung läuft. Der letzte geladene Stand bleibt sichtbar.</div> : null}
                    {errorMessage ? <div className="ui-banner ui-banner-error"><strong>{authRequired ? "Parqet-Verbindung abgelaufen" : "Fehler"}</strong><div>{errorMessage}</div>{authRequired ? <div className="ui-banner-actions"><button type="button" className="ui-btn ui-btn-secondary" onClick={startReconnect}>Erneut verbinden</button></div> : null}</div> : null}

                    <div className="app-section-stack">
                        <CollapsibleAssetTableSection title="Wertpapiere" assets={activeSecurities} loading={loadingAssets && !hasCachedData} defaultExpanded={true} />
                        <CollapsibleAssetTableSection title="Kryptowährungen" assets={activeCrypto} loading={loadingAssets && !hasCachedData} defaultExpanded={true} />
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
