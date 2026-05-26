import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { TopNavKey } from "../../app/(app)/layout";
import {
    loadKnownPortfolios,
    loadPortfolioScope,
    resolvePortfolioScope,
    savePortfolioScope,
    subscribeToLocalSettings,
    type PortfolioScope,
} from "../../lib/app-settings";
import PortfolioFilter from "./PortfolioFilter";
import styles from "./HeaderBar.module.css";

type HeaderBarProps = {
    theme: "light" | "dark";
    activeView: TopNavKey;
    onToggleThemeAction: () => void;
};

const NAV_ITEMS: Array<{ key: TopNavKey; label: string; href: string }> = [
    { key: "overview", label: "Übersicht", href: "/dashboard" },
    { key: "activities", label: "Aktivitäten", href: "/activities" },
    { key: "settings", label: "Einstellungen", href: "/settings" },
];

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
    activeView,
    onToggleThemeAction,
}: HeaderBarProps) {
    const [isPortfolioFilterOpen, setIsPortfolioFilterOpen] = useState(false);
    const portfolioSnapshot = useSyncExternalStore(
        subscribeToLocalSettings,
        getPortfolioFilterSnapshot,
        () => JSON.stringify({ portfolios: [], selectedPortfolioIds: [] }),
    );
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
    }

    function handleResetPortfolioFilter() {
        savePortfolioScope({ mode: "all", selectedPortfolioIds: [] });
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
                <button
                    type="button"
                    className={styles.themeSwitch}
                    onClick={onToggleThemeAction}
                    aria-label={theme === "dark" ? "Darstellung auf hell umstellen" : "Darstellung auf dunkel umstellen"}
                    aria-checked={theme === "dark"}
                    role="switch"
                >
                    <span className={styles.themeSwitchIcon} aria-hidden="true">☀</span>
                    <span className={styles.themeSwitchIcon} aria-hidden="true">☾</span>
                    <span className={`${styles.themeSwitchKnob} ${theme === "dark" ? styles.themeSwitchKnobDark : ""}`} aria-hidden="true" />
                </button>
            </div>
        </header>
    );
}
