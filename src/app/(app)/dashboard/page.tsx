"use client";

import { useMemo, useState } from "react";
import CollapsibleAssetTableSection from "../../../components/dashboard/CollapsibleAssetTableSection";
import DataWarningsPanel from "../../../components/dashboard/DataWarningsPanel";
import HeroSection, { type AllocationSegment } from "../../../components/dashboard/HeroSection";
import { useDashboardData } from "../../../hooks/use-dashboard-data";
import { getAssetDisplayName, getAssetSubtitle } from "../../../lib/asset-display";
import type { GlobalAssetViewModel } from "../../../lib/types";
import {
    aggregateAssetValueTotals,
    buildAllocationSegmentsFromAssets,
    scopeAssetToPortfolioSelection,
    splitAssetsByPosition,
} from "../../../lib/calculations/view-model-aggregates";
const DASHBOARD_ALLOCATION_PALETTE = [
    "var(--chart-series-1)",
    "var(--chart-series-2)",
    "var(--chart-series-3)",
    "var(--chart-series-4)",
    "var(--chart-series-5)",
    "var(--chart-series-6)",
    "var(--chart-series-7)",
    "var(--chart-series-8)",
    "var(--chart-series-9)",
    "var(--chart-series-10)",
    "var(--chart-series-11)",
    "var(--chart-series-12)",
    "var(--chart-series-13)",
    "var(--chart-series-14)",
    "var(--chart-series-15)",
] as const;

function getAssetTypeLabel(asset: GlobalAssetViewModel): "Kryptowährungen" | "Wertpapiere" | "Sonstige" {
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

function isCryptoAsset(asset: GlobalAssetViewModel): boolean {
    return getAssetTypeLabel(asset) === "Kryptowährungen";
}

function buildAllocationSegments(assets: GlobalAssetViewModel[]): AllocationSegment[] {
    return buildAllocationSegmentsFromAssets(assets, {
        maxIndividualSegments: 15,
        palette: DASHBOARD_ALLOCATION_PALETTE,
        otherColor: "var(--chart-series-other)",
        getLabel: getAssetDisplayName,
    });
}

function matchesSearch(asset: GlobalAssetViewModel, query: string): boolean {
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
        asset.portfolioNames.join(" "),
    ]
        .filter((entry): entry is string => Boolean(entry))
        .join(" ")
        .toLowerCase();

    return haystack.includes(normalizedQuery);
}

export default function DashboardPage() {
    const {
        selectedPortfolioIds, showWarningsPanel,
        consistencyReport, reconciliationWarnings, selectedPortfoliosMissingInLocalLoad,
        hasEmptyManualScopeIntersection,
        loadingAssets, refreshingAssets, hasCachedData, errorMessage, authRequired, startReconnect,
        sortedActiveAssets, sortedClosedAssets,
        setShowWarningsPanel,
    } = useDashboardData();
    const [searchQuery, setSearchQuery] = useState("");

    const scopedAssets = useMemo(() => {
        const allAssets = [...sortedActiveAssets, ...sortedClosedAssets];
        return allAssets
            .map((asset) => scopeAssetToPortfolioSelection(asset, selectedPortfolioIds))
            .filter((asset): asset is GlobalAssetViewModel => asset != null);
    }, [selectedPortfolioIds, sortedActiveAssets, sortedClosedAssets]);

    const scopedByPosition = useMemo(
        () => splitAssetsByPosition(scopedAssets),
        [scopedAssets],
    );
    const activeAssets = useMemo(
        () => [...scopedByPosition.activeAssets]
            .sort((left, right) => (right.positionValue ?? 0) - (left.positionValue ?? 0)),
        [scopedByPosition.activeAssets],
    );
    const closedAssets = useMemo(
        () => [...scopedByPosition.closedAssets]
            .sort((left, right) => (right.positionValue ?? 0) - (left.positionValue ?? 0)),
        [scopedByPosition.closedAssets],
    );
    const activeSecurities = useMemo(() => activeAssets.filter((asset) => !isCryptoAsset(asset)), [activeAssets]);
    const activeCrypto = useMemo(() => activeAssets.filter((asset) => isCryptoAsset(asset)), [activeAssets]);
    const soldSecurities = useMemo(() => closedAssets.filter((asset) => !isCryptoAsset(asset)), [closedAssets]);
    const soldCrypto = useMemo(() => closedAssets.filter((asset) => isCryptoAsset(asset)), [closedAssets]);
    const allocationSegments = useMemo(() => buildAllocationSegments(activeSecurities), [activeSecurities]);
    const scopedTotals = useMemo(() => {
        const totals = aggregateAssetValueTotals(scopedAssets);
        return {
            totalPositionValue: totals.totalPositionValue,
            totalUnrealizedPnL: totals.totalUnrealizedPnL,
            totalDividendNet: totals.totalDividendNet,
        };
    }, [scopedAssets]);

    const filteredActiveSecurities = useMemo(() => activeSecurities.filter((asset) => matchesSearch(asset, searchQuery)), [activeSecurities, searchQuery]);
    const filteredActiveCrypto = useMemo(() => activeCrypto.filter((asset) => matchesSearch(asset, searchQuery)), [activeCrypto, searchQuery]);
    const filteredSoldSecurities = useMemo(() => soldSecurities.filter((asset) => matchesSearch(asset, searchQuery)), [soldSecurities, searchQuery]);
    const filteredSoldCrypto = useMemo(() => soldCrypto.filter((asset) => matchesSearch(asset, searchQuery)), [soldCrypto, searchQuery]);

    return (
        <>
            <div className="app-content">
                <div className="app-stack">
                    <HeroSection
                        searchQuery={searchQuery}
                        onSearchQueryChange={setSearchQuery}
                        totalPositionValue={scopedTotals.totalPositionValue}
                        totalUnrealizedPnL={scopedTotals.totalUnrealizedPnL}
                        totalDividendNet={scopedTotals.totalDividendNet}
                        allocationSegments={allocationSegments}
                    />

                    {refreshingAssets ? <div className="ui-banner ui-banner-info">Manuelle Aktualisierung läuft. Der letzte geladene Stand bleibt sichtbar.</div> : null}
                    {hasCachedData && selectedPortfoliosMissingInLocalLoad.length > 0 ? (
                        <div className="ui-banner ui-banner-info">
                            Auswahl enthält noch nicht lokal geladene Portfolios.
                        </div>
                    ) : null}
                    {hasCachedData && hasEmptyManualScopeIntersection ? (
                        <div className="ui-banner ui-banner-info">
                            Für die ausgewählten Portfolios liegen lokal keine Daten vor.
                        </div>
                    ) : null}
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

