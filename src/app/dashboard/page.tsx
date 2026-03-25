"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PortfolioFilter from "../../components/dashboard/PortfolioFilter";
import AssetTable from "../../components/dashboard/AssetTable";
import { formatCurrency, getPnLClass } from "../../lib/format";
import type {
    AssetSummary,
    AssetsApiResponse,
    DashboardStats,
    Portfolio,
    PortfoliosApiResponse,
} from "../../lib/types";

export default function DashboardPage() {
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([]);
    const [draftPortfolioIds, setDraftPortfolioIds] = useState<string[]>([]);
    const [isPortfolioDropdownOpen, setIsPortfolioDropdownOpen] = useState(false);
    const portfolioDropdownRef = useRef<HTMLDivElement | null>(null);

    const [assets, setAssets] = useState<AssetSummary[]>([]);
    const [rawActivityCount, setRawActivityCount] = useState(0);
    const [filteredActivityCount, setFilteredActivityCount] = useState(0);
    const [assetCount, setAssetCount] = useState(0);

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

                const items: Portfolio[] = data.portfolios?.items ?? [];
                const allIds = items.map((item: Portfolio) => item.id);

                setPortfolios(items);
                setSelectedPortfolioIds(allIds);
                setDraftPortfolioIds(allIds);
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

            setAssets(data.assets ?? []);
            setRawActivityCount(data.rawActivityCount ?? 0);
            setFilteredActivityCount(data.filteredActivityCount ?? 0);
            setAssetCount(data.assetCount ?? 0);
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
        let totalDividendNet = 0;
        let totalPositionValue = 0;
        let totalUnrealizedPnL = 0;

        for (const asset of assets) {
            totalDividendNet += asset.totalDividendNet;
            totalPositionValue += asset.positionValue ?? 0;
            totalUnrealizedPnL += asset.unrealizedPnL ?? 0;
        }

        return {
            rawActivityCount,
            filteredActivityCount,
            assetCount,
            totalDividendNet,
            totalPositionValue,
            totalUnrealizedPnL,
        };
    }, [assets, rawActivityCount, filteredActivityCount, assetCount]);

    const sortedAssets = useMemo(() => {
        return [...assets].sort((a, b) => {
            const aValue = a.positionValue ?? 0;
            const bValue = b.positionValue ?? 0;

            if (bValue !== aValue) {
                return bValue - aValue;
            }

            const aTime = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : 0;
            const bTime = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : 0;

            return bTime - aTime;
        });
    }, [assets]);

    return (
        <div className={`parqet-shell ${theme}`}>
            <aside className="parqet-sidebar">
                <div className="parqet-logo">parqet</div>

                <div className="parqet-sidebar-section">
                    <div className="parqet-sidebar-label">Ansicht</div>
                    <div className="parqet-sidebar-value">
                        {selectedPortfolios.length === 1
                            ? selectedPortfolios[0].name
                            : `${selectedPortfolios.length} Portfolios`}
                    </div>
                </div>

                <nav className="parqet-nav">
                    <button className="parqet-nav-item active">Dashboard</button>
                    <button className="parqet-nav-item">Analyse</button>
                    <button className="parqet-nav-item">Aktivitaeten</button>
                    <button className="parqet-nav-item">Dividenden</button>
                    <button className="parqet-nav-item">Portfolios</button>
                </nav>

                <div className="parqet-sidebar-footer">
                    <button
                        className="parqet-theme-toggle"
                        onClick={() =>
                            setTheme((current) => (current === "dark" ? "light" : "dark"))
                        }
                    >
                        Theme: {theme === "dark" ? "Dark" : "Light"}
                    </button>
                </div>
            </aside>

            <div className="parqet-main">
                <header className="parqet-header">
                    <div className="parqet-search">Name, WKN, ISIN, ...</div>

                    <div className="parqet-header-actions">
                        <div className="parqet-user-badge">A</div>
                        <div className="parqet-user-name">Adrian Roeschl</div>
                    </div>
                </header>

                <main className="parqet-content">
                    <section className="parqet-card parqet-hero-card">
                        <div className="parqet-hero-left">
                            <div className="parqet-donut-placeholder">
                                <div className="parqet-donut-inner">
                                    {selectedPortfolios.length}
                                    <br />
                                    PF
                                </div>
                            </div>

                            <div>
                                <h1 className="parqet-page-title">Konsolidierte Asset View</h1>
                                <div className="parqet-subtitle">
                                    {selectedPortfolios.length} Portfolio(s) · {assetCount} Assets · EUR
                                </div>
                            </div>
                        </div>

                        <div className="parqet-hero-right parqet-hero-controls" ref={portfolioDropdownRef}>
                            <div className="parqet-toolbar-link">Verwalten</div>

                            <PortfolioFilter
                                portfolios={portfolios}
                                selectedPortfolioIds={selectedPortfolioIds}
                                draftPortfolioIds={draftPortfolioIds}
                                isOpen={isPortfolioDropdownOpen}
                                onToggleOpen={() =>
                                    setIsPortfolioDropdownOpen((current) => !current)
                                }
                                onToggleDraftPortfolio={toggleDraftPortfolio}
                                onApply={applyPortfolioFilter}
                                onReset={resetPortfolioFilter}
                            />

                            <button className="parqet-primary-button" onClick={loadAssets}>
                                {loadingAssets ? "Lade..." : "Assets laden"}
                            </button>
                        </div>
                    </section>

                    {errorMessage ? (
                        <section className="parqet-card parqet-error-card">
                            <div className="parqet-card-title">Fehler</div>
                            <p>{errorMessage}</p>
                        </section>
                    ) : null}

                    <section className="parqet-kpi-grid">
                        <div className="parqet-card">
                            <div className="parqet-card-title">Roh-Activities</div>
                            <div className="parqet-kpi-value">{stats.rawActivityCount}</div>
                            <div className="parqet-kpi-sub">Alle geladenen Rohdaten</div>
                        </div>

                        <div className="parqet-card">
                            <div className="parqet-card-title">Bereinigte Activities</div>
                            <div className="parqet-kpi-value">{stats.filteredActivityCount}</div>
                            <div className="parqet-kpi-sub">Nur echte Security-Events</div>
                        </div>

                        <div className="parqet-card">
                            <div className="parqet-card-title">Assets</div>
                            <div className="parqet-kpi-value">{stats.assetCount}</div>
                            <div className="parqet-kpi-sub">Nach ISIN gruppiert</div>
                        </div>

                        <div className="parqet-card">
                            <div className="parqet-card-title">Dividenden netto</div>
                            <div className="parqet-kpi-value">
                                {formatCurrency(stats.totalDividendNet)}
                            </div>
                            <div className="parqet-kpi-sub">Aus bereinigten Asset-Daten</div>
                        </div>
                    </section>

                    <section className="parqet-kpi-grid">
                        <div className="parqet-card">
                            <div className="parqet-card-title">Positionswert</div>
                            <div className="parqet-kpi-value">
                                {formatCurrency(stats.totalPositionValue)}
                            </div>
                            <div className="parqet-kpi-sub">Summe aus Kurs-Proxy</div>
                        </div>

                        <div className="parqet-card">
                            <div className="parqet-card-title">Kursgewinn</div>
                            <div
                                className={`parqet-kpi-value ${getPnLClass(
                                    stats.totalUnrealizedPnL
                                )}`}
                            >
                                {formatCurrency(stats.totalUnrealizedPnL)}
                            </div>
                            <div className="parqet-kpi-sub">Unrealisiert auf Basis letzter Trades</div>
                        </div>
                    </section>

                    <section className="parqet-card">
                        <div className="parqet-card-title">Wertpapiere</div>
                        <AssetTable assets={sortedAssets} />
                    </section>
                </main>
            </div>
        </div>
    );
}