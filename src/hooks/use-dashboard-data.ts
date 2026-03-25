// src/hooks/use-dashboard-data.ts

"use client";

import { useEffect, useMemo, useState } from "react";
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

    loadingPortfolios: boolean;
    loadingAssets: boolean;
    errorMessage: string;

    stats: DashboardStats;
    showStaleWarning: boolean;

    setIsPortfolioDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setShowWarningsPanel: React.Dispatch<React.SetStateAction<boolean>>;

    toggleDraftPortfolio: (portfolioId: string) => void;
    applyPortfolioFilter: () => void;
    resetPortfolioFilter: () => void;
    loadAssets: () => Promise<void>;
};

/**
 * Kapselt die komplette Daten- und Zustandslogik des Dashboards.
 *
 * Ziel:
 * - page.tsx auf Rendering reduzieren
 * - API-Loading, Cache und Ableitungen zentral halten
 * - Portfolio-Filter-Logik separat wiederverwenden
 * - spaetere Erweiterungen an einer Stelle konzentrieren
 */
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

    const [loadingPortfolios, setLoadingPortfolios] = useState(true);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    /**
     * Laedt die autorisierten Portfolios und uebernimmt dabei moeglichst
     * die zuletzt gespeicherte Portfolio-Auswahl aus dem Cache.
     */
    useEffect(() => {
        async function loadPortfolios() {
            setLoadingPortfolios(true);
            setErrorMessage("");

            try {
                const res = await fetch("/api/parqet/portfolios");
                const rawText = await res.text();
                const data: PortfoliosApiResponse = JSON.parse(rawText);

                if (!data.ok) {
                    throw new Error(data.message || "Portfolios konnten nicht geladen werden.");
                }

                const items = data.portfolios?.items ?? [];
                const allIds = items.map((item) => item.id);

                setPortfolios(items);

                const cached = loadDashboardCache();
                const cachedIds = cached?.selectedPortfolioIds ?? [];

                if (cachedIds.length > 0) {
                    hydratePortfolioSelection(cachedIds);
                } else {
                    hydratePortfolioSelection(allIds);
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

    /**
     * Stellt beim ersten Rendern den zuletzt bekannten Dashboard-Stand aus
     * dem Browser-Cache wieder her.
     *
     * Wichtig:
     * Die geladenen Cache-Assets werden direkt noch einmal mit lokaler
     * Metadata-Enrichment-Logik angereichert, damit Seed-/Cache-Metadaten
     * sofort sichtbar sind.
     *
     * Reconciliation-Warnungen werden nicht aus dem Cache rehydriert,
     * weil diese jetzt aus der neuen bereinigten Pipeline stammen und
     * moeglichst frisch vom Server kommen sollen.
     */
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
        setLastUpdatedAt(cached.lastUpdatedAt ?? null);

        if (cached.selectedPortfolioIds?.length) {
            hydratePortfolioSelection(cached.selectedPortfolioIds);
        }
    }, [hydratePortfolioSelection]);

    /**
     * Laedt die Asset-Sicht fuer die aktuell ausgewaehlten Portfolios.
     *
     * Nach dem API-Call werden die Assets zusaetzlich mit lokaler Metadata-
     * Enrichment-Logik angereichert, damit spaetere Name-/Ticker-/WKN-Daten
     * sofort in der UI zur Verfuegung stehen.
     */
    async function loadAssets() {
        setLoadingAssets(true);
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
                throw new Error(data.message || "Assets konnten nicht geladen werden.");
            }

            const nextActiveAssets = enrichAssetsWithMetadata(data.activeAssets ?? []);
            const nextClosedAssets = enrichAssetsWithMetadata(data.closedAssets ?? []);
            const nextLastUpdatedAt = data.generatedAt ?? new Date().toISOString();

            /**
             * Liste der ISINs, fuer die aktuell noch keine guten Metadaten vorliegen.
             * Das ist spaeter die ideale Grundlage fuer einen echten Metadata-Fetcher.
             */
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
            setLastUpdatedAt(nextLastUpdatedAt);

            const cachePayload: DashboardCache = {
                activeAssets: nextActiveAssets,
                closedAssets: nextClosedAssets,
                rawActivityCount: data.rawActivityCount ?? 0,
                filteredActivityCount: data.filteredActivityCount ?? 0,
                assetCount: data.assetCount ?? 0,
                activeAssetCount: data.activeAssetCount ?? nextActiveAssets.length,
                closedAssetCount: data.closedAssetCount ?? nextClosedAssets.length,
                consistencyReport: data.consistencyReport ?? null,
                lastUpdatedAt: nextLastUpdatedAt,
                selectedPortfolioIds,
            };

            saveDashboardCache(cachePayload);
        } catch (error) {
            setErrorMessage(
                `Assets konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)
                }`
            );
        } finally {
            setLoadingAssets(false);
        }
    }

    /**
     * Setzt die temporaere Auswahl auf alle verfuegbaren Portfolios zurueck.
     * Die eigentliche Zustandspflege bleibt im Portfolio-Filter-Hook.
     */
    function resetPortfolioFilter() {
        const allIds = portfolios.map((portfolio) => portfolio.id);
        resetPortfolioFilterInternal(allIds);
    }

    /**
     * Anzahl der aktuell aktiv ausgewaehlten Portfolios, rein fuer Anzeigezwecke.
     */
    const selectedPortfolioCount = useMemo(() => {
        return portfolios.filter((portfolio) =>
            selectedPortfolioIds.includes(portfolio.id)
        ).length;
    }, [portfolios, selectedPortfolioIds]);

    /**
     * Zentrale Kennzahlen fuer Hero- und Stats-Komponenten.
     */
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

    /**
     * Sortierte aktive Assets fuer die Haupttabelle.
     */
    const sortedActiveAssets = useMemo(() => {
        return sortActiveAssets(activeAssets);
    }, [activeAssets]);

    /**
     * Sortierte geschlossene Assets fuer die Historien-Tabelle.
     */
    const sortedClosedAssets = useMemo(() => {
        return sortClosedAssets(closedAssets);
    }, [closedAssets]);

    /**
     * Kennzeichnet veraltete Datenstaende fuer die UI.
     */
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

        loadingPortfolios,
        loadingAssets,
        errorMessage,

        stats,
        showStaleWarning,

        setIsPortfolioDropdownOpen,
        setShowWarningsPanel,

        toggleDraftPortfolio,
        applyPortfolioFilter,
        resetPortfolioFilter,
        loadAssets,
    };
}