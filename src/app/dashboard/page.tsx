// ============================================================
// src/app/page.tsx
// ------------------------------------------------------------
// Dashboard Root Page
//
// Verantwortlichkeiten:
// - Komposition der UI-Komponenten
// - Verbindung von Hooks (State + Daten)
// - KEINE Business-Logik
//
// Datenfluss:
// useDashboardData()
//   -> liefert alle aggregierten Daten + Handler
//
// useTheme()
//   -> UI Theme Steuerung
//
// WICHTIG:
// - Assets werden bereits im Hook gefiltert / sortiert
// - Diese Seite rendert nur noch
// ============================================================

"use client";

import HeaderBar from "../../components/dashboard/HeaderBar";
import HeroSection from "../../components/dashboard/HeroSection";
import StatsGrid from "../../components/dashboard/StatsGrid";
import DataWarningsPanel from "../../components/dashboard/DataWarningsPanel";
import CollapsibleAssetTableSection from "../../components/dashboard/CollapsibleAssetTableSection";
import AssetAuditPanel from "../../components/dashboard/AssetAuditPanel";

import { useDashboardData } from "../../hooks/use-dashboard-data";
import { useTheme } from "../../hooks/use-theme";
import { useAssetAudit } from "../../hooks/use-asset-audit";

import { useState } from "react";
import type { AssetSummary } from "../../lib/types";

// ============================================================
// Component
// ============================================================

export default function DashboardPage() {
    // ========================================================
    // Theme
    // ========================================================

    const { theme, toggleTheme, themeStyle } = useTheme();

    // ========================================================
    // Dashboard Data (zentrale Quelle)
    // ========================================================

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

        loadingPortfolios,
        loadingAssets,
        errorMessage,

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

    // ========================================================
    // Asset Audit State (Detailansicht / Debugging)
    // ========================================================

    const [auditAsset, setAuditAsset] = useState<AssetSummary | null>(null);

    const {
        data: auditData,
        loading: loadingAudit,
        error: auditError,
        loadAudit,
        resetAudit,
    } = useAssetAudit();

    // ========================================================
    // Handler: Asset Audit öffnen
    // ========================================================

    async function handleAuditAsset(asset: AssetSummary) {
        setAuditAsset(asset);

        await loadAudit({
            isin: asset.isin,
            portfolioIds: selectedPortfolioIds,
        });
    }

    // ========================================================
    // Handler: Asset Audit schließen
    // ========================================================

    function handleCloseAudit() {
        setAuditAsset(null);
        resetAudit();
    }

    // ========================================================
    // Render
    // ========================================================

    return (
        <main
            className={`parqet-page theme-${theme}`}
            style={themeStyle}
            data-theme={theme}
        >
            {/* ====================================================
               Header / Theme Toggle
            ==================================================== */}
            <HeaderBar theme={theme} onToggleTheme={toggleTheme} />

            <div className="parqet-content" ref={portfolioDropdownRef}>
                {/* ====================================================
                   Hero Section (Portfolio Auswahl + KPIs)
                ==================================================== */}
                <HeroSection
                    portfolios={portfolios}
                    selectedPortfolioIds={selectedPortfolioIds}
                    draftPortfolioIds={draftPortfolioIds}
                    selectedPortfolioCount={selectedPortfolioCount}
                    assetCount={assetCount}
                    loadingAssets={loadingAssets}
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

                {/* ====================================================
                   Ladezustand / Fehler
                ==================================================== */}

                {loadingPortfolios ? (
                    <div className="parqet-info-banner">
                        Portfolios werden geladen...
                    </div>
                ) : null}

                {errorMessage ? (
                    <div className="parqet-error-banner">
                        <strong>Fehler</strong>
                        <div>{errorMessage}</div>
                    </div>
                ) : null}

                {/* ====================================================
                   Warnings Panel (Reconciliation + Consistency)
                ==================================================== */}

                {showWarningsPanel ? (
                    <div style={{ marginBottom: 18 }}>
                        <DataWarningsPanel
                            warnings={consistencyReport?.assetsWithWarnings ?? []}
                            reconciliationWarnings={reconciliationWarnings}
                        />
                    </div>
                ) : null}

                {/* ====================================================
                   KPI Grid
                ==================================================== */}

                <StatsGrid stats={stats} />

                {/* ====================================================
                   ACTIVE ASSETS
                   ----------------------------------------------------
                   Offene Positionen (netShares > 0)
                ==================================================== */}

                <CollapsibleAssetTableSection
                    title="Wertpapiere"
                    subtitle="Offene Positionen über alle ausgewählten Portfolios"
                    assets={sortedActiveAssets}
                    defaultExpanded={true}
                    onAuditAssetAction={handleAuditAsset}
                />

                {/* ====================================================
                   CLOSED ASSETS
                   ----------------------------------------------------
                   Historische / verkaufte Positionen (netShares <= 0)
                ==================================================== */}

                <div style={{ marginTop: 20 }}>
                    <CollapsibleAssetTableSection
                        title="Geschlossene Wertpapiere"
                        subtitle="Positionen ohne aktuellen Bestand"
                        assets={sortedClosedAssets}
                        defaultExpanded={false}
                        onAuditAssetAction={handleAuditAsset}
                    />
                </div>
            </div>

            {/* ====================================================
               ASSET AUDIT PANEL (Overlay)
               ----------------------------------------------------
               Detailansicht für:
               - Activities
               - Reconciliation Issues
               - zukünftige Overrides
            ==================================================== */}

            <AssetAuditPanel
                asset={auditAsset}
                data={auditData}
                loading={loadingAudit}
                error={auditError}
                isOpen={Boolean(auditAsset)}
                onCloseAction={handleCloseAudit}
            />
        </main>
    );
}