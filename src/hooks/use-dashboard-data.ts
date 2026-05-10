"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    enrichAssetsWithMetadata,
    getMissingMetadataIsins,
} from "../lib/asset-metadata";
import {
    loadDashboardCache,
    saveDashboardCache,
    type DashboardCache,
} from "../lib/dashboard-cache";
import {
    loadPortfolioScope,
    resolvePortfolioScope,
    saveKnownPortfolios,
    savePortfolioScope,
    type PortfolioScope,
} from "../lib/app-settings";
import {
    buildDashboardStats,
    isDashboardDataStale,
    sortActiveAssets,
    sortClosedAssets,
} from "../lib/dashboard-helpers";
import type {
    AssetSummary,
    AssetsApiResponse,
    ConsistencyReport,
    DashboardStats,
    Portfolio,
    PortfoliosApiResponse,
    ReconciliationWarning,
} from "../lib/types";
import { usePortfolioFilter } from "./use-portfolio-filter";

type UseDashboardDataResult = {
    portfolios: Portfolio[];
    selectedPortfolioIds: string[];
    draftPortfolioIds: string[];
    selectedPortfolioCount: number;
    isPortfolioDropdownOpen: boolean;
    showWarningsPanel: boolean;
    portfolioDropdownRef: React.RefObject<HTMLDivElement | null>;

    activeAssets: AssetSummary[];
    closedAssets: AssetSummary[];
    sortedActiveAssets: AssetSummary[];
    sortedClosedAssets: AssetSummary[];

    rawActivityCount: number;
    filteredActivityCount: number;
    assetCount: number;
    activeAssetCount: number;
    closedAssetCount: number;
    consistencyReport: ConsistencyReport | null;
    reconciliationWarnings: ReconciliationWarning[];
    lastUpdatedAt: string | null;
    hasPendingPortfolioSelection: boolean;
    missingPortfolioScopeIds: string[];
    usedPortfolioScopeFallback: boolean;

    loadingPortfolios: boolean;
    loadingAssets: boolean;
    refreshingAssets: boolean;
    hasCachedData: boolean;
    errorMessage: string;
    authRequired: boolean;
    reconnectUrl: string;

    stats: DashboardStats;
    showStaleWarning: boolean;

    setIsPortfolioDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setShowWarningsPanel: React.Dispatch<React.SetStateAction<boolean>>;

    toggleDraftPortfolio: (portfolioId: string) => void;
    applyPortfolioFilter: () => void;
    resetPortfolioFilter: () => void;
    loadAssets: () => Promise<void>;
    startReconnect: () => void;
};

function haveSamePortfolioSelection(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
        return false;
    }

    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();

    return sortedLeft.every((id, index) => id === sortedRight[index]);
}

