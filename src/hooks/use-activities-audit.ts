"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
    ActivitiesAuditApiResponse,
    ActivitiesAuditItem,
    ActivitiesAuditSummary,
    AuditActivityType,
    Portfolio,
    ReconciliationWarning,
} from "../lib/types";

type UseActivitiesAuditResult = {
    portfolios: Portfolio[];
    items: ActivitiesAuditItem[];
    filteredItems: ActivitiesAuditItem[];
    filteredSummary: ActivitiesAuditSummary;
    reconciliationWarnings: ReconciliationWarning[];
    generatedAt: string;
    loading: boolean;
    errorMessage: string;
    authRequired: boolean;
    reconnectUrl: string;
    selectedPortfolioIds: string[];
    selectedTypes: AuditActivityType[];
    searchTerm: string;
    showPortfolioMenu: boolean;
    showTypeMenu: boolean;
    selectedPortfolioLabel: string;
    selectedTypeLabel: string;
    groupedYears: Array<{
        year: number;
        items: ActivitiesAuditItem[];
        months: Array<{
            monthKey: string;
            monthLabel: string;
            items: ActivitiesAuditItem[];
        }>;
    }>;
    setSearchTerm: (value: string) => void;
    setShowPortfolioMenu: React.Dispatch<React.SetStateAction<boolean>>;
    setShowTypeMenu: React.Dispatch<React.SetStateAction<boolean>>;
    togglePortfolio: (portfolioId: string) => void;
    toggleType: (type: AuditActivityType) => void;
    clearFilters: () => void;
    reload: () => Promise<void>;
    startReconnect: () => void;
};

const ALL_TYPES: AuditActivityType[] = [
    "buy",
    "sell",
    "dividend",
    "transfer_in",
    "transfer_out",
    "unknown",
];

function emptySummary(): ActivitiesAuditSummary {
    return {
        total: 0,
        buyCount: 0,
        sellCount: 0,
        dividendCount: 0,
        transferInCount: 0,
        transferOutCount: 0,
        unknownCount: 0,
    };
}

function buildSummary(items: ActivitiesAuditItem[]): ActivitiesAuditSummary {
    return {
        total: items.length,
        buyCount: items.filter((item) => item.type === "buy").length,
        sellCount: items.filter((item) => item.type === "sell").length,
        dividendCount: items.filter((item) => item.type === "dividend").length,
        transferInCount: items.filter((item) => item.type === "transfer_in").length,
        transferOutCount: items.filter((item) => item.type === "transfer_out").length,
        unknownCount: items.filter((item) => item.type === "unknown").length,
    };
}

