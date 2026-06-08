"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { enrichAssetsWithMetadata } from "../lib/asset-metadata";
import { loadDashboardCache } from "../lib/dashboard-cache";
import { shouldAutoRefreshDashboardData } from "../lib/dashboard-auto-refresh";
import {
  loadPortfolioScope,
  resolvePortfolioScope,
  saveKnownPortfolios,
  savePortfolioScope,
  subscribeToLocalSettings,
  type PortfolioScope,
} from "../lib/app-settings";
import {
  buildDashboardStats,
  isDashboardDataStale,
  resolveGlobalAssetProductGuardEnabled,
  selectCanonicalDashboardSafeFieldSource,
  sortActiveAssets,
  sortClosedAssets,
} from "../lib/dashboard-helpers";
import { splitAssetsByPosition } from "../lib/calculations/view-model-aggregates";
import { persistDashboardCacheWrite } from "../lib/dashboard-cache-writer";
import type {
  GlobalAssetViewModel,
  AssetsApiResponse,
  ConsistencyReport,
  DashboardStats,
  Portfolio,
  PortfoliosApiResponse,
  ReconciliationWarning,
} from "../lib/types";
import {
  messageForDiagnostic,
  type ParqetApiDiagnostic,
} from "../lib/parqet-api-diagnostics";
import { usePortfolioFilter } from "./use-portfolio-filter";

const sharedDashboardRequestRegistry = new Map<string, Promise<unknown>>();

type UseDashboardDataResult = {
  portfolios: Portfolio[];
  selectedPortfolioIds: string[];
  selectedPortfolioCount: number;
  loadedPortfolioCount: number;
  showWarningsPanel: boolean;

  activeAssets: GlobalAssetViewModel[];
  closedAssets: GlobalAssetViewModel[];
  sortedActiveAssets: GlobalAssetViewModel[];
  sortedClosedAssets: GlobalAssetViewModel[];

  rawActivityCount: number;
  filteredActivityCount: number;
  assetCount: number;
  activeAssetCount: number;
  closedAssetCount: number;
  consistencyReport: ConsistencyReport | null;
  reconciliationWarnings: ReconciliationWarning[];
  lastUpdatedAt: string | null;
  hasPendingPortfolioSelection: boolean;
  selectedPortfoliosMissingInLocalLoad: string[];
  missingPortfolioScopeIds: string[];
  usedPortfolioScopeFallback: boolean;
  hasEmptyManualScopeIntersection: boolean;

  loadingPortfolios: boolean;
  loadingAssets: boolean;
  refreshingAssets: boolean;
  hasCachedData: boolean;
  errorMessage: string;
  authRequired: boolean;
  reconnectUrl: string;

  stats: DashboardStats;
  showStaleWarning: boolean;

  setShowWarningsPanel: React.Dispatch<React.SetStateAction<boolean>>;

  togglePortfolio: (portfolioId: string) => void;
  resetPortfolioSelection: () => void;
  loadAssets: (
    nextSelectedPortfolioIds?: string[],
    options?: { explicitRefresh?: boolean },
  ) => Promise<void>;
  startReconnect: () => void;
};

