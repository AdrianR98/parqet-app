import styles from "./HeaderBar.module.css";

type HeaderBarProps = {
    theme: "light" | "dark";
    onToggleThemeAction: () => void;
};

/**
 * ============================================================
 * COMPONENT: HEADER BAR
 * ============================================================
 *
 * Wichtig:
 * - Callback-Prop endet auf "Action"
 * - kein CSS-Module-:global Hack mehr nötig
 */
export default function HeaderBar({
    theme,
    onToggleThemeAction,
}: HeaderBarProps) {
    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <div className={styles.brandMark}>A</div>

                <div className={styles.brandText}>
                    <div className={styles.brandTitle}>Asset View</div>
                    <div className={styles.brandSubtitle}>Ansicht</div>
                </div>
            </div>

            <div className={styles.center}>
                <div className={styles.searchShell}>
                    <span className={styles.searchIcon}>⌕</span>
                    <input
                        className={`ui-input ${styles.searchInput}`}
                        type="text"
                        placeholder="Name, WKN, ISIN, ..."
                        aria-label="Globale Suche"
                    />
                </div>
            </div>

            <div className={styles.right}>
                <button
                    type="button"
                    className="ui-btn ui-btn-ghost"
                    onClick={onToggleThemeAction}
                >
                    {theme === "dark" ? "Dark" : "Light"}
                </button>

                <button type="button" className="ui-icon-btn" aria-label="Profil">
                    A
                </button>

                <div className={styles.userBlock}>
                    <div className={styles.userPlan}>Plus</div>
                    <div className={styles.userName}>Adrian Roeschl</div>
                </div>
            </div>
        </header>
    );
}