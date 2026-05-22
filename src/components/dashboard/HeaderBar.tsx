import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { TopNavKey } from "../../app/(app)/layout";
import { getFreshnessStatusLabel, loadLocalActivityReadModel } from "../../lib/local-activity-read-model";
import { loadDashboardCache } from "../../lib/dashboard-cache";
import { getConnectionStatusView } from "../../lib/connection-status";
import {
    loadKnownPortfolios,
    loadPortfolioScope,
    notifyLocalSettingsChanged,
    resolvePortfolioScope,
    savePortfolioScope,
    subscribeToLocalSettings,
    type PortfolioScope,
} from "../../lib/app-settings";
import PortfolioFilter from "./PortfolioFilter";
import styles from "./HeaderBar.module.css";

type HeaderBarProps = {
    theme: "light" | "dark";
    appearanceMode: "system" | "light" | "dark";
    activeView: TopNavKey;
    onToggleThemeAction: () => void;
};

const NAV_ITEMS: Array<{ key: TopNavKey; label: string; href: string }> = [
    { key: "overview", label: "Übersicht", href: "/dashboard" },
    { key: "activities", label: "Aktivitäten", href: "/activities" },
    { key: "settings", label: "Einstellungen", href: "/settings" },
];

const INITIAL_CONNECTION_STATUS = getConnectionStatusView(null);
const STATUS_SEPARATOR = "\u001f";

function serializeHeaderStatus(
    connectionStatus = INITIAL_CONNECTION_STATUS,
    freshnessLabel = "Nicht geladen / Datenstand unbekannt",
): string {
    return [
        connectionStatus.kind,
        connectionStatus.label,
        freshnessLabel,
    ].join(STATUS_SEPARATOR);
}

function getHeaderStatusSnapshot(): string {
    const localStatus = loadLocalActivityReadModel();
    const connectionStatus = getConnectionStatusView(loadDashboardCache());

    return serializeHeaderStatus(
        connectionStatus,
        getFreshnessStatusLabel(localStatus),
    );
}

function subscribeToHeaderStatus(onStoreChange: () => void) {
    if (typeof window === "undefined") return () => {};
    const unsubscribe = subscribeToLocalSettings(onStoreChange);
    window.addEventListener("assettrace:appearance-change", onStoreChange);

    return () => {
        unsubscribe();
        window.removeEventListener("assettrace:appearance-change", onStoreChange);
    };
}

function getPortfolioFilterSnapshot(): string {
    const portfolios = loadKnownPortfolios();
    const resolvedScope = resolvePortfolioScope(loadPortfolioScope(), portfolios);
    return JSON.stringify({
        portfolios,
        selectedPortfolioIds: resolvedScope.selectedPortfolioIds,
    });
}

export default function HeaderBar({
    theme,
    appearanceMode,
    activeView,
    onToggleThemeAction,
}: HeaderBarProps) {
    const [isPortfolioFilterOpen, setIsPortfolioFilterOpen] = useState(false);
    const headerStatus = useSyncExternalStore(
        subscribeToHeaderStatus,
        getHeaderStatusSnapshot,
        () => serializeHeaderStatus(),
    );
    const portfolioSnapshot = useSyncExternalStore(
        subscribeToLocalSettings,
        getPortfolioFilterSnapshot,
        () => JSON.stringify({ portfolios: [], selectedPortfolioIds: [] }),
    );
    const [connectionKind, connectionLabel, freshnessLabel] = headerStatus.split(STATUS_SEPARATOR);
    const { portfolios, selectedPortfolioIds } = useMemo(() => {
        const parsed = JSON.parse(portfolioSnapshot) as {
            portfolios: Array<{ id: string; name: string; currency: string; createdAt: string; distinctBrokers: string[] }>;
            selectedPortfolioIds: string[];
        };
        return parsed;
    }, [portfolioSnapshot]);

    function handleTogglePortfolio(portfolioId: string) {
        const hasSelection = selectedPortfolioIds.includes(portfolioId);
        const nextSelected = hasSelection
            ? selectedPortfolioIds.filter((id) => id !== portfolioId)
            : [...selectedPortfolioIds, portfolioId];
        const allPortfolioIds = portfolios.map((portfolio) => portfolio.id);
        const nextScope: PortfolioScope =
            nextSelected.length === allPortfolioIds.length
                ? { mode: "all", selectedPortfolioIds: [] }
                : { mode: "manual", selectedPortfolioIds: nextSelected };

        savePortfolioScope(nextScope);
        notifyLocalSettingsChanged();
    }

    function handleResetPortfolioFilter() {
        savePortfolioScope({ mode: "all", selectedPortfolioIds: [] });
        notifyLocalSettingsChanged();
    }

    return (
        <header className={styles.header}>
            <div className={styles.brand}>AssetTrace</div>
            <nav className={styles.nav} aria-label="Top Navigation">
                {NAV_ITEMS.map((item) => (
                    <Link
                        key={item.key}
                        href={item.href}
                        className={`${styles.navItem} ${item.key === activeView ? styles.navItemActive : ""}`}
                        aria-current={item.key === activeView ? "page" : undefined}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>
            <div className={styles.statusRow}>
                {portfolios.length > 0 ? (
                    <PortfolioFilter
                        portfolios={portfolios}
                        selectedPortfolioIds={selectedPortfolioIds}
                        visiblePortfolioIds={selectedPortfolioIds}
                        isOpen={isPortfolioFilterOpen}
                        onToggleOpen={() => setIsPortfolioFilterOpen((current) => !current)}
                        onTogglePortfolio={handleTogglePortfolio}
                        onResetSelection={handleResetPortfolioFilter}
                    />
                ) : null}
                <span className={`${styles.pill} ${styles[`connection_${connectionKind}`]}`}>{connectionLabel}</span>
                <span className={styles.pill}>{freshnessLabel}</span>
                <button type="button" className="ui-btn ui-btn-ghost" onClick={onToggleThemeAction}>
                    {appearanceMode === "system" ? `System (${theme === "dark" ? "Dunkel" : "Hell"})` : theme === "dark" ? "Dunkel" : "Hell"}
                </button>
            </div>
        </header>
    );
}
