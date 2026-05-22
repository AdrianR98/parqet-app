"use client";

import { useMemo, useState } from "react";
import CollapsibleAssetTableSection from "../../../components/dashboard/CollapsibleAssetTableSection";
import DataWarningsPanel from "../../../components/dashboard/DataWarningsPanel";
import HeroSection, { type AllocationSegment } from "../../../components/dashboard/HeroSection";
import { useDashboardData } from "../../../hooks/use-dashboard-data";
import { getAssetDisplayName, getAssetSubtitle } from "../../../lib/asset-display";
import type { AssetSummary } from "../../../lib/types";

const CLOSED_POSITION_EPSILON = 1e-8;

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

function scopeAssetToSelection(asset: AssetSummary, selectedPortfolioIds: string[]): AssetSummary | null {
    const selectedSet = new Set(selectedPortfolioIds);
    const breakdown = asset.portfolioBreakdown.filter((entry) => selectedSet.has(entry.portfolioId));

    if (breakdown.length === 0) {
        return null;
    }

    const hasPositionValue = breakdown.some((entry) => entry.positionValue != null);
    const hasUnrealizedPnL = breakdown.some((entry) => entry.unrealizedPnL != null);
    const netShares = breakdown.reduce((sum, entry) => sum + entry.netShares, 0);
    const remainingCostBasis = breakdown.reduce((sum, entry) => sum + entry.remainingCostBasis, 0);
    const totalDividendNet = breakdown.reduce((sum, entry) => sum + entry.totalDividendNet, 0);
    const positionValue = breakdown.reduce((sum, entry) => sum + (entry.positionValue ?? 0), 0);
    const unrealizedPnL = breakdown.reduce((sum, entry) => sum + (entry.unrealizedPnL ?? 0), 0);

    return {
        ...asset,
        portfolioBreakdown: breakdown,
        portfolioIds: breakdown.map((entry) => entry.portfolioId),
        portfolioNames: breakdown.map((entry) => entry.portfolioName),
        netShares,
        remainingCostBasis,
        avgBuyPrice: netShares > 0 ? remainingCostBasis / netShares : null,
        positionValue: hasPositionValue ? positionValue : null,
        unrealizedPnL: hasUnrealizedPnL ? unrealizedPnL : null,
        totalDividendNet,
    };
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
        portfolios, selectedPortfolioIds, draftPortfolioIds, isPortfolioDropdownOpen, showWarningsPanel, portfolioDropdownRef,
        consistencyReport, reconciliationWarnings,
        loadingAssets, refreshingAssets, hasCachedData, errorMessage, authRequired, startReconnect,
        sortedActiveAssets, sortedClosedAssets,
        setIsPortfolioDropdownOpen, setShowWarningsPanel,
        toggleDraftPortfolio, applyPortfolioFilter, resetPortfolioFilter, loadAssets,
    } = useDashboardData();
    const [searchQuery, setSearchQuery] = useState("");

    const scopedAssets = useMemo(() => {
        const allAssets = [...sortedActiveAssets, ...sortedClosedAssets];
        return allAssets
            .map((asset) => scopeAssetToSelection(asset, selectedPortfolioIds))
            .filter((asset): asset is AssetSummary => asset != null);
    }, [selectedPortfolioIds, sortedActiveAssets, sortedClosedAssets]);

    const activeAssets = useMemo(
        () => scopedAssets
            .filter((asset) => asset.netShares > CLOSED_POSITION_EPSILON)
            .sort((left, right) => (right.positionValue ?? 0) - (left.positionValue ?? 0)),
        [scopedAssets],
    );
    const closedAssets = useMemo(
        () => scopedAssets
            .filter((asset) => asset.netShares <= CLOSED_POSITION_EPSILON)
            .sort((left, right) => (right.positionValue ?? 0) - (left.positionValue ?? 0)),
        [scopedAssets],
    );
    const activeSecurities = useMemo(() => activeAssets.filter((asset) => !isCryptoAsset(asset)), [activeAssets]);
    const activeCrypto = useMemo(() => activeAssets.filter((asset) => isCryptoAsset(asset)), [activeAssets]);
    const soldSecurities = useMemo(() => closedAssets.filter((asset) => !isCryptoAsset(asset)), [closedAssets]);
    const soldCrypto = useMemo(() => closedAssets.filter((asset) => isCryptoAsset(asset)), [closedAssets]);
    const allocationSegments = useMemo(() => buildAllocationSegments(activeSecurities), [activeSecurities]);
    const scopedTotals = useMemo(() => ({
        totalPositionValue: scopedAssets.reduce((sum, asset) => sum + (asset.positionValue ?? 0), 0),
        totalUnrealizedPnL: scopedAssets.reduce((sum, asset) => sum + (asset.unrealizedPnL ?? 0), 0),
        totalDividendNet: scopedAssets.reduce((sum, asset) => sum + (asset.totalDividendNet ?? 0), 0),
    }), [scopedAssets]);

    const filteredActiveSecurities = useMemo(() => activeSecurities.filter((asset) => matchesSearch(asset, searchQuery)), [activeSecurities, searchQuery]);
    const filteredActiveCrypto = useMemo(() => activeCrypto.filter((asset) => matchesSearch(asset, searchQuery)), [activeCrypto, searchQuery]);
    const filteredSoldSecurities = useMemo(() => soldSecurities.filter((asset) => matchesSearch(asset, searchQuery)), [soldSecurities, searchQuery]);
    const filteredSoldCrypto = useMemo(() => soldCrypto.filter((asset) => matchesSearch(asset, searchQuery)), [soldCrypto, searchQuery]);

    return (
        <>
            <div className="app-content">
                <div className="app-stack">
                    <HeroSection
                        portfolios={portfolios}
                        selectedPortfolioIds={selectedPortfolioIds}
                        draftPortfolioIds={draftPortfolioIds}
                        loadingAssets={loadingAssets}
                        refreshingAssets={refreshingAssets}
                        hasCachedData={hasCachedData}
                        isPortfolioDropdownOpen={isPortfolioDropdownOpen}
                        onToggleOpen={() => setIsPortfolioDropdownOpen((current) => !current)}
                        onToggleDraftPortfolio={toggleDraftPortfolio}
                        onApply={applyPortfolioFilter}
                        onReset={resetPortfolioFilter}
                        portfolioDropdownRef={portfolioDropdownRef}
                        onLoadAssets={loadAssets}
                        searchQuery={searchQuery}
                        onSearchQueryChange={setSearchQuery}
                        totalPositionValue={scopedTotals.totalPositionValue}
                        totalUnrealizedPnL={scopedTotals.totalUnrealizedPnL}
                        totalDividendNet={scopedTotals.totalDividendNet}
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
