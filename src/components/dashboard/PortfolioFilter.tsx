"use client";

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
    return (
        <div className="parqet-portfolio-filter">
            <button
                className="parqet-filter-button"
                onClick={onToggleOpen}
                type="button"
            >
                <span>{selectedPortfolioIds.length} Portfolios</span>
                <span className="parqet-filter-button-icon">▾</span>
            </button>

            {isOpen ? (
                <div className="parqet-filter-dropdown">
                    <div className="parqet-filter-list">
                        {portfolios.map((portfolio) => (
                            <label key={portfolio.id} className="parqet-filter-option">
                                <input
                                    type="checkbox"
                                    checked={draftPortfolioIds.includes(portfolio.id)}
                                    onChange={() => onToggleDraftPortfolio(portfolio.id)}
                                />
                                <span>{portfolio.name}</span>
                            </label>
                        ))}
                    </div>

                    <div className="parqet-filter-actions">
                        <button
                            type="button"
                            className="parqet-filter-apply"
                            onClick={onApply}
                        >
                            Anwenden
                        </button>

                        <button
                            type="button"
                            className="parqet-filter-reset"
                            onClick={onReset}
                        >
                            Filter loeschen
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}