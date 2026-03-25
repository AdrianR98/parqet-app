// src/hooks/use-portfolio-filter.ts

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * - temporaere Draft-Auswahl im Dropdown
 * - Open/Close-State
 * - Outside-Click-Handling
 *
 * Wichtig:
 * Die oeffentlichen Handler werden mit useCallback stabil gehalten,
 * damit konsumierende Effects keine ungewollten Render-Loops ausloesen.
 */
export function usePortfolioFilter(): UsePortfolioFilterResult {
    const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([]);
    const [draftPortfolioIds, setDraftPortfolioIds] = useState<string[]>([]);
    const [isPortfolioDropdownOpen, setIsPortfolioDropdownOpen] = useState(false);
    const portfolioDropdownRef = useRef<HTMLDivElement | null>(null);

    /**
     * Schliesst das Portfolio-Dropdown, wenn ausserhalb geklickt wird.
     */
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                portfolioDropdownRef.current &&
                !portfolioDropdownRef.current.contains(event.target as Node)
            ) {
                setIsPortfolioDropdownOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    /**
     * Setzt aktive und temporaere Auswahl gleichzeitig.
     * Das wird fuer Initialisierung aus Cache oder API verwendet.
     *
     * useCallback ist hier wichtig, damit abhängige Effects in anderen Hooks
     * nicht bei jedem Render erneut ausgelöst werden.
     */
    const hydratePortfolioSelection = useCallback((ids: string[]) => {
        setSelectedPortfolioIds(ids);
        setDraftPortfolioIds(ids);
    }, []);

    /**
     * Fuegt ein Portfolio aus der temporaeren Auswahl hinzu oder entfernt es.
     *
     * Die Aenderung wird zunaechst nur in draftPortfolioIds gehalten und
     * erst mit "Anwenden" aktiv uebernommen.
     */
    const toggleDraftPortfolio = useCallback((portfolioId: string) => {
        setDraftPortfolioIds((current) => {
            if (current.includes(portfolioId)) {
                return current.filter((id) => id !== portfolioId);
            }

            return [...current, portfolioId];
        });
    }, []);

    /**
     * Uebernimmt die temporaere Portfolio-Auswahl als aktive Filtermenge.
     */
    const applyPortfolioFilter = useCallback(() => {
        setSelectedPortfolioIds(draftPortfolioIds);
        setIsPortfolioDropdownOpen(false);
    }, [draftPortfolioIds]);

    /**
     * Setzt die temporaere Auswahl auf alle verfuegbaren Portfolios zurueck.
     */
    const resetPortfolioFilter = useCallback((allPortfolioIds: string[]) => {
        setDraftPortfolioIds(allPortfolioIds);
    }, []);

    return {
        selectedPortfolioIds,
        draftPortfolioIds,
        isPortfolioDropdownOpen,
        portfolioDropdownRef,
        setSelectedPortfolioIds,
        setDraftPortfolioIds,
        setIsPortfolioDropdownOpen,
        toggleDraftPortfolio,
        applyPortfolioFilter,
        resetPortfolioFilter,
        hydratePortfolioSelection,
    };
}