// src/hooks/use-portfolio-filter.ts

"use client";

import { useCallback, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

type UsePortfolioFilterResult = {
    selectedPortfolioIds: string[];
    draftPortfolioIds: string[];
    isPortfolioDropdownOpen: boolean;
    portfolioDropdownRef: RefObject<HTMLDivElement | null>;
    setSelectedPortfolioIds: Dispatch<SetStateAction<string[]>>;
    setDraftPortfolioIds: Dispatch<SetStateAction<string[]>>;
    setIsPortfolioDropdownOpen: Dispatch<SetStateAction<boolean>>;
    toggleDraftPortfolio: (portfolioId: string) => void;
    applyPortfolioFilter: () => void;
    resetPortfolioFilter: (allPortfolioIds: string[]) => void;
    hydratePortfolioSelection: (ids: string[]) => void;
};

/**
 * Kapselt die komplette UI-Logik des Portfolio-Filters.
 *
 * Verantwortlichkeiten:
 * - aktive Auswahl
 * - Open/Close-State
 *
 * Wichtig:
 * Die oeffentlichen Handler werden mit useCallback stabil gehalten,
 * damit konsumierende Effects keine ungewollten Render-Loops ausloesen.
 */
export function usePortfolioFilter(): UsePortfolioFilterResult {
    const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([]);
    const [isPortfolioDropdownOpen, setIsPortfolioDropdownOpen] = useState(false);
    const portfolioDropdownRef = useRef<HTMLDivElement | null>(null);

    /**
     * Setzt aktive und temporaere Auswahl gleichzeitig.
     * Das wird fuer Initialisierung aus Cache oder API verwendet.
     *
     * useCallback ist hier wichtig, damit abhängige Effects in anderen Hooks
     * nicht bei jedem Render erneut ausgelöst werden.
     */
    const hydratePortfolioSelection = useCallback((ids: string[]) => {
        setSelectedPortfolioIds(ids);
    }, []);

    /**
     * Fuegt ein Portfolio direkt in der aktiven Auswahl hinzu oder entfernt es.
     */
    const toggleDraftPortfolio = useCallback((portfolioId: string) => {
        setSelectedPortfolioIds((current) => {
            if (current.includes(portfolioId)) {
                return current.filter((id) => id !== portfolioId);
            }

            return [...current, portfolioId];
        });
    }, []);

    /**
     * Kompatibilitaets-Hook fuer alte Aufrufer; Hot-Apply passiert bereits direkt.
     */
    const applyPortfolioFilter = useCallback(() => {
        // Hot-apply ist bereits bei jedem Toggle aktiv.
    }, []);

    /**
     * Setzt die aktive Auswahl auf alle verfuegbaren Portfolios zurueck.
     */
    const resetPortfolioFilter = useCallback((allPortfolioIds: string[]) => {
        setSelectedPortfolioIds(allPortfolioIds);
    }, []);

    return {
        selectedPortfolioIds,
        draftPortfolioIds: selectedPortfolioIds,
        isPortfolioDropdownOpen,
        portfolioDropdownRef,
        setSelectedPortfolioIds,
        setDraftPortfolioIds: setSelectedPortfolioIds,
        setIsPortfolioDropdownOpen,
        toggleDraftPortfolio,
        applyPortfolioFilter,
        resetPortfolioFilter,
        hydratePortfolioSelection,
    };
}
