import type { AppNavItemKey } from "../layout/AppSidebar";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
    getFreshnessStatusLabel,
    getLoadedScopeIndicatorLabel,
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

const INITIAL_CONNECTION_STATUS = getConnectionStatusView(null);

const INITIAL_SCOPE_LABEL = "Auswahl: unbekannt";
const INITIAL_LOADED_SCOPE_LABEL = "Geladen: kein Stand";
const INITIAL_FRESHNESS_LABEL = "Nicht geladen / Datenstand unbekannt";

const STATUS_SEPARATOR = "\u001f";

function serializeHeaderStatus(
    connectionStatus = INITIAL_CONNECTION_STATUS,
    scopeLabel = INITIAL_SCOPE_LABEL,
    loadedScopeLabel = INITIAL_LOADED_SCOPE_LABEL,
    freshnessLabel = INITIAL_FRESHNESS_LABEL,
): string {
    return [
        connectionStatus.kind,
        connectionStatus.label,
        scopeLabel,
        loadedScopeLabel,
        freshnessLabel,
    ].join(STATUS_SEPARATOR);
}

function getHeaderStatusSnapshot(): string {
    const localStatus = loadLocalActivityReadModel();
    const connectionStatus = getConnectionStatusView(loadDashboardCache());

    return serializeHeaderStatus(
        connectionStatus,
        getScopeIndicatorLabel(localStatus),
        getLoadedScopeIndicatorLabel(localStatus),
        getFreshnessStatusLabel(localStatus),
    );
}

function getHeaderStatusServerSnapshot(): string {
    return serializeHeaderStatus();
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
        getHeaderStatusServerSnapshot,
    );
    const [
        connectionKind,
        connectionLabel,
        scopeLabel,
        loadedScopeLabel,
        freshnessLabel,
    ] = headerStatus.split(STATUS_SEPARATOR);

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
                    className={`${styles.statusPill} ${styles[`connection_${connectionKind}`]}`}
                >
                    {connectionLabel}
                </span>
                <span className={styles.statusPill}>{scopeLabel}</span>
                <span className={styles.statusPill}>{loadedScopeLabel}</span>
                <span className={styles.statusPill}>{freshnessLabel}</span>
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
