// src/hooks/use-activities-audit.ts

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

/**
 * ============================================================
 * DEBUG
 * ============================================================
 *
 * Zentraler Debug-Schalter für den Activities-Hook.
 * Falls die Logs später stören, hier deaktivieren.
 */
const DEBUG_ACTIVITIES_AUDIT = true;

function debugLog(message: string, payload?: unknown) {
    if (!DEBUG_ACTIVITIES_AUDIT) return;
    console.debug(`[use-activities-audit] ${message}`, payload ?? "");
}

function debugError(message: string, error: unknown) {
    console.error(`[use-activities-audit] ${message}`, error);
}

/**
 * ============================================================
 * KONSTANTEN
 * ============================================================
 */
const ALL_TYPES: AuditActivityType[] = [
    "buy",
    "sell",
    "dividend",
    "transfer_in",
    "transfer_out",
    "unknown",
];

/**
 * ============================================================
 * HELPER: LEERE SUMMARY
 * ============================================================
 */
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

/**
 * ============================================================
 * HELPER: SUMMARY AUS ITEMS
 * ============================================================
 *
 * Typischer Erweiterungspunkt:
 * - weitere Activity-Typen
 * - Betragsaggregationen
 * - Netto-/Brutto-Summen
 */
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

type GroupedYear = {
    year: number;
    items: ActivitiesAuditItem[];
    months: Array<{
        monthKey: string;
        monthLabel: string;
        items: ActivitiesAuditItem[];
    }>;
};

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
    groupedYears: GroupedYear[];
    setSearchTerm: (value: string) => void;
    setShowPortfolioMenu: React.Dispatch<React.SetStateAction<boolean>>;
    setShowTypeMenu: React.Dispatch<React.SetStateAction<boolean>>;
    togglePortfolio: (portfolioId: string) => void;
    toggleType: (type: AuditActivityType) => void;
    clearFilters: () => void;
    reload: () => Promise<void>;
    startReconnect: () => void;
};

