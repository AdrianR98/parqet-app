import styles from "./PortfolioFilter.module.css";
import type { Portfolio } from "../../lib/types";

type PortfolioFilterProps = {
    portfolios: Portfolio[];
    selectedPortfolioIds: string[];
    draftPortfolioIds: string[];
    isOpen: boolean;
    onToggleOpen: () => void;
    onToggleDraftPortfolio: (portfolioId: string) => void;
    onApply: () => void;
    onReset: () => void;
};

export default function PortfolioFilter({
    portfolios,
    selectedPortfolioIds,
    draftPortfolioIds,
    isOpen,
    onToggleOpen,
    onToggleDraftPortfolio,
    onApply,
    onReset,
}: PortfolioFilterProps) {
    const selectedCount = selectedPortfolioIds.length;

    return (
        <div className={styles.wrapper}>
            <div className={styles.triggerRow}>
                <button
                    type="button"
                    onClick={onToggleOpen}
                    className={`${styles.trigger} ${isOpen ? styles.triggerActive : ""}`.trim()}
                >
                    <span>{selectedCount} Portfolios</span>
                    <span className={styles.triggerIcon}>☰</span>
                </button>
            </div>

            {isOpen ? (
                <div className={styles.dropdown}>
                    <div className={styles.list}>
                        {portfolios.map((portfolio) => {
                            const checked = draftPortfolioIds.includes(portfolio.id);

                            return (
                                <button
                                    key={portfolio.id}
                                    type="button"
                                    className={`${styles.item} ${checked ? styles.itemChecked : ""}`.trim()}
                                    onClick={() => onToggleDraftPortfolio(portfolio.id)}
                                >
                                    <div
                                        className={`${styles.checkbox} ${checked ? styles.checkboxChecked : ""
                                            }`.trim()}
                                    >
                                        ✓
                                    </div>

                                    <div className={styles.label}>{portfolio.name}</div>
                                </button>
                            );
                        })}
                    </div>

                    <div className={styles.footer}>
                        <button type="button" className={styles.applyButton} onClick={onApply}>
                            Anwenden
                        </button>

                        <button type="button" className={styles.resetButton} onClick={onReset}>
                            Filter löschen
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}