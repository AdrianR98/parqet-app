"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AssetTable from "../../components/dashboard/AssetTable";
import DataWarningsPanel from "../../components/dashboard/DataWarningsPanel";
import HeaderBar from "../../components/dashboard/HeaderBar";
import HeroSection from "../../components/dashboard/HeroSection";
import StatsGrid from "../../components/dashboard/StatsGrid";
import type {
    AssetSummary,
    AssetsApiResponse,
    ConsistencyReport,
    DashboardStats,
    Portfolio,
    PortfoliosApiResponse,
} from "../../lib/types";

const CACHE_KEY = "parqet-dashboard-cache-v1";
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

type DashboardCache = {
    activeAssets: AssetSummary[];
    closedAssets: AssetSummary[];
    rawActivityCount: number;
    filteredActivityCount: number;
    assetCount: number;
    activeAssetCount: number;
    closedAssetCount: number;
    consistencyReport: ConsistencyReport | null;
    lastUpdatedAt: string | null;
    selectedPortfolioIds: string[];
};

export default function DashboardPage() {
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([]);
    const [draftPortfolioIds, setDraftPortfolioIds] = useState<string[]>([]);
    const [isPortfolioDropdownOpen, setIsPortfolioDropdownOpen] = useState(false);
    const [showWarningsPanel, setShowWarningsPanel] = useState(false);
    const portfolioDropdownRef = useRef<HTMLDivElement | null>(null);

    const [activeAssets, setActiveAssets] = useState<AssetSummary[]>([]);
    const [closedAssets, setClosedAssets] = useState<AssetSummary[]>([]);
    const [rawActivityCount, setRawActivityCount] = useState(0);
    const [filteredActivityCount, setFilteredActivityCount] = useState(0);
    const [assetCount, setAssetCount] = useState(0);
    const [activeAssetCount, setActiveAssetCount] = useState(0);
    const [closedAssetCount, setClosedAssetCount] = useState(0);
    const [consistencyReport, setConsistencyReport] =
        useState<ConsistencyReport | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

    const [loadingPortfolios, setLoadingPortfolios] = useState(true);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [theme, setTheme] = useState<"dark" | "light">("dark");
    const [errorMessage, setErrorMessage] = useState("");

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

                const cachedRaw = localStorage.getItem(CACHE_KEY);

                if (cachedRaw) {
                    try {
                        const cached: DashboardCache = JSON.parse(cachedRaw);
                        const cachedIds = cached.selectedPortfolioIds ?? [];

                        if (cachedIds.length > 0) {
                            setSelectedPortfolioIds(cachedIds);
                            setDraftPortfolioIds(cachedIds);
                        } else {
                            setSelectedPortfolioIds(allIds);
                            setDraftPortfolioIds(allIds);
                        }
                    } catch {
                        setSelectedPortfolioIds(allIds);
                        setDraftPortfolioIds(allIds);
                    }
                } else {
                    setSelectedPortfolioIds(allIds);
                    setDraftPortfolioIds(allIds);
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
    }, []);

    useEffect(() => {
        try {
            const cachedRaw = localStorage.getItem(CACHE_KEY);

            if (!cachedRaw) {
                return;
            }

            const cached: DashboardCache = JSON.parse(cachedRaw);

            setActiveAssets(cached.activeAssets ?? []);
            setClosedAssets(cached.closedAssets ?? []);
            setRawActivityCount(cached.rawActivityCount ?? 0);
            setFilteredActivityCount(cached.filteredActivityCount ?? 0);
            setAssetCount(cached.assetCount ?? 0);
            setActiveAssetCount(cached.activeAssetCount ?? 0);
            setClosedAssetCount(cached.closedAssetCount ?? 0);
            setConsistencyReport(cached.consistencyReport ?? null);
            setLastUpdatedAt(cached.lastUpdatedAt ?? null);

            if ((cached.consistencyReport?.warningCount ?? 0) > 0) {
                setShowWarningsPanel(true);
            }

            if (cached.selectedPortfolioIds?.length) {
                setSelectedPortfolioIds(cached.selectedPortfolioIds);
                setDraftPortfolioIds(cached.selectedPortfolioIds);
            }
        } catch {
            // kaputten Cache ignorieren
        }
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                portfolioDropdownRef.current &&
                !portfolioDropdownRef.current.contains(event.target as Node)
            ) {
                setIsPortfolioDropdownOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    function toggleDraftPortfolio(portfolioId: string) {
        setDraftPortfolioIds((current) => {
            if (current.includes(portfolioId)) {
                return current.filter((id) => id !== portfolioId);
            }

            return [...current, portfolioId];
        });
    }

    function applyPortfolioFilter() {
        setSelectedPortfolioIds(draftPortfolioIds);
        setIsPortfolioDropdownOpen(false);
    }

    function resetPortfolioFilter() {
        const allIds = portfolios.map((portfolio) => portfolio.id);
        setDraftPortfolioIds(allIds);
    }

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

            const nextActiveAssets = data.activeAssets ?? [];
            const nextClosedAssets = data.closedAssets ?? [];
            const nextLastUpdatedAt = data.generatedAt ?? new Date().toISOString();

            setActiveAssets(nextActiveAssets);
            setClosedAssets(nextClosedAssets);
            setRawActivityCount(data.rawActivityCount ?? 0);
            setFilteredActivityCount(data.filteredActivityCount ?? 0);
            setAssetCount(data.assetCount ?? 0);
            setActiveAssetCount(data.activeAssetCount ?? nextActiveAssets.length);
            setClosedAssetCount(data.closedAssetCount ?? nextClosedAssets.length);
            setConsistencyReport(data.consistencyReport ?? null);
            setLastUpdatedAt(nextLastUpdatedAt);

            if ((data.consistencyReport?.warningCount ?? 0) > 0) {
                setShowWarningsPanel(true);
            }

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

            localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
        } catch (error) {
            setErrorMessage(
                `Assets konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)
                }`
            );
        } finally {
            setLoadingAssets(false);
        }
    }

    const selectedPortfolios = useMemo(() => {
        return portfolios.filter((portfolio) =>
            selectedPortfolioIds.includes(portfolio.id)
        );
    }, [portfolios, selectedPortfolioIds]);

    const stats: DashboardStats = useMemo(() => {
        const allAssets = [...activeAssets, ...closedAssets];

        let totalDividendNet = 0;
        let totalPositionValue = 0;
        let totalUnrealizedPnL = 0;

        for (const asset of allAssets) {
            totalDividendNet += asset.totalDividendNet;
            totalPositionValue += asset.positionValue ?? 0;
            totalUnrealizedPnL += asset.unrealizedPnL ?? 0;
        }

        return {
            rawActivityCount,
            filteredActivityCount,
            assetCount,
            activeAssetCount,
            closedAssetCount,
            totalDividendNet,
            totalPositionValue,
            totalUnrealizedPnL,
        };
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
        return [...activeAssets].sort((a, b) => {
            const aValue = a.positionValue ?? 0;
            const bValue = b.positionValue ?? 0;

            if (bValue !== aValue) {
                return bValue - aValue;
            }

            const aTime = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : 0;
            const bTime = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : 0;

            return bTime - aTime;
        });
    }, [activeAssets]);

    const sortedClosedAssets = useMemo(() => {
        return [...closedAssets].sort((a, b) => {
            const aTime = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : 0;
            const bTime = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : 0;

            return bTime - aTime;
        });
    }, [closedAssets]);

    const showStaleWarning = useMemo(() => {
        if (!lastUpdatedAt) {
            return false;
        }

        const age = Date.now() - new Date(lastUpdatedAt).getTime();
        return age > FIVE_DAYS_MS;
    }, [lastUpdatedAt]);

    return (
        <main className={`parqet-page theme-${theme}`}>
            <HeaderBar
                theme={theme}
                onToggleTheme={() =>
                    setTheme((current) => (current === "dark" ? "light" : "dark"))
                }
            />

            <div className="parqet-content" ref={portfolioDropdownRef}>
                <HeroSection
                    portfolios={portfolios}
                    selectedPortfolioIds={selectedPortfolioIds}
                    draftPortfolioIds={draftPortfolioIds}
                    selectedPortfolioCount={selectedPortfolios.length}
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
                    lastUpdatedAt={lastUpdatedAt}
                    showStaleWarning={showStaleWarning}
                    showWarningsPanel={showWarningsPanel}
                    onToggleWarningsPanel={() =>
                        setShowWarningsPanel((current) => !current)
                    }
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