export function useActivitiesAudit(): UseActivitiesAuditResult {
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [items, setItems] = useState<ActivitiesAuditItem[]>([]);
    const [reconciliationWarnings, setReconciliationWarnings] = useState<ReconciliationWarning[]>([]);
    const [generatedAt, setGeneratedAt] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [authRequired, setAuthRequired] = useState(false);
    const [reconnectUrl, setReconnectUrl] = useState("/api/auth/start");

    const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<AuditActivityType[]>(ALL_TYPES);
    const [searchTerm, setSearchTerm] = useState("");
    const [showPortfolioMenu, setShowPortfolioMenu] = useState(false);
    const [showTypeMenu, setShowTypeMenu] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");

        try {
            const params = new URLSearchParams();

            for (const portfolioId of selectedPortfolioIds) {
                params.append("portfolioId", portfolioId);
            }

            const response = await fetch(`/api/parqet/activities-audit?${params.toString()}`);
            const json = (await response.json()) as ActivitiesAuditApiResponse;

            if (!response.ok || !json.ok) {
                if (json.authRequired) {
                    setAuthRequired(true);
                    setReconnectUrl(json.reconnectUrl || "/api/auth/start");
                    setErrorMessage(
                        json.message ||
                        "Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden."
                    );
                    setPortfolios([]);
                    setItems([]);
                    setReconciliationWarnings([]);
                    setGeneratedAt("");
                    return;
                }

                throw new Error(json.message || "Aktivitäten konnten nicht geladen werden.");
            }

            setAuthRequired(false);
            setReconnectUrl("/api/auth/start");
            setPortfolios(json.portfolios ?? []);
            setItems(json.items ?? []);
            setReconciliationWarnings(json.reconciliationWarnings ?? []);
            setGeneratedAt(json.generatedAt ?? "");
        } catch (error: unknown) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Aktivitäten konnten nicht geladen werden."
            );
            setPortfolios([]);
            setItems([]);
            setReconciliationWarnings([]);
            setGeneratedAt("");
        } finally {
            setLoading(false);
        }
    }, [selectedPortfolioIds]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (portfolios.length === 0 || selectedPortfolioIds.length > 0) {
            return;
        }

        setSelectedPortfolioIds(portfolios.map((portfolio) => portfolio.id));
    }, [portfolios, selectedPortfolioIds.length]);

    const filteredItems = useMemo(() => {
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();

        return items.filter((item) => {
            const matchesPortfolio =
                selectedPortfolioIds.length === 0 ||
                selectedPortfolioIds.includes(item.portfolioId ?? "");

            const matchesType = selectedTypes.includes(item.type);

            const matchesSearch =
                normalizedSearchTerm.length === 0 ||
                [
                    item.name,
                    item.isin,
                    item.symbol,
                    item.wkn,
                    item.portfolioName,
                ]
                    .filter(Boolean)
                    .some((value) =>
                        String(value).toLowerCase().includes(normalizedSearchTerm)
                    );

            return matchesPortfolio && matchesType && matchesSearch;
        });
    }, [items, searchTerm, selectedPortfolioIds, selectedTypes]);

    const filteredSummary = useMemo(() => buildSummary(filteredItems), [filteredItems]);

    const selectedPortfolioLabel = useMemo(() => {
        if (selectedPortfolioIds.length === 0 || selectedPortfolioIds.length === portfolios.length) {
            return "Alle Portfolios";
        }

        if (selectedPortfolioIds.length === 1) {
            const current = portfolios.find((portfolio) => portfolio.id === selectedPortfolioIds[0]);
            return current?.name ?? "1 Portfolio";
        }

        return `${selectedPortfolioIds.length} Portfolios`;
    }, [portfolios, selectedPortfolioIds]);

    const selectedTypeLabel = useMemo(() => {
        if (selectedTypes.length === ALL_TYPES.length) {
            return "Alle Typen";
        }

        if (selectedTypes.length === 1) {
            return selectedTypes[0];
        }

        return `${selectedTypes.length} Typen`;
    }, [selectedTypes]);

    const groupedYears = useMemo(() => {
        const yearMap = new Map<number, ActivitiesAuditItem[]>();

        for (const item of filteredItems) {
            const current = yearMap.get(item.year) ?? [];
            current.push(item);
            yearMap.set(item.year, current);
        }

        return Array.from(yearMap.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([year, yearItems]) => {
                const monthMap = new Map<string, ActivitiesAuditItem[]>();

                for (const item of yearItems) {
                    const current = monthMap.get(item.monthKey) ?? [];
                    current.push(item);
                    monthMap.set(item.monthKey, current);
                }

                const months = Array.from(monthMap.entries())
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([monthKey, monthItems]) => ({
                        monthKey,
                        monthLabel: monthItems[0]?.monthLabel ?? monthKey,
                        items: monthItems,
                    }));

                return {
                    year,
                    items: yearItems,
                    months,
                };
            });
    }, [filteredItems]);

    function togglePortfolio(portfolioId: string) {
        setSelectedPortfolioIds((current) =>
            current.includes(portfolioId)
                ? current.filter((id) => id !== portfolioId)
                : [...current, portfolioId]
        );
    }

    function toggleType(type: AuditActivityType) {
        setSelectedTypes((current) =>
            current.includes(type)
                ? current.filter((entry) => entry !== type)
                : [...current, type]
        );
    }

    function clearFilters() {
        setSelectedPortfolioIds(portfolios.map((portfolio) => portfolio.id));
        setSelectedTypes(ALL_TYPES);
        setSearchTerm("");
    }

    function startReconnect() {
        window.location.href = reconnectUrl || "/api/auth/start";
    }

    return {
        portfolios,
        items,
        filteredItems,
        filteredSummary,
        reconciliationWarnings,
        generatedAt,
        loading,
        errorMessage,
        authRequired,
        reconnectUrl,
        selectedPortfolioIds,
        selectedTypes,
        searchTerm,
        showPortfolioMenu,
        showTypeMenu,
        selectedPortfolioLabel,
        selectedTypeLabel,
        groupedYears,
        setSearchTerm,
        setShowPortfolioMenu,
        setShowTypeMenu,
        togglePortfolio,
        toggleType,
        clearFilters,
        reload: load,
        startReconnect,
    };
}