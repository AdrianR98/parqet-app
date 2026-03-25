"use client";

import { useEffect, useMemo, useState } from "react";
import type {
    ActivitiesAuditApiResponse,
    ActivitiesAuditItem,
    ActivitiesAuditSummary,
    AuditActivityType,
    Portfolio,
    ReconciliationWarning,
} from "../lib/types";

type AuditMonthGroup = {
    monthKey: string;
    monthLabel: string;
    items: ActivitiesAuditItem[];
};

type AuditYearGroup = {
    year: number;
    items: ActivitiesAuditItem[];
    months: AuditMonthGroup[];
};

type UseActivitiesAuditResult = {
    loading: boolean;
    errorMessage: string;
    generatedAt: string | null;

    portfolios: Portfolio[];
    reconciliationWarnings: ReconciliationWarning[];

    selectedPortfolioIds: string[];
    selectedTypes: AuditActivityType[];
    searchTerm: string;

    setSearchTerm: (value: string) => void;
    togglePortfolio: (portfolioId: string) => void;
    toggleType: (type: AuditActivityType) => void;
    clearFilters: () => void;
    reload: () => Promise<void>;

    filteredItems: ActivitiesAuditItem[];
    filteredSummary: ActivitiesAuditSummary;
    groupedYears: AuditYearGroup[];
};

const ALL_TYPES: AuditActivityType[] = [
    "buy",
    "sell",
    "dividend",
    "transfer_in",
    "transfer_out",
    "unknown",
];

/**
 * Baut Summary-Werte auf Basis der aktuell gefilterten Items.
 */
function buildSummary(items: ActivitiesAuditItem[]): ActivitiesAuditSummary {
    let buyCount = 0;
    let sellCount = 0;
    let dividendCount = 0;
    let transferInCount = 0;
    let transferOutCount = 0;
    let unknownCount = 0;

    for (const item of items) {
        if (item.type === "buy") buyCount += 1;
        else if (item.type === "sell") sellCount += 1;
        else if (item.type === "dividend") dividendCount += 1;
        else if (item.type === "transfer_in") transferInCount += 1;
        else if (item.type === "transfer_out") transferOutCount += 1;
        else unknownCount += 1;
    }

    return {
        total: items.length,
        buyCount,
        sellCount,
        dividendCount,
        transferInCount,
        transferOutCount,
        unknownCount,
    };
}

/**
 * Gruppiert die gefilterten Aktivitäten nach Jahr und Monat.
 */
function groupByYearAndMonth(items: ActivitiesAuditItem[]): AuditYearGroup[] {
    const yearMap = new Map<number, Map<string, AuditMonthGroup>>();

    for (const item of items) {
        if (!yearMap.has(item.year)) {
            yearMap.set(item.year, new Map<string, AuditMonthGroup>());
        }

        const monthMap = yearMap.get(item.year)!;

        if (!monthMap.has(item.monthKey)) {
            monthMap.set(item.monthKey, {
                monthKey: item.monthKey,
                monthLabel: item.monthLabel,
                items: [],
            });
        }

        monthMap.get(item.monthKey)!.items.push(item);
    }

    return Array.from(yearMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([year, monthMap]) => ({
            year,
            items: Array.from(monthMap.values()).flatMap((group) => group.items),
            months: Array.from(monthMap.values()).sort((a, b) =>
                b.monthKey.localeCompare(a.monthKey)
            ),
        }));
}

export function useActivitiesAudit(): UseActivitiesAuditResult {
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [generatedAt, setGeneratedAt] = useState<string | null>(null);

    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [allItems, setAllItems] = useState<ActivitiesAuditItem[]>([]);
    const [reconciliationWarnings, setReconciliationWarnings] = useState<
        ReconciliationWarning[]
    >([]);

    const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<AuditActivityType[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    async function reload() {
        setLoading(true);
        setErrorMessage("");

        try {
            const res = await fetch("/api/parqet/activities-audit");
            const data: ActivitiesAuditApiResponse = await res.json();

            if (!data.ok) {
                throw new Error(data.message || "Aktivitäten konnten nicht geladen werden.");
            }

            setGeneratedAt(data.generatedAt ?? null);
            setPortfolios(data.portfolios ?? []);
            setAllItems(data.items ?? []);
            setReconciliationWarnings(data.reconciliationWarnings ?? []);

            /**
             * Initial standardmäßig alle Portfolios aktiv schalten,
             * falls der Benutzer noch keine Auswahl getroffen hat.
             */
            setSelectedPortfolioIds((current) => {
                if (current.length > 0) {
                    return current;
                }

                return (data.portfolios ?? []).map((portfolio) => portfolio.id);
            });
        } catch (error) {
            setErrorMessage(
                `Aktivitäten konnten nicht geladen werden: ${error instanceof Error ? error.message : String(error)
                }`
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        reload();
    }, []);

    function togglePortfolio(portfolioId: string) {
        setSelectedPortfolioIds((current) => {
            if (current.includes(portfolioId)) {
                return current.filter((id) => id !== portfolioId);
            }

            return [...current, portfolioId];
        });
    }

    function toggleType(type: AuditActivityType) {
        setSelectedTypes((current) => {
            if (current.includes(type)) {
                return current.filter((entry) => entry !== type);
            }

            return [...current, type];
        });
    }

    function clearFilters() {
        setSelectedPortfolioIds(portfolios.map((portfolio) => portfolio.id));
        setSelectedTypes([]);
        setSearchTerm("");
    }

    const filteredItems = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return allItems.filter((item) => {
            const portfolioMatch =
                selectedPortfolioIds.length === 0 ||
                (item.portfolioId != null && selectedPortfolioIds.includes(item.portfolioId));

            const typeMatch =
                selectedTypes.length === 0 || selectedTypes.includes(item.type);

            const searchMatch =
                normalizedSearch.length === 0 ||
                [
                    item.name ?? "",
                    item.symbol ?? "",
                    item.wkn ?? "",
                    item.isin,
                    item.portfolioName,
                    item.rawType,
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(normalizedSearch);

            return portfolioMatch && typeMatch && searchMatch;
        });
    }, [allItems, searchTerm, selectedPortfolioIds, selectedTypes]);

    const filteredSummary = useMemo(() => {
        return buildSummary(filteredItems);
    }, [filteredItems]);

    const groupedYears = useMemo(() => {
        return groupByYearAndMonth(filteredItems);
    }, [filteredItems]);

    return {
        loading,
        errorMessage,
        generatedAt,

        portfolios,
        reconciliationWarnings,

        selectedPortfolioIds,
        selectedTypes,
        searchTerm,

        setSearchTerm,
        togglePortfolio,
        toggleType,
        clearFilters,
        reload,

        filteredItems,
        filteredSummary,
        groupedYears,
    };
}

export { ALL_TYPES };