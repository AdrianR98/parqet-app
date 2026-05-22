import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import styles from "./PortfolioFilter.module.css";
import type { Portfolio } from "../../lib/types";

type PortfolioFilterProps = {
    portfolios: Portfolio[];
    selectedPortfolioIds: string[];
    visiblePortfolioIds: string[];
    isOpen: boolean;
    onToggleOpen: () => void;
    onTogglePortfolio?: (portfolioId: string) => void;
    onResetSelection?: () => void;
    dropdownRef?: RefObject<HTMLDivElement | null>;
    // Legacy aliases for compatibility.
    draftPortfolioIds?: string[];
    onToggleDraftPortfolio?: (portfolioId: string) => void;
    onReset?: () => void;
};

export default function PortfolioFilter({
    portfolios,
    selectedPortfolioIds,
    visiblePortfolioIds,
    isOpen,
    onToggleOpen,
    onTogglePortfolio,
    onResetSelection,
    dropdownRef,
    draftPortfolioIds,
    onToggleDraftPortfolio,
    onReset,
}: PortfolioFilterProps) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const selectedCount = selectedPortfolioIds.length;
    const totalCount = portfolios.length;

    function toggleMenu() {
        onToggleOpen();
    }

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

        function closeMenu() {
            onToggleOpen();
        }

        function handlePointerDown(event: PointerEvent) {
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

        document.addEventListener("pointerdown", handlePointerDown, true);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, true);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen, onToggleOpen]);

    function handleTogglePortfolio(portfolioId: string) {
        if (onTogglePortfolio) {
            onTogglePortfolio(portfolioId);
            return;
        }

        onToggleDraftPortfolio?.(portfolioId);
    }

    function handleReset() {
        if (onResetSelection) {
            onResetSelection();
            return;
        }

        onReset?.();
    }

    return (
        <div
            className={styles.wrapper}
            ref={(node) => {
                wrapperRef.current = node;
                if (dropdownRef) {
                    dropdownRef.current = node;
                }
            }}
        >
            <button
                type="button"
                className={`ui-filter-btn ${styles.trigger}`}
                onClick={toggleMenu}
                aria-expanded={isOpen}
            >
                <span className={styles.icon} aria-hidden="true">◉</span>
                <span className={styles.label}>Portfolios</span>
                <span className={styles.value}>
                    {selectedCount === totalCount ? "Alle Portfolios" : selectedCount > 0 ? `${selectedCount} ausgewählt` : triggerLabel}
                </span>
                <span className={styles.chevron}>▾</span>
            </button>

            {isOpen ? (
                <div className={styles.menu}>
                    <div className={styles.helperText}>{selectedCount} von {totalCount} Portfolios ausgewählt</div>

                    <div className={styles.list}>
                        {portfolios.map((portfolio) => {
                            const checked = (draftPortfolioIds ?? visiblePortfolioIds).includes(portfolio.id);

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
