"use client";

import { useMemo, useState } from "react";
import CollapsibleAssetTableSection from "../../../components/dashboard/CollapsibleAssetTableSection";
import DataWarningsPanel from "../../../components/dashboard/DataWarningsPanel";
import HeroSection, { type AllocationSegment } from "../../../components/dashboard/HeroSection";
import { useDashboardData } from "../../../hooks/use-dashboard-data";
import { getAssetDisplayName, getAssetSubtitle } from "../../../lib/asset-display";
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
    const validAssets = assets
        .map((asset) => ({ label: getAssetDisplayName(asset), value: asset.positionValue ?? 0 }))
        .filter((asset) => asset.value > 0)
        .sort((left, right) => right.value - left.value);

    if (validAssets.length === 0) {
        return [];
    }

    const palette = ["#78a7da", "#8bb4e0", "#a2c2e7", "#b7d0ed", "#ccdef3"];
    const topAssets = validAssets.slice(0, 5);
    const remainder = validAssets.slice(5).reduce((sum, asset) => sum + asset.value, 0);
    const segments: AllocationSegment[] = topAssets.map((asset, index) => ({
        label: asset.label,
        value: asset.value,
        color: palette[index] ?? palette[palette.length - 1],
    }));

    if (remainder > 0) {
        segments.push({ label: "Weitere", value: remainder, color: "#dce8f5" });
    }

    return segments;
}

function matchesSearch(asset: AssetSummary, query: string): boolean {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return true;
    }

    const haystack = [
        getAssetDisplayName(asset),
        getAssetSubtitle(asset),
        asset.isin,
        asset.symbol,
        asset.ticker,
        asset.tickerSymbol,
        asset.portfolioNames.join(" "),
    ]
        .filter((entry): entry is string => Boolean(entry))
        .join(" ")
        .toLowerCase();

    return haystack.includes(normalizedQuery);
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
    const [searchQuery, setSearchQuery] = useState("");

    const activeSecurities = useMemo(() => sortedActiveAssets.filter((asset) => !isCryptoAsset(asset)), [sortedActiveAssets]);
    const activeCrypto = useMemo(() => sortedActiveAssets.filter((asset) => isCryptoAsset(asset)), [sortedActiveAssets]);
    const soldSecurities = useMemo(() => sortedClosedAssets.filter((asset) => !isCryptoAsset(asset)), [sortedClosedAssets]);
    const soldCrypto = useMemo(() => sortedClosedAssets.filter((asset) => isCryptoAsset(asset)), [sortedClosedAssets]);
    const allocationSegments = useMemo(() => buildAllocationSegments(activeSecurities), [activeSecurities]);

    const filteredActiveSecurities = useMemo(() => activeSecurities.filter((asset) => matchesSearch(asset, searchQuery)), [activeSecurities, searchQuery]);
    const filteredActiveCrypto = useMemo(() => activeCrypto.filter((asset) => matchesSearch(asset, searchQuery)), [activeCrypto, searchQuery]);
    const filteredSoldSecurities = useMemo(() => soldSecurities.filter((asset) => matchesSearch(asset, searchQuery)), [soldSecurities, searchQuery]);
    const filteredSoldCrypto = useMemo(() => soldCrypto.filter((asset) => matchesSearch(asset, searchQuery)), [soldCrypto, searchQuery]);

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
                        searchQuery={searchQuery}
                        onSearchQueryChange={setSearchQuery}
                        totalPositionValue={stats.totalPositionValue}
                        totalUnrealizedPnL={stats.totalUnrealizedPnL}
                        totalDividendNet={stats.totalDividendNet}
                        allocationSegments={allocationSegments}
                    />

                    {refreshingAssets ? <div className="ui-banner ui-banner-info">Manuelle Aktualisierung läuft. Der letzte geladene Stand bleibt sichtbar.</div> : null}
                    {errorMessage ? <div className="ui-banner ui-banner-error"><strong>{authRequired ? "Parqet-Verbindung abgelaufen" : "Fehler"}</strong><div>{errorMessage}</div>{authRequired ? <div className="ui-banner-actions"><button type="button" className="ui-btn ui-btn-secondary" onClick={startReconnect}>Erneut verbinden</button></div> : null}</div> : null}

                    <div className="app-section-stack">
                        <CollapsibleAssetTableSection title="Wertpapiere" assets={filteredActiveSecurities} loading={loadingAssets && !hasCachedData} defaultExpanded={true} />
                        <CollapsibleAssetTableSection title="Kryptowährungen" assets={filteredActiveCrypto} loading={loadingAssets && !hasCachedData} defaultExpanded={true} />
                        <CollapsibleAssetTableSection title="Verkaufte Wertpapiere" subtitle="Geschlossene Positionen" assets={filteredSoldSecurities} loading={loadingAssets && !hasCachedData} defaultExpanded={false} />
                        <CollapsibleAssetTableSection title="Verkaufte Kryptowährungen" subtitle="Geschlossene Positionen" assets={filteredSoldCrypto} loading={loadingAssets && !hasCachedData} defaultExpanded={false} />
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