export function useActivitiesAudit(): UseActivitiesAuditResult {
    /**
     * ------------------------------------------------------------
     * DATA STATE
     * ------------------------------------------------------------
     */
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [items, setItems] = useState<ActivitiesAuditItem[]>([]);
    const [reconciliationWarnings, setReconciliationWarnings] = useState<ReconciliationWarning[]>([]);
    const [generatedAt, setGeneratedAt] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [authRequired, setAuthRequired] = useState(false);
    const [reconnectUrl, setReconnectUrl] = useState("/api/auth/start");

    /**
     * ------------------------------------------------------------
     * FILTER / UI STATE
     * ------------------------------------------------------------
     */
    const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<AuditActivityType[]>(ALL_TYPES);
    const [searchTerm, setSearchTerm] = useState("");
    const [showPortfolioMenu, setShowPortfolioMenu] = useState(false);
    const [showTypeMenu, setShowTypeMenu] = useState(false);

    /**
     * ------------------------------------------------------------
     * INITIALISIERUNG
     * ------------------------------------------------------------
     *
     * Wichtig:
     * - Portfolios müssen zuerst geladen werden
     * - danach setzen wir initial alle Portfolio-IDs als Auswahl
     * - erst dann wird die Activities-Route aufgerufen
     *
     * Das behebt genau den Fehler:
     * "No portfolioId parameters provided."
     */
    const [portfoliosLoaded, setPortfoliosLoaded] = useState(false);
    const [selectionInitialized, setSelectionInitialized] = useState(false);

    /**
     * ------------------------------------------------------------
     * PORTFOLIOS LADEN
     * ------------------------------------------------------------
     */
    const loadPortfolios = useCallback(async () => {
        debugLog("Loading portfolios for activities page");

        try {
            const response = await fetch("/api/parqet/portfolios", {
                method: "GET",
                cache: "no-store",
            });

            const json = (await response.json()) as {
                ok: boolean;
                portfolios?: { items: Portfolio[] };
                authRequired?: boolean;
                reconnectUrl?: string;
                message?: string;
                details?: string;
            };

            if (!response.ok || !json.ok) {
                if (json.authRequired) {
                    setAuthRequired(true);
                    setReconnectUrl(json.reconnectUrl || "/api/auth/start");
                    setErrorMessage(
                        json.message ||
                        "Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden."
                    );

                    setPortfolios([]);
                    setPortfoliosLoaded(true);
                    return;
                }

                throw new Error(
                    [json.message, json.details].filter(Boolean).join(" — ") ||
                    "Portfolios konnten nicht geladen werden."
                );
            }

            const nextPortfolios = json.portfolios?.items ?? [];
            setPortfolios(nextPortfolios);
            setAuthRequired(false);
            setReconnectUrl("/api/auth/start");

            debugLog("Portfolios loaded", {
                count: nextPortfolios.length,
            });
        } catch (error) {
            debugError("Loading portfolios failed", error);

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Portfolios konnten nicht geladen werden."
            );
            setPortfolios([]);
        } finally {
            setPortfoliosLoaded(true);
        }
    }, []);

    /**
     * ------------------------------------------------------------
     * INITIAL PORTFOLIO LOAD
     * ------------------------------------------------------------
     */
    useEffect(() => {
        loadPortfolios();
    }, [loadPortfolios]);

    /**
     * ------------------------------------------------------------
     * SELECTION INITIALISIEREN
     * ------------------------------------------------------------
     *
     * Sobald Portfolios geladen sind und noch keine Auswahl existiert,
     * wählen wir standardmäßig alle Portfolios aus.
     */
    useEffect(() => {
        if (!portfoliosLoaded) {
            return;
        }

        if (selectionInitialized) {
            return;
        }

        const allPortfolioIds = portfolios.map((portfolio) => portfolio.id);

        debugLog("Initializing selected portfolios", {
            count: allPortfolioIds.length,
            ids: allPortfolioIds,
        });

        setSelectedPortfolioIds(allPortfolioIds);
        setSelectionInitialized(true);
    }, [portfolios, portfoliosLoaded, selectionInitialized]);

    /**
     * ------------------------------------------------------------
     * ACTIVITIES LADEN
     * ------------------------------------------------------------
     *
     * Sehr wichtig:
     * - erst wenn Selection initialisiert ist
     * - und nur mit nicht-leerer Portfolio-Liste
     */
    const load = useCallback(async () => {
        if (!selectionInitialized) {
            debugLog("Skipping activities load because selection is not initialized yet");
            return;
        }

        if (selectedPortfolioIds.length === 0) {
            debugLog("Skipping activities load because no selected portfolios exist");
            setItems([]);
            setReconciliationWarnings([]);
            setGeneratedAt("");
            return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
            const params = new URLSearchParams();

            for (const portfolioId of selectedPortfolioIds) {
                params.append("portfolioId", portfolioId);
            }

            debugLog("Loading activities audit", {
                selectedPortfolioIds,
                query: params.toString(),
            });

            const response = await fetch(`/api/parqet/activities-audit?${params.toString()}`, {
                method: "GET",
                cache: "no-store",
            });

            const json = (await response.json()) as ActivitiesAuditApiResponse;

            if (!response.ok || !json.ok) {
                if (json.authRequired) {
                    setAuthRequired(true);
                    setReconnectUrl(json.reconnectUrl || "/api/auth/start");
                    setErrorMessage(
                        json.message ||
                        "Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden."
                    );
                    setItems([]);
                    setReconciliationWarnings([]);
                    setGeneratedAt("");
                    return;
                }

                throw new Error(
                    [json.message, json.details].filter(Boolean).join(" — ") ||
                    "Aktivitäten konnten nicht geladen werden."
                );
            }

            setAuthRequired(false);
            setReconnectUrl("/api/auth/start");
            setItems(json.items ?? []);
            setReconciliationWarnings(json.reconciliationWarnings ?? []);
            setGeneratedAt(json.generatedAt ?? "");

            debugLog("Activities audit loaded", {
                itemCount: json.items?.length ?? 0,
                warningCount: json.reconciliationWarnings?.length ?? 0,
            });
        } catch (error) {
            debugError("Loading activities audit failed", error);

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Aktivitäten konnten nicht geladen werden."
            );
            setItems([]);
            setReconciliationWarnings([]);
            setGeneratedAt("");
        } finally {
            setLoading(false);
        }
    }, [selectedPortfolioIds, selectionInitialized]);

    /**
     * ------------------------------------------------------------
     * ACTIVITIES AUTO-LOAD
     * ------------------------------------------------------------
     */
    useEffect(() => {
        load();
    }, [load]);

    /**
     * ------------------------------------------------------------
     * FILTER: ITEM LISTE
     * ------------------------------------------------------------
     */
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

    /**
     * ------------------------------------------------------------
     * SUMMARY
     * ------------------------------------------------------------
     */
    const filteredSummary = useMemo(() => {
        return buildSummary(filteredItems);
    }, [filteredItems]);

    /**
     * ------------------------------------------------------------
     * LABELS
     * ------------------------------------------------------------
     */
    const selectedPortfolioLabel = useMemo(() => {
        if (selectedPortfolioIds.length === 0) {
            return "Keine Portfolios";
        }

        if (selectedPortfolioIds.length === portfolios.length) {
            return "Alle Portfolios";
        }

        if (selectedPortfolioIds.length === 1) {
            const current = portfolios.find(
                (portfolio) => portfolio.id === selectedPortfolioIds[0]
            );
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

    /**
     * ------------------------------------------------------------
     * GROUPING: YEAR -> MONTH
     * ------------------------------------------------------------
     *
     * Typischer Erweiterungspunkt:
     * - Tagesgruppen
     * - Quartalsgruppen
     * - andere Sortierung
     */
    const groupedYears = useMemo<GroupedYear[]>(() => {
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

    /**
     * ------------------------------------------------------------
     * ACTIONS: FILTER
     * ------------------------------------------------------------
     */
    function togglePortfolio(portfolioId: string) {
        debugLog("Toggle portfolio filter", { portfolioId });

        setSelectedPortfolioIds((current) =>
            current.includes(portfolioId)
                ? current.filter((id) => id !== portfolioId)
                : [...current, portfolioId]
        );
    }

    function toggleType(type: AuditActivityType) {
        debugLog("Toggle type filter", { type });

        setSelectedTypes((current) =>
            current.includes(type)
                ? current.filter((entry) => entry !== type)
                : [...current, type]
        );
    }

    function clearFilters() {
        debugLog("Clearing activities filters");

        setSelectedPortfolioIds(portfolios.map((portfolio) => portfolio.id));
        setSelectedTypes(ALL_TYPES);
        setSearchTerm("");
    }

    function startReconnect() {
        debugLog("Starting reconnect", { reconnectUrl });
        window.location.href = reconnectUrl || "/api/auth/start";
    }

    return {
        portfolios,
        items,
        filteredItems,
        filteredSummary: filteredItems.length > 0 ? filteredSummary : emptySummary(),
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