export function useDashboardData(): UseDashboardDataResult {
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [showWarningsPanel, setShowWarningsPanel] = useState(false);

    const {
        selectedPortfolioIds,
        draftPortfolioIds,
        isPortfolioDropdownOpen,
        portfolioDropdownRef,
        setIsPortfolioDropdownOpen,
        toggleDraftPortfolio,
        applyPortfolioFilter,
        resetPortfolioFilter: resetPortfolioFilterInternal,
        hydratePortfolioSelection,
    } = usePortfolioFilter();

    const [activeAssets, setActiveAssets] = useState<AssetSummary[]>([]);
    const [closedAssets, setClosedAssets] = useState<AssetSummary[]>([]);
    const [rawActivityCount, setRawActivityCount] = useState(0);
    const [filteredActivityCount, setFilteredActivityCount] = useState(0);
    const [assetCount, setAssetCount] = useState(0);
    const [activeAssetCount, setActiveAssetCount] = useState(0);
    const [closedAssetCount, setClosedAssetCount] = useState(0);
    const [consistencyReport, setConsistencyReport] =
        useState<ConsistencyReport | null>(null);
    const [reconciliationWarnings, setReconciliationWarnings] = useState<
        ReconciliationWarning[]
    >([]);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
    const [lastLoadedPortfolioIds, setLastLoadedPortfolioIds] = useState<string[]>([]);
    const [portfolioScope, setPortfolioScope] = useState<PortfolioScope>(() => loadPortfolioScope());
    const [missingPortfolioScopeIds, setMissingPortfolioScopeIds] = useState<string[]>([]);
    const [usedPortfolioScopeFallback, setUsedPortfolioScopeFallback] = useState(false);

    const [loadingPortfolios, setLoadingPortfolios] = useState(true);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [refreshingAssets, setRefreshingAssets] = useState(false);
    const [hasCachedData, setHasCachedData] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [authRequired, setAuthRequired] = useState(false);
    const [reconnectUrl, setReconnectUrl] = useState("/api/auth/start");
    const assetLoadInFlightRef = useRef(false);

    function applyAuthState(message?: string, url?: string) {
        setAuthRequired(true);
        setReconnectUrl(url || "/api/auth/start");
        setErrorMessage(
            message || "Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden."
        );
    }

    function clearAuthState() {
        setAuthRequired(false);
        setReconnectUrl("/api/auth/start");
    }

    function startReconnect() {
        window.location.href = reconnectUrl || "/api/auth/start";
    }

    useEffect(() => {
        async function loadPortfolios() {
            setLoadingPortfolios(true);
            setErrorMessage("");

            try {
                const res = await fetch("/api/parqet/portfolios");
                const rawText = await res.text();
                const data: PortfoliosApiResponse = JSON.parse(rawText);

                if (!data.ok) {
                    if (data.authRequired) {
                        applyAuthState(data.message, data.reconnectUrl);
                        return;
                    }

                    throw new Error(data.message || "Portfolios konnten nicht geladen werden.");
                }

                clearAuthState();

                const items = data.portfolios?.items ?? [];
                setPortfolios(items);
                saveKnownPortfolios(items);

                const scope = loadPortfolioScope();
                const resolvedScope = resolvePortfolioScope(scope, items);

                setPortfolioScope(resolvedScope.scope);
                setMissingPortfolioScopeIds(resolvedScope.missingPortfolioIds);
                setUsedPortfolioScopeFallback(resolvedScope.usedFallback);
                hydratePortfolioSelection(resolvedScope.selectedPortfolioIds);

                if (resolvedScope.usedFallback) {
                    savePortfolioScope(resolvedScope.scope);
                }
            } catch (error) {
                setErrorMessage(
                    `Portfolios konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)
                    }`
                );
            } finally {
                setLoadingPortfolios(false);
            }
        }

        loadPortfolios();
    }, [hydratePortfolioSelection]);

    useEffect(() => {
        const cached = loadDashboardCache();

        if (!cached) {
            return;
        }

        setActiveAssets(enrichAssetsWithMetadata(cached.activeAssets ?? []));
        setClosedAssets(enrichAssetsWithMetadata(cached.closedAssets ?? []));
        setRawActivityCount(cached.rawActivityCount ?? 0);
        setFilteredActivityCount(cached.filteredActivityCount ?? 0);
        setAssetCount(cached.assetCount ?? 0);
        setActiveAssetCount(cached.activeAssetCount ?? 0);
        setClosedAssetCount(cached.closedAssetCount ?? 0);
        setConsistencyReport(cached.consistencyReport ?? null);
        setReconciliationWarnings(cached.reconciliationWarnings ?? []);
        setLastUpdatedAt(cached.lastUpdatedAt ?? null);
        setLastLoadedPortfolioIds(cached.selectedPortfolioIds ?? []);
        setHasCachedData(true);

        if (cached.selectedPortfolioIds?.length) {
            hydratePortfolioSelection(cached.selectedPortfolioIds);
        }
    }, [hydratePortfolioSelection]);

    async function loadAssets() {
        if (assetLoadInFlightRef.current) {
            return;
        }

        assetLoadInFlightRef.current = true;
        const hasVisibleData = activeAssets.length > 0 || closedAssets.length > 0;
        setLoadingAssets(!hasVisibleData);
        setRefreshingAssets(hasVisibleData);
        setErrorMessage("");

        try {
            const params = new URLSearchParams();

            for (const portfolioId of selectedPortfolioIds) {
                params.append("portfolioId", portfolioId);
            }

            const res = await fetch(`/api/parqet/assets?${params.toString()}`);
            const rawText = await res.text();
            const data: AssetsApiResponse = JSON.parse(rawText);

            if (!data.ok) {
                if (data.authRequired) {
                    applyAuthState(data.message, data.reconnectUrl);
                    return;
                }

                throw new Error(data.message || "Assets konnten nicht geladen werden.");
            }

            clearAuthState();

            const nextActiveAssets = enrichAssetsWithMetadata(data.activeAssets ?? []);
            const nextClosedAssets = enrichAssetsWithMetadata(data.closedAssets ?? []);
            const nextGeneratedAt = data.generatedAt ?? new Date().toISOString();

            const missingMetadataIsins = getMissingMetadataIsins([
                ...nextActiveAssets,
                ...nextClosedAssets,
            ]);

            console.log("Fehlende Asset-Metadaten:", missingMetadataIsins);
            console.log("Reconciliation-Warnungen:", data.reconciliationWarnings ?? []);

            setActiveAssets(nextActiveAssets);
            setClosedAssets(nextClosedAssets);
            setRawActivityCount(data.rawActivityCount ?? 0);
            setFilteredActivityCount(data.filteredActivityCount ?? 0);
            setAssetCount(data.assetCount ?? 0);
            setActiveAssetCount(data.activeAssetCount ?? nextActiveAssets.length);
            setClosedAssetCount(data.closedAssetCount ?? nextClosedAssets.length);
            setConsistencyReport(data.consistencyReport ?? null);
            setReconciliationWarnings(data.reconciliationWarnings ?? []);
            setLastUpdatedAt(nextGeneratedAt);
            setLastLoadedPortfolioIds(selectedPortfolioIds);
            setHasCachedData(true);

            const cachePayload: DashboardCache = {
                activeAssets: nextActiveAssets,
                closedAssets: nextClosedAssets,
                rawActivityCount: data.rawActivityCount ?? 0,
                filteredActivityCount: data.filteredActivityCount ?? 0,
                assetCount: data.assetCount ?? 0,
                activeAssetCount: data.activeAssetCount ?? nextActiveAssets.length,
                closedAssetCount: data.closedAssetCount ?? nextClosedAssets.length,
                consistencyReport: data.consistencyReport ?? null,
                reconciliationWarnings: data.reconciliationWarnings ?? [],
                generatedAt: nextGeneratedAt,
                lastUpdatedAt: nextGeneratedAt,
                selectedPortfolioIds,
            };

            saveDashboardCache(cachePayload);
        } catch (error) {
            setErrorMessage(
                `Assets konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)
                }`
            );
        } finally {
            assetLoadInFlightRef.current = false;
            setLoadingAssets(false);
            setRefreshingAssets(false);
        }
    }

    function applyPortfolioFilterWithPersistence() {
        const allIds = portfolios.map((portfolio) => portfolio.id);
        const nextScope: PortfolioScope = haveSamePortfolioSelection(draftPortfolioIds, allIds)
            ? { mode: "all", selectedPortfolioIds: [] }
            : { mode: "manual", selectedPortfolioIds: draftPortfolioIds };

        savePortfolioScope(nextScope);
        setPortfolioScope(nextScope);
        setMissingPortfolioScopeIds([]);
        setUsedPortfolioScopeFallback(false);
        applyPortfolioFilter();
    }

    function resetPortfolioFilter() {
        const allIds = portfolios.map((portfolio) => portfolio.id);
        resetPortfolioFilterInternal(allIds);
    }

    const selectedPortfolioCount = useMemo(() => {
        return portfolios.filter((portfolio) =>
            selectedPortfolioIds.includes(portfolio.id)
        ).length;
    }, [portfolios, selectedPortfolioIds]);

    const hasPendingPortfolioSelection = useMemo(() => {
        return hasCachedData && !haveSamePortfolioSelection(selectedPortfolioIds, lastLoadedPortfolioIds);
    }, [hasCachedData, selectedPortfolioIds, lastLoadedPortfolioIds]);

    useEffect(() => {
        if (portfolios.length === 0) {
            return;
        }

        const resolvedScope = resolvePortfolioScope(portfolioScope, portfolios);
        setMissingPortfolioScopeIds(resolvedScope.missingPortfolioIds);
        setUsedPortfolioScopeFallback(resolvedScope.usedFallback);
    }, [portfolioScope, portfolios]);

    const stats: DashboardStats = useMemo(() => {
        return buildDashboardStats({
            activeAssets,
            closedAssets,
            rawActivityCount,
            filteredActivityCount,
            assetCount,
            activeAssetCount,
            closedAssetCount,
        });
    }, [
        activeAssets,
        closedAssets,
        rawActivityCount,
        filteredActivityCount,
        assetCount,
        activeAssetCount,
        closedAssetCount,
    ]);

    const sortedActiveAssets = useMemo(() => {
        return sortActiveAssets(activeAssets);
    }, [activeAssets]);

    const sortedClosedAssets = useMemo(() => {
        return sortClosedAssets(closedAssets);
    }, [closedAssets]);

    const showStaleWarning = useMemo(() => {
        return isDashboardDataStale(lastUpdatedAt);
    }, [lastUpdatedAt]);

    return {
        portfolios,
        selectedPortfolioIds,
        draftPortfolioIds,
        selectedPortfolioCount,
        isPortfolioDropdownOpen,
        showWarningsPanel,
        portfolioDropdownRef,

        activeAssets,
        closedAssets,
        sortedActiveAssets,
        sortedClosedAssets,

        rawActivityCount,
        filteredActivityCount,
        assetCount,
        activeAssetCount,
        closedAssetCount,
        consistencyReport,
        reconciliationWarnings,
        lastUpdatedAt,
        hasPendingPortfolioSelection,
        missingPortfolioScopeIds,
        usedPortfolioScopeFallback,

        loadingPortfolios,
        loadingAssets,
        refreshingAssets,
        hasCachedData,
        errorMessage,
        authRequired,
        reconnectUrl,

        stats,
        showStaleWarning,

        setIsPortfolioDropdownOpen,
        setShowWarningsPanel,

        toggleDraftPortfolio,
        applyPortfolioFilter: applyPortfolioFilterWithPersistence,
        resetPortfolioFilter,
        loadAssets,
        startReconnect,
    };
}
