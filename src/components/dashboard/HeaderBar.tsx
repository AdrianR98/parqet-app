import { useSyncExternalStore } from "react";
import Link from "next/link";
import type { TopNavKey } from "../../app/(app)/layout";
import { getFreshnessStatusLabel, loadLocalActivityReadModel } from "../../lib/local-activity-read-model";
import { loadDashboardCache } from "../../lib/dashboard-cache";
import { getConnectionStatusView } from "../../lib/connection-status";
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
    if (typeof window === "undefined") {
        return () => {};
    }

    window.addEventListener("storage", onStoreChange);
    window.addEventListener("assettrace:appearance-change", onStoreChange);

    return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener("assettrace:appearance-change", onStoreChange);
    };
}

export default function HeaderBar({
    theme,
    appearanceMode,
    activeView,
    onToggleThemeAction,
}: HeaderBarProps) {
    const headerStatus = useSyncExternalStore(
        subscribeToHeaderStatus,
        getHeaderStatusSnapshot,
        () => serializeHeaderStatus(),
    );
    const [connectionKind, connectionLabel, freshnessLabel] = headerStatus.split(STATUS_SEPARATOR);

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
                <span className={`${styles.pill} ${styles[`connection_${connectionKind}`]}`}>{connectionLabel}</span>
                <span className={styles.pill}>{freshnessLabel}</span>
                <button type="button" className="ui-btn ui-btn-ghost" onClick={onToggleThemeAction}>
                    {appearanceMode === "system" ? `System (${theme === "dark" ? "Dunkel" : "Hell"})` : theme === "dark" ? "Dunkel" : "Hell"}
                </button>
            </div>
        </header>
    );
}
