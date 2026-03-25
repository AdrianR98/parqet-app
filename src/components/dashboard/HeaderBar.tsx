import styles from "./HeaderBar.module.css";

type HeaderBarProps = {
    theme: "dark" | "light";
    onToggleTheme: () => void;
};

export default function HeaderBar({
    theme,
    onToggleTheme,
}: HeaderBarProps) {
    return (
        <header className={styles.topbar}>
            <div className={styles.brand}>
                <div className={styles.brandLogo}>P</div>

                <div className={styles.brandText}>
                    <div className={styles.brandTitle}>Asset View</div>
                    <div className={styles.brandSubtitle}>Ansicht</div>
                </div>
            </div>

            <div className={styles.searchWrap}>
                <div className={styles.searchIcon}>⌕</div>
                <input
                    className={styles.searchInput}
                    placeholder="Name, WKN, ISIN, ..."
                    aria-label="Suche"
                />
            </div>

            <div className={styles.right}>
                <button
                    className={styles.themeButton}
                    type="button"
                    onClick={onToggleTheme}
                >
                    {theme === "dark" ? "Dark" : "Light"}
                </button>

                <div className={styles.user}>
                    <div className={styles.avatar}>A</div>

                    <div className={styles.userText}>
                        <div className={styles.userBadge}>Plus</div>
                        <div className={styles.userName}>Adrian Roeschl</div>
                    </div>
                </div>
            </div>
        </header>
    );
}