const INITIAL_PORTFOLIO_SCOPE: PortfolioScope = {
  mode: "all",
  selectedPortfolioIds: [],
};
function haveSamePortfolioSelection(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

function haveSameStringSet(left: string[], right: string[]): boolean {
  return haveSamePortfolioSelection(left, right);
}

function buildDashboardScopeKey(portfolioIds: string[]): string {
  return [...portfolioIds].sort().join("|");
}

export function buildDashboardAssetRequestKey(
  portfolioIds: string[],
  explicitRefresh = false,
): string {
  const scopeKey = buildDashboardScopeKey(portfolioIds);
  return explicitRefresh ? `assets:refresh:${scopeKey}` : `assets:${scopeKey}`;
}

export function getOrCreateSharedDashboardRequest<T>(
  registry: Map<string, Promise<unknown>>,
  key: string,
  createRequest: () => Promise<T>,
): Promise<T> {
  const existing = registry.get(key) as Promise<T> | undefined;

  if (existing) {
    return existing;
  }

  const request = createRequest().finally(() => {
    if (registry.get(key) === request) {
      registry.delete(key);
    }
  });

  registry.set(key, request as Promise<unknown>);
  return request;
}

function getResponseDiagnostic(
  data: AssetsApiResponse | PortfoliosApiResponse,
): ParqetApiDiagnostic | null {
  const diagnostic = (data as { diagnostic?: ParqetApiDiagnostic }).diagnostic;
  return diagnostic?.category ? diagnostic : null;
}

function getUserFacingErrorMessage(
  data: AssetsApiResponse | PortfoliosApiResponse,
  fallback: string,
): string {
  const diagnostic = getResponseDiagnostic(data);

  if (diagnostic) {
    return messageForDiagnostic(diagnostic);
  }

  return data.message || fallback;
}

function getUserFacingCaughtErrorMessage(error: unknown, fallback: string): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = rawMessage.toLowerCase();

  if (rawMessage.includes("Bitte ") || rawMessage.includes("bitte ")) {
    return rawMessage;
  }

  if (lowerMessage.includes("rate limit") || lowerMessage.includes("429")) {
    return messageForDiagnostic({ category: "rate_limit" });
  }

  if (
    lowerMessage.includes("provider") ||
    lowerMessage.includes("parqet") ||
    lowerMessage.includes("fetch failed")
  ) {
    return `${fallback} Parqet konnte die Daten gerade nicht liefern. Bitte versuche es später manuell erneut.`;
  }

  return `${fallback} Bitte versuche es später manuell erneut.`;
}

