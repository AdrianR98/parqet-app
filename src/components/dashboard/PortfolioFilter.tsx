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

/**
 * ============================================================
 * COMPONENT: PORTFOLIO FILTER
 * ============================================================
 *
 * Wichtig:
 * - bewusst OHNE "use client"
 * - reine UI-Unterkomponente
 * - wird aus einer Client-Komponente heraus benutzt
 *
 * So verschwinden die Warnungen zu Funktionsprops an der
 * Client-Entry-Grenze.
 */
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
    const totalCount = portfolios.length;

    const triggerLabel =
        selectedCount === 0
            ? "Keine Portfolios"
            : selectedCount === totalCount
                ? "Alle Portfolios"
                : selectedCount === 1
                    ? (portfolios.find((p) => p.id === selectedPortfolioIds[0])?.name ??
                        "1 Portfolio")
                    : `${selectedCount} Portfolios`;

    return (
        <div className={styles.wrapper}>
            <button
                type="button"
                className={`ui-filter-btn ${styles.trigger}`}
                onClick={onToggleOpen}
                aria-expanded={isOpen}
            >
                <span>{triggerLabel}</span>
                <span>▾</span>
            </button>

            {isOpen ? (
                <div className={styles.menu}>
                    <div className={styles.list}>
                        {portfolios.map((portfolio) => {
                            const checked = draftPortfolioIds.includes(portfolio.id);

                            return (
                                <label key={portfolio.id} className={styles.item}>
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => onToggleDraftPortfolio(portfolio.id)}
                                    />
                                    <span>{portfolio.name}</span>
                                </label>
                            );
                        })}
                    </div>

                    <div className={styles.footer}>
                        <button
                            type="button"
                            className="ui-btn ui-btn-secondary"
                            onClick={onReset}
                        >
                            Reset
                        </button>

                        <button
                            type="button"
                            className="ui-btn ui-btn-primary"
                            onClick={onApply}
                        >
                            Anwenden
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}