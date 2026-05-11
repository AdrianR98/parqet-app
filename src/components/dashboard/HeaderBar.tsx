import type { AppNavItemKey } from "../layout/AppSidebar";
import { useState } from "react";
import Link from "next/link";
import {
    getFreshnessStatusLabel,
    getScopeIndicatorLabel,
    loadLocalActivityReadModel,
} from "../../lib/local-activity-read-model";
import { loadDashboardCache } from "../../lib/dashboard-cache";
import { getConnectionStatusView } from "../../lib/connection-status";
import styles from "./HeaderBar.module.css";

type HeaderBarProps = {
    theme: "light" | "dark";
    appearanceMode: "system" | "light" | "dark";
    activeView: AppNavItemKey;
    onToggleThemeAction: () => void;
};

const VIEW_LABELS: Record<AppNavItemKey, string> = {
    dashboard: "Dashboard",
    activities: "Aktivitäten",
    timeline: "Timeline",
    reports: "Reports",
    settings: "Einstellungen",
};

export default function HeaderBar({
    theme,
    appearanceMode,
    activeView,
    onToggleThemeAction,
}: HeaderBarProps) {
    const [localStatus] = useState(() => loadLocalActivityReadModel());
    const [connectionStatus] = useState(() =>
        getConnectionStatusView(loadDashboardCache()),
    );

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <div className={styles.brandMark}>AT</div>

                <div className={styles.brandText}>
                    <div className={styles.brandTitle}>AssetTrace</div>
                    <div className={styles.brandSubtitle}>
                        Analyse- und Transparenzschicht für Parqet-Daten
                    </div>
                </div>
            </div>

            <div className={styles.center} aria-label="Aktueller App-Status">
                <span className={styles.scopePill}>Bereich: {VIEW_LABELS[activeView]}</span>
                <span
                    className={`${styles.statusPill} ${styles[`connection_${connectionStatus.kind}`]}`}
                >
                    {connectionStatus.label}
                </span>
                <span className={styles.statusPill}>{getScopeIndicatorLabel(localStatus)}</span>
                <span className={styles.statusPill}>{getFreshnessStatusLabel(localStatus)}</span>
                <Link
                    href="/dashboard"
                    className={styles.refreshPill}
                    title="Explizite Aktualisierung im Dashboard öffnen"
                >
                    Refresh im Dashboard
                </Link>
            </div>

            <div className={styles.right}>
                <button
                    type="button"
                    className="ui-btn ui-btn-ghost"
                    onClick={onToggleThemeAction}
                    aria-label="Darstellung wechseln"
                >
                    {appearanceMode === "system"
                        ? `System (${theme === "dark" ? "Dunkel" : "Hell"})`
                        : theme === "dark"
                            ? "Dunkel"
                            : "Hell"}
                </button>
            </div>
        </header>
    );
}
