import { useEffect, useRef } from "react";
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
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const shouldApplyRef = useRef(false);
    const selectedCount = selectedPortfolioIds.length;
    const totalCount = portfolios.length;

    const triggerLabel =
        selectedCount === 0
            ? "Keine Portfolios"
            : selectedCount === totalCount
                ? "Alle Portfolios"
                : selectedCount === 1
                    ? "1 Portfolio"
                    : `${selectedCount} Portfolios`;

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (shouldApplyRef.current) {
            shouldApplyRef.current = false;
            onApply();
            setTimeout(() => {
                onToggleOpen();
            }, 0);
        }
    }, [draftPortfolioIds, isOpen, onApply, onToggleOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function closeMenu() {
            onToggleOpen();
        }

        function handlePointerDown(event: MouseEvent) {
            const target = event.target as Node;
            if (!wrapperRef.current?.contains(target)) {
                closeMenu();
            }
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                closeMenu();
            }
        }

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen, onToggleOpen]);

    function handleTogglePortfolio(portfolioId: string) {
        shouldApplyRef.current = true;
        onToggleDraftPortfolio(portfolioId);
    }

    function handleReset() {
        shouldApplyRef.current = true;
        onReset();
    }

    return (
        <div className={styles.wrapper} ref={wrapperRef}>
            <button
                type="button"
                className={`ui-filter-btn ${styles.trigger}`}
                onClick={onToggleOpen}
                aria-expanded={isOpen}
            >
                <span className={styles.label}>Portfolios</span>
                <span className={styles.value}>{selectedCount > 0 ? `${selectedCount} ausgewählt` : triggerLabel}</span>
                <span className={styles.chevron}>▾</span>
            </button>

            {isOpen ? (
                <div className={styles.menu}>
                    <div className={styles.helperText}>{selectedCount} von {totalCount} Portfolios ausgewählt</div>

                    <div className={styles.list}>
                        {portfolios.map((portfolio) => {
                            const checked = draftPortfolioIds.includes(portfolio.id);

                            return (
                                <label key={portfolio.id} className={styles.item}>
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => handleTogglePortfolio(portfolio.id)}
                                    />
                                    <span>{portfolio.name}</span>
                                </label>
                            );
                        })}
                    </div>

                    <div className={styles.footer}>
                        <button type="button" className="ui-btn ui-btn-secondary" onClick={handleReset}>Zurücksetzen</button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
