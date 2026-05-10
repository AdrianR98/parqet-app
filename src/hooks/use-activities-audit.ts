// src/hooks/use-activities-audit.ts

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadDashboardCache } from "../lib/dashboard-cache";
import type {
  ActivitiesAuditItem,
  ActivitiesAuditPagination,
  ActivitiesAuditSummary,
  AuditActivityType,
  Portfolio,
  ReconciliationWarning,
} from "../lib/types";

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
    transferOutCount: items.filter((item) => item.type === "transfer_out")
      .length,
    unknownCount: items.filter((item) => item.type === "unknown").length,
  };
}

function buildLocalPortfolios(
  items: ActivitiesAuditItem[],
  selectedPortfolioIds: string[],
): Portfolio[] {
  const byId = new Map<string, Portfolio>();

  for (const item of items) {
    if (!item.portfolioId || byId.has(item.portfolioId)) continue;

    byId.set(item.portfolioId, {
      id: item.portfolioId,
      name: item.portfolioName,
      currency: "",
      createdAt: "",
      distinctBrokers: [],
    });
  }

  for (const portfolioId of selectedPortfolioIds) {
    if (byId.has(portfolioId)) continue;

    byId.set(portfolioId, {
      id: portfolioId,
      name: portfolioId,
      currency: "",
      createdAt: "",
      distinctBrokers: [],
    });
  }

  return Array.from(byId.values());
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
  pagination: ActivitiesAuditPagination;
  hasNextPage: boolean;
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
  loadNextPage: () => Promise<void>;
  clearFilters: () => void;
  reload: () => Promise<void>;
  startReconnect: () => void;
};

export function useActivitiesAudit(): UseActivitiesAuditResult {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [items, setItems] = useState<ActivitiesAuditItem[]>([]);
  const [reconciliationWarnings, setReconciliationWarnings] = useState<
    ReconciliationWarning[]
  >([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [authRequired] = useState(false);
  const [reconnectUrl] = useState("/api/auth/start");
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>(
    [],
  );
  const [selectedTypes, setSelectedTypes] =
    useState<AuditActivityType[]>(ALL_TYPES);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPortfolioMenu, setShowPortfolioMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadLocalSnapshot = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const cache = loadDashboardCache();

      if (!cache || !cache.activityItems?.length) {
        setItems([]);
        setPortfolios([]);
        setReconciliationWarnings([]);
        setGeneratedAt(cache?.lastUpdatedAt ?? cache?.generatedAt ?? "");
        setSelectedPortfolioIds(cache?.selectedPortfolioIds ?? []);
        setErrorMessage(
          "Noch keine lokalen Aktivitäten geladen. Lade oder aktualisiere Daten explizit im Dashboard.",
        );
        return;
      }

      const nextItems = cache.activityItems;
      const nextSelectedPortfolioIds = cache.selectedPortfolioIds ?? [];

      setItems(nextItems);
      setPortfolios(buildLocalPortfolios(nextItems, nextSelectedPortfolioIds));
      setReconciliationWarnings(cache.reconciliationWarnings ?? []);
      setGeneratedAt(cache.lastUpdatedAt ?? cache.generatedAt ?? "");
      setSelectedPortfolioIds(nextSelectedPortfolioIds);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLocalSnapshot();
  }, [loadLocalSnapshot]);

  const locallyFilteredItems = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const matchesPortfolio =
        selectedPortfolioIds.length === 0 ||
        (item.portfolioId
          ? selectedPortfolioIds.includes(item.portfolioId)
          : false);
      const matchesType = selectedTypes.includes(item.type);
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        [item.name, item.isin, item.symbol, item.wkn, item.portfolioName]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearchTerm),
          );

      return matchesPortfolio && matchesType && matchesSearch;
    });
  }, [items, searchTerm, selectedPortfolioIds, selectedTypes]);

  const pagination = useMemo<ActivitiesAuditPagination>(() => {
    const pageSize = 50;
    const totalItems = locallyFilteredItems.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const page = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);

    return {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: totalPages > 0 && page < totalPages,
      hasPreviousPage: page > 1,
    };
  }, [currentPage, locallyFilteredItems.length]);

  const filteredItems = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    return locallyFilteredItems.slice(
      startIndex,
      startIndex + pagination.pageSize,
    );
  }, [locallyFilteredItems, pagination.page, pagination.pageSize]);

  const filteredSummary = useMemo(
    () => buildSummary(locallyFilteredItems),
    [locallyFilteredItems],
  );

  const selectedPortfolioLabel = useMemo(() => {
    if (selectedPortfolioIds.length === 0) return "Keine Portfolios";
    if (
      portfolios.length > 0 &&
      selectedPortfolioIds.length === portfolios.length
    )
      return "Alle Portfolios";
    if (selectedPortfolioIds.length === 1) {
      const current = portfolios.find(
        (portfolio) => portfolio.id === selectedPortfolioIds[0],
      );
      return current?.name ?? "1 Portfolio";
    }
    return `${selectedPortfolioIds.length} Portfolios`;
  }, [portfolios, selectedPortfolioIds]);

  const selectedTypeLabel = useMemo(() => {
    if (selectedTypes.length === ALL_TYPES.length) return "Alle Typen";
    if (selectedTypes.length === 1) return selectedTypes[0];
    return `${selectedTypes.length} Typen`;
  }, [selectedTypes]);

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

        return {
          year,
          items: yearItems,
          months: Array.from(monthMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([monthKey, monthItems]) => ({
              monthKey,
              monthLabel: monthItems[0]?.monthLabel ?? monthKey,
              items: monthItems,
            })),
        };
      });
  }, [filteredItems]);

  function togglePortfolio(portfolioId: string) {
    setCurrentPage(1);
    setSelectedPortfolioIds((current) =>
      current.includes(portfolioId)
        ? current.filter((id) => id !== portfolioId)
        : [...current, portfolioId],
    );
  }

  function toggleType(type: AuditActivityType) {
    setCurrentPage(1);
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((entry) => entry !== type)
        : [...current, type],
    );
  }

  function handleSearchTermChange(value: string) {
    setCurrentPage(1);
    setSearchTerm(value);
  }

  function clearFilters() {
    setCurrentPage(1);
    setSelectedPortfolioIds(portfolios.map((portfolio) => portfolio.id));
    setSelectedTypes(ALL_TYPES);
    setSearchTerm("");
  }

  async function loadNextPage() {
    if (!pagination.hasNextPage || loading) return;
    setCurrentPage((prev) => prev + 1);
  }

  async function reloadActivities() {
    setCurrentPage(1);
    await loadLocalSnapshot();
  }

  function startReconnect() {
    window.location.href = reconnectUrl;
  }

  return {
    portfolios,
    items,
    filteredItems,
    filteredSummary:
      filteredItems.length > 0 ? filteredSummary : emptySummary(),
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
    pagination,
    hasNextPage: pagination.hasNextPage,
    setSearchTerm: handleSearchTermChange,
    setShowPortfolioMenu,
    setShowTypeMenu,
    togglePortfolio,
    toggleType,
    loadNextPage,
    clearFilters,
    reload: reloadActivities,
    startReconnect,
  };
}