export function useDashboardData(): UseDashboardDataResult {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [showWarningsPanel, setShowWarningsPanel] = useState(false);

  const {
    selectedPortfolioIds,
    togglePortfolio,
    resetPortfolioSelection,
    hydratePortfolioSelection,
  } = usePortfolioFilter();

  const [activeAssets, setActiveAssets] = useState<GlobalAssetViewModel[]>([]);
  const [closedAssets, setClosedAssets] = useState<GlobalAssetViewModel[]>([]);
  const [rawActivityCount, setRawActivityCount] = useState(0);
  const [filteredActivityCount, setFilteredActivityCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
  const [activeAssetCount, setActiveAssetCount] = useState(0);
  const [closedAssetCount, setClosedAssetCount] = useState(0);
  const [consistencyReport, setConsistencyReport] =
    useState<ConsistencyReport | null>(null);
  const [reconciliationWarnings, setReconciliationWarnings] = useState<
    ReconciliationWarning[]
  >([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [lastLoadedPortfolioIds, setLastLoadedPortfolioIds] = useState<
    string[]
  >([]);
  const [portfolioScope, setPortfolioScope] = useState<PortfolioScope>(
    INITIAL_PORTFOLIO_SCOPE,
  );
  const [missingPortfolioScopeIds, setMissingPortfolioScopeIds] = useState<
    string[]
  >([]);
  const [usedPortfolioScopeFallback, setUsedPortfolioScopeFallback] =
    useState(false);
  const [hasEmptyManualScopeIntersection, setHasEmptyManualScopeIntersection] =
    useState(false);

  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [refreshingAssets, setRefreshingAssets] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [reconnectUrl, setReconnectUrl] = useState("/api/auth/start");
  const assetLoadInFlightRef = useRef(false);
  const autoRefreshExecutedKeysRef = useRef<Set<string>>(new Set());
  const selectedPortfolioIdsRef = useRef<string[]>(selectedPortfolioIds);
  const portfolioScopeRef = useRef<PortfolioScope>(portfolioScope);
  const missingPortfolioScopeIdsRef = useRef<string[]>(missingPortfolioScopeIds);
  const usedPortfolioScopeFallbackRef = useRef<boolean>(usedPortfolioScopeFallback);
  const guardedGlobalAssetProductEnabled =
    resolveGlobalAssetProductGuardEnabled();

  useEffect(() => {
    selectedPortfolioIdsRef.current = selectedPortfolioIds;
  }, [selectedPortfolioIds]);

  useEffect(() => {
    portfolioScopeRef.current = portfolioScope;
  }, [portfolioScope]);

  useEffect(() => {
    missingPortfolioScopeIdsRef.current = missingPortfolioScopeIds;
  }, [missingPortfolioScopeIds]);

  useEffect(() => {
    usedPortfolioScopeFallbackRef.current = usedPortfolioScopeFallback;
  }, [usedPortfolioScopeFallback]);

  function applyAuthState(message?: string, url?: string) {
    setAuthRequired(true);
    setReconnectUrl(url || "/api/auth/start");
    setErrorMessage(
      message ||
        "Die Parqet-Verbindung ist nicht mehr aktiv. Bitte verbinde Parqet erneut, bevor du Daten lädst.",
    );
  }

  function clearAuthState() {
    setAuthRequired(false);
    setReconnectUrl("/api/auth/start");
  }

  function startReconnect() {
    window.location.href = reconnectUrl || "/api/auth/start";
  }

  useEffect(() => {
    async function loadPortfolios() {
      setLoadingPortfolios(true);
      setErrorMessage("");

      try {
        const data = await getOrCreateSharedDashboardRequest(
          sharedDashboardRequestRegistry,
          "portfolios",
          async () => {
            const res = await fetch("/api/parqet/portfolios");
            const rawText = await res.text();
            return JSON.parse(rawText) as PortfoliosApiResponse;
          },
        );

        if (!data.ok) {
          if (data.authRequired) {
            applyAuthState(data.message, data.reconnectUrl);
            return;
          }

          throw new Error(
            getUserFacingErrorMessage(
              data,
              "Portfolios konnten nicht geladen werden. Bitte versuche es später manuell erneut.",
            ),
          );
        }

        clearAuthState();

        const items = data.portfolios?.items ?? [];
        setPortfolios(items);
        saveKnownPortfolios(items);

        const scope = loadPortfolioScope();
        const resolvedScope = resolvePortfolioScope(scope, items);

        setPortfolioScope(resolvedScope.scope);
        setMissingPortfolioScopeIds(resolvedScope.missingPortfolioIds);
        setUsedPortfolioScopeFallback(resolvedScope.usedFallback);
        setHasEmptyManualScopeIntersection(resolvedScope.hasEmptyManualIntersection);
        hydratePortfolioSelection(resolvedScope.selectedPortfolioIds);

        if (resolvedScope.usedFallback) {
          savePortfolioScope(resolvedScope.scope);
        }

      } catch (error) {
        setErrorMessage(
          getUserFacingCaughtErrorMessage(
            error,
            "Portfolios konnten nicht geladen werden.",
          ),
        );
      } finally {
        setLoadingPortfolios(false);
      }
    }

    loadPortfolios();
  }, [hydratePortfolioSelection]);

  useEffect(() => {
    const cached = loadDashboardCache();

    if (!cached) {
      return;
    }

    const cachedActiveAssets = enrichAssetsWithMetadata(
      cached.activeAssets ?? [],
    );
    const cachedClosedAssets = enrichAssetsWithMetadata(
      cached.closedAssets ?? [],
    );
    const cachedAssets = [
      ...cachedActiveAssets,
      ...cachedClosedAssets,
    ];
    const rawGlobalAssetProductReadModel = cached.globalAssetProductReadModel ?? null;
    const canonicalSafeFieldSelection = selectCanonicalDashboardSafeFieldSource({
      runtimeFallbackAssets: cachedAssets,
      productReadModel: rawGlobalAssetProductReadModel,
      guardEnabled: guardedGlobalAssetProductEnabled,
    });
    // This selection may still resolve to runtime fallback for compatibility.
    const selectedAssets = splitAssetsByPosition(
      canonicalSafeFieldSelection.assets,
    );

    setActiveAssets(selectedAssets.activeAssets);
    setClosedAssets(selectedAssets.closedAssets);
    setRawActivityCount(cached.rawActivityCount ?? 0);
    setFilteredActivityCount(cached.filteredActivityCount ?? 0);
    setAssetCount(canonicalSafeFieldSelection.assets.length);
    setActiveAssetCount(selectedAssets.activeAssets.length);
    setClosedAssetCount(selectedAssets.closedAssets.length);
    setConsistencyReport(cached.consistencyReport ?? null);
    setReconciliationWarnings(cached.reconciliationWarnings ?? []);
    setLastUpdatedAt(cached.lastUpdatedAt ?? null);
    setLastLoadedPortfolioIds(cached.selectedPortfolioIds ?? []);
    setHasCachedData(true);

    if (cached.selectedPortfolioIds?.length) {
      hydratePortfolioSelection(cached.selectedPortfolioIds);
    }
  }, [guardedGlobalAssetProductEnabled, hydratePortfolioSelection]);

  const effectiveSelectedPortfolioIds = useMemo(() => {
    if (selectedPortfolioIds.length > 0) {
      return selectedPortfolioIds;
    }

    if (portfolios.length === 0) {
      return [];
    }

    const resolvedScope = resolvePortfolioScope(portfolioScope, portfolios);
    return resolvedScope.selectedPortfolioIds;
  }, [selectedPortfolioIds, portfolios, portfolioScope]);

  const loadAssets = useCallback(async function loadAssets(
    nextSelectedPortfolioIds?: string[],
    options?: { explicitRefresh?: boolean },
  ) {
    if (assetLoadInFlightRef.current) {
      return;
    }

    const portfolioIdsForLoad = nextSelectedPortfolioIds ?? selectedPortfolioIdsRef.current;

    assetLoadInFlightRef.current = true;
    const hasVisibleData = activeAssets.length > 0 || closedAssets.length > 0;
    setLoadingAssets(!hasVisibleData);
    setRefreshingAssets(hasVisibleData);
    setErrorMessage("");

    try {
      const params = new URLSearchParams();

      for (const portfolioId of portfolioIdsForLoad) {
        params.append("portfolioId", portfolioId);
      }

      if (options?.explicitRefresh) {
        params.set("refresh", "1");
      }

      const data = await getOrCreateSharedDashboardRequest(
        sharedDashboardRequestRegistry,
        buildDashboardAssetRequestKey(
          portfolioIdsForLoad,
          options?.explicitRefresh === true,
        ),
        async () => {
          const res = await fetch(`/api/parqet/assets?${params.toString()}`);
          const rawText = await res.text();
          return JSON.parse(rawText) as AssetsApiResponse;
        },
      );

      if (!data.ok) {
        if (data.authRequired) {
          applyAuthState(data.message, data.reconnectUrl);
          return;
        }

        throw new Error(
          getUserFacingErrorMessage(
            data,
            "Assets konnten nicht geladen werden. Bitte versuche es später manuell erneut.",
          ),
        );
      }

      clearAuthState();

      const preparedCacheWrite = persistDashboardCacheWrite({
        response: data,
        selectedPortfolioIds: portfolioIdsForLoad,
        guardEnabled: guardedGlobalAssetProductEnabled,
      });

      setActiveAssets(preparedCacheWrite.selectedActiveAssets);
      setClosedAssets(preparedCacheWrite.selectedClosedAssets);
      setRawActivityCount(data.rawActivityCount ?? 0);
      setFilteredActivityCount(data.filteredActivityCount ?? 0);
      setAssetCount(preparedCacheWrite.selectedAssets.length);
      setActiveAssetCount(preparedCacheWrite.selectedActiveAssets.length);
      setClosedAssetCount(preparedCacheWrite.selectedClosedAssets.length);
      setConsistencyReport(data.consistencyReport ?? null);
      setReconciliationWarnings(data.reconciliationWarnings ?? []);
      setLastUpdatedAt(preparedCacheWrite.generatedAt);
      setLastLoadedPortfolioIds(portfolioIdsForLoad);
      setHasCachedData(true);

    } catch (error) {
      setErrorMessage(
        getUserFacingCaughtErrorMessage(
          error,
          "Assets konnten nicht geladen werden.",
        ),
      );
    } finally {
      assetLoadInFlightRef.current = false;
      setLoadingAssets(false);
      setRefreshingAssets(false);
    }
  }, [
    activeAssets.length,
    closedAssets.length,
    guardedGlobalAssetProductEnabled,
  ]);

  function resetPortfolioSelectionToAll() {
    const allIds = portfolios.map((portfolio) => portfolio.id);
    resetPortfolioSelection(allIds);
  }

  useEffect(() => {
    if (portfolios.length === 0) {
      return;
    }

    const allIds = portfolios.map((portfolio) => portfolio.id);
    const nextScope: PortfolioScope = haveSamePortfolioSelection(
      selectedPortfolioIds,
      allIds,
    )
      ? { mode: "all", selectedPortfolioIds: [] }
      : { mode: "manual", selectedPortfolioIds };

    savePortfolioScope(nextScope);
    setPortfolioScope((current) => (
      current.mode === nextScope.mode &&
      haveSameStringSet(current.selectedPortfolioIds, nextScope.selectedPortfolioIds)
        ? current
        : nextScope
    ));
    setMissingPortfolioScopeIds((current) => (
      current.length === 0 ? current : []
    ));
    setUsedPortfolioScopeFallback((current) => (
      current ? false : current
    ));
    setHasEmptyManualScopeIntersection(false);
  }, [portfolios, selectedPortfolioIds]);

  useEffect(() => {
    if (portfolios.length === 0) {
      return;
    }

    function syncSelectionFromScope() {
      const resolvedScope = resolvePortfolioScope(loadPortfolioScope(), portfolios);
      if (!haveSameStringSet(selectedPortfolioIdsRef.current, resolvedScope.selectedPortfolioIds)) {
        hydratePortfolioSelection(resolvedScope.selectedPortfolioIds);
      }

      if (
        portfolioScopeRef.current.mode !== resolvedScope.scope.mode ||
        !haveSameStringSet(portfolioScopeRef.current.selectedPortfolioIds, resolvedScope.scope.selectedPortfolioIds)
      ) {
        setPortfolioScope(resolvedScope.scope);
      }

      if (!haveSameStringSet(missingPortfolioScopeIdsRef.current, resolvedScope.missingPortfolioIds)) {
        setMissingPortfolioScopeIds(resolvedScope.missingPortfolioIds);
      }

      if (usedPortfolioScopeFallbackRef.current !== resolvedScope.usedFallback) {
        setUsedPortfolioScopeFallback(resolvedScope.usedFallback);
      }

      setHasEmptyManualScopeIntersection((current) => (
        current === resolvedScope.hasEmptyManualIntersection
          ? current
          : resolvedScope.hasEmptyManualIntersection
      ));
    }

    syncSelectionFromScope();
    return subscribeToLocalSettings(syncSelectionFromScope);
  }, [portfolios, hydratePortfolioSelection]);

  useEffect(() => {
    const hasPortfoliosMissingFromCache =
      hasCachedData &&
      effectiveSelectedPortfolioIds.some((id) => !lastLoadedPortfolioIds.includes(id));
    const decision = shouldAutoRefreshDashboardData({
      loadingPortfolios,
      loadingAssets,
      refreshingAssets,
      hasPortfolios: portfolios.length > 0,
      selectedPortfolioIds: effectiveSelectedPortfolioIds,
      hasCachedData,
      isCacheStale: isDashboardDataStale(lastUpdatedAt),
      hasPortfoliosMissingFromCache,
      alreadyExecutedKeys: autoRefreshExecutedKeysRef.current,
    });

    if (!decision.shouldRefresh || !decision.executionKey) {
      return;
    }

    autoRefreshExecutedKeysRef.current.add(decision.executionKey);
    void loadAssets(effectiveSelectedPortfolioIds, {
      explicitRefresh: decision.reason !== "cached_revalidate",
    });
  }, [
    loadingPortfolios,
    loadingAssets,
    refreshingAssets,
    portfolios,
    selectedPortfolioIds,
    effectiveSelectedPortfolioIds,
    hasCachedData,
    lastUpdatedAt,
    lastLoadedPortfolioIds,
    loadAssets,
  ]);

  const selectedPortfolioCount = useMemo(() => {
    return portfolios.filter((portfolio) =>
      selectedPortfolioIds.includes(portfolio.id),
    ).length;
  }, [portfolios, selectedPortfolioIds]);

  const loadedPortfolioCount = useMemo(() => {
    return lastLoadedPortfolioIds.length;
  }, [lastLoadedPortfolioIds]);

  const hasPendingPortfolioSelection = useMemo(() => {
    return (
      hasCachedData &&
      !haveSamePortfolioSelection(selectedPortfolioIds, lastLoadedPortfolioIds)
    );
  }, [hasCachedData, selectedPortfolioIds, lastLoadedPortfolioIds]);

  const selectedPortfoliosMissingInLocalLoad = useMemo(() => {
    if (!hasCachedData) {
      return [];
    }

    const loadedIds = new Set(lastLoadedPortfolioIds);
    return selectedPortfolioIds.filter((id) => !loadedIds.has(id));
  }, [hasCachedData, lastLoadedPortfolioIds, selectedPortfolioIds]);

  useEffect(() => {
    if (portfolios.length === 0) {
      return;
    }

    const resolvedScope = resolvePortfolioScope(portfolioScope, portfolios);
    setMissingPortfolioScopeIds(resolvedScope.missingPortfolioIds);
    setUsedPortfolioScopeFallback(resolvedScope.usedFallback);
    setHasEmptyManualScopeIntersection(resolvedScope.hasEmptyManualIntersection);
  }, [portfolioScope, portfolios]);

  const stats: DashboardStats = useMemo(() => {
    return buildDashboardStats({
      activeAssets,
      closedAssets,
      rawActivityCount,
      filteredActivityCount,
      assetCount,
      activeAssetCount,
      closedAssetCount,
    });
  }, [
    activeAssets,
    closedAssets,
    rawActivityCount,
    filteredActivityCount,
    assetCount,
    activeAssetCount,
    closedAssetCount,
  ]);

  const sortedActiveAssets = useMemo(() => {
    return sortActiveAssets(activeAssets);
  }, [activeAssets]);

  const sortedClosedAssets = useMemo(() => {
    return sortClosedAssets(closedAssets);
  }, [closedAssets]);

  const showStaleWarning = useMemo(() => {
    return isDashboardDataStale(lastUpdatedAt);
  }, [lastUpdatedAt]);

  return {
    portfolios,
    selectedPortfolioIds,
    selectedPortfolioCount,
    loadedPortfolioCount,
    showWarningsPanel,

    activeAssets,
    closedAssets,
    sortedActiveAssets,
    sortedClosedAssets,

    rawActivityCount,
    filteredActivityCount,
    assetCount,
    activeAssetCount,
    closedAssetCount,
    consistencyReport,
    reconciliationWarnings,
    lastUpdatedAt,
    hasPendingPortfolioSelection,
    selectedPortfoliosMissingInLocalLoad,
    missingPortfolioScopeIds,
    usedPortfolioScopeFallback,
    hasEmptyManualScopeIntersection,

    loadingPortfolios,
    loadingAssets,
    refreshingAssets,
    hasCachedData,
    errorMessage,
    authRequired,
    reconnectUrl,

    stats,
    showStaleWarning,

    setShowWarningsPanel,

    togglePortfolio,
    resetPortfolioSelection: resetPortfolioSelectionToAll,
    loadAssets,
    startReconnect,
  };
}

