"use client";

import CollapsibleAssetTableSection from "../../../components/dashboard/CollapsibleAssetTableSection";
import DataWarningsPanel from "../../../components/dashboard/DataWarningsPanel";
import HeroSection from "../../../components/dashboard/HeroSection";
import StatsGrid from "../../../components/dashboard/StatsGrid";
import { useDashboardData } from "../../../hooks/use-dashboard-data";

/**
 * ============================================================
 * PAGE: DASHBOARD
 * ============================================================
 *
 * Verantwortlichkeiten:
 * - Seite orchestriert Daten + Panels
 * - Hero, Stats und Sections bleiben getrennte UI-Bausteine
 * - globale Layout-Utilities kommen aus globals.css
 *
 * Typische Erweiterungspunkte:
 * - persistente Filterzustände
 * - weitere Section-Typen
 * - zusätzliche Drawer / Sidepanels
 */
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
        hasPendingPortfolioSelection,

        loadingPortfolios,
        loadingAssets,
        refreshingAssets,
        hasCachedData,
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

    return (
        <>
            <div className="app-content" ref={portfolioDropdownRef}>
                <div className="app-stack">
                    <HeroSection
                        portfolios={portfolios}
                        selectedPortfolioIds={selectedPortfolioIds}
                        draftPortfolioIds={draftPortfolioIds}
                        selectedPortfolioCount={selectedPortfolioCount}
                        assetCount={assetCount}
                        loadingAssets={loadingAssets}
                        refreshingAssets={refreshingAssets}
                        hasCachedData={hasCachedData}
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
                        <div className="ui-banner ui-banner-info">
                            Portfolios werden geladen. Die Asset-Liste startet erst nach deiner expliziten Ladeaktion.
                        </div>
                    ) : null}

                    {hasPendingPortfolioSelection ? (
                        <div className="ui-banner ui-banner-info">
                            Die Portfolio-Auswahl wurde geändert. Die Ansicht zeigt weiterhin den letzten geladenen Stand. Klicke auf „Manuell aktualisieren“, um die neue Auswahl zu übernehmen.
                        </div>
                    ) : null}

                    {refreshingAssets ? (
                        <div className="ui-banner ui-banner-info">
                            Manuelle Aktualisierung läuft. Der letzte geladene Stand bleibt sichtbar, bis neue Daten bereitstehen.
                        </div>
                    ) : null}

                    {errorMessage ? (
                        <div className="ui-banner ui-banner-error">
                            <strong>
                                {authRequired
                                    ? "Parqet-Verbindung abgelaufen"
                                    : "Fehler"}
                            </strong>
                            <div>{errorMessage}</div>

                            {authRequired ? (
                                <div className="ui-banner-actions">
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn-secondary"
                                        onClick={startReconnect}
                                    >
                                        Erneut verbinden
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    <StatsGrid stats={stats} />

                    <div className="app-section-stack">
                        <CollapsibleAssetTableSection
                            title="Wertpapiere"
                            subtitle="Offene Positionen über alle ausgewählten Portfolios. Suche, Sortierung und Spaltenauswahl bleiben lokal."
                            assets={sortedActiveAssets}
                            loading={loadingAssets && !hasCachedData}
                            emptyTitle="Noch keine Wertpapiere geladen"
                            emptyDescription="Wähle Portfolios aus und lade Assets explizit, um den aktuellen Parqet-Stand in AssetTrace zu betrachten."
                            defaultExpanded={true}
                        />

                        <CollapsibleAssetTableSection
                            title="Geschlossene Wertpapiere"
                            subtitle="Positionen ohne aktuellen Bestand aus dem geladenen Stand"
                            assets={sortedClosedAssets}
                            loading={loadingAssets && !hasCachedData}
                            emptyTitle="Keine geschlossenen Positionen im geladenen Stand"
                            emptyDescription="Wenn Parqet geschlossene Positionen für die Auswahl liefert, erscheinen sie nach einer manuellen Aktualisierung hier."
                            defaultExpanded={false}
                        />
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
