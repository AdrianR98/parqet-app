import type { AppNavItemKey } from "../layout/AppSidebar";
import styles from "./HeaderBar.module.css";

type HeaderBarProps = {
    theme: "light" | "dark";
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
    activeView,
    onToggleThemeAction,
}: HeaderBarProps) {
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
                <span className={styles.statusPill}>Portfolio-Scope folgt</span>
                <span className={styles.statusPill}>Aktualisierung manuell</span>
            </div>

            <div className={styles.right}>
                <button
                    type="button"
                    className="ui-btn ui-btn-ghost"
                    onClick={onToggleThemeAction}
                    aria-label="Darstellung wechseln"
                >
                    {theme === "dark" ? "Dark" : "Light"}
                </button>
            </div>
        </header>
    );
}
