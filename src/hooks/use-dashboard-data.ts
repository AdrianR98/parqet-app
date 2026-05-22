"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { enrichAssetsWithMetadata } from "../lib/asset-metadata";
import {
  loadDashboardCache,
  saveDashboardCache,
  type DashboardCache,
} from "../lib/dashboard-cache";
import {
  loadPortfolioScope,
  resolvePortfolioScope,
  saveKnownPortfolios,
  savePortfolioScope,
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
import { readGlobalAssetProductReadModel } from "../lib/parqet/global-assets/product-surface-selectors";
import type {
  AssetSummary,
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

type UseDashboardDataResult = {
  portfolios: Portfolio[];
  selectedPortfolioIds: string[];
  draftPortfolioIds: string[];
  selectedPortfolioCount: number;
  loadedPortfolioCount: number;
  isPortfolioDropdownOpen: boolean;
  showWarningsPanel: boolean;
  portfolioDropdownRef: React.RefObject<HTMLDivElement | null>;

  activeAssets: AssetSummary[];
  closedAssets: AssetSummary[];
  sortedActiveAssets: AssetSummary[];
  sortedClosedAssets: AssetSummary[];

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

  loadingPortfolios: boolean;
  loadingAssets: boolean;
  refreshingAssets: boolean;
  hasCachedData: boolean;
  errorMessage: string;
  authRequired: boolean;
  reconnectUrl: string;

  stats: DashboardStats;
  showStaleWarning: boolean;

  setIsPortfolioDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowWarningsPanel: React.Dispatch<React.SetStateAction<boolean>>;

  toggleDraftPortfolio: (portfolioId: string) => void;
  applyPortfolioFilter: () => void;
  resetPortfolioFilter: () => void;
  loadAssets: () => Promise<void>;
  startReconnect: () => void;
};

const INITIAL_PORTFOLIO_SCOPE: PortfolioScope = {
  mode: "all",
  selectedPortfolioIds: [],
};
const CLOSED_POSITION_EPSILON = 1e-8;

function splitAssetsByPosition(assets: AssetSummary[]): {
  activeAssets: AssetSummary[];
  closedAssets: AssetSummary[];
} {
  const activeAssets = assets.filter(
    (asset) => asset.netShares > CLOSED_POSITION_EPSILON,
  );
  const closedAssets = assets.filter(
    (asset) => asset.netShares <= CLOSED_POSITION_EPSILON,
  );

  return { activeAssets, closedAssets };
}

function haveSamePortfolioSelection(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.every((id, index) => id === sortedRight[index]);
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
    draftPortfolioIds,
    isPortfolioDropdownOpen,
    portfolioDropdownRef,
    setIsPortfolioDropdownOpen,
    toggleDraftPortfolio,
    applyPortfolioFilter,
    resetPortfolioFilter: resetPortfolioFilterInternal,
    hydratePortfolioSelection,
  } = usePortfolioFilter();

  const [activeAssets, setActiveAssets] = useState<AssetSummary[]>([]);
  const [closedAssets, setClosedAssets] = useState<AssetSummary[]>([]);
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

  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [refreshingAssets, setRefreshingAssets] = useState(false);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [reconnectUrl, setReconnectUrl] = useState("/api/auth/start");
  const assetLoadInFlightRef = useRef(false);
  const guardedGlobalAssetProductEnabled =
    resolveGlobalAssetProductGuardEnabled();

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
        const res = await fetch("/api/parqet/portfolios");
        const rawText = await res.text();
        const data: PortfoliosApiResponse = JSON.parse(rawText);

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

    const compatibilityActiveAssets = enrichAssetsWithMetadata(
      cached.activeAssets ?? [],
    );
    const compatibilityClosedAssets = enrichAssetsWithMetadata(
      cached.closedAssets ?? [],
    );
    const compatibilityAssets = [
      ...compatibilityActiveAssets,
      ...compatibilityClosedAssets,
    ];
    const rawGlobalAssetProductReadModel = cached.globalAssetProductReadModel ?? null;
    const canonicalSafeFieldSelection = selectCanonicalDashboardSafeFieldSource({
      compatibilityAssets,
      productReadModel: rawGlobalAssetProductReadModel,
      guardEnabled: guardedGlobalAssetProductEnabled,
    });
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

  async function loadAssets() {
    if (assetLoadInFlightRef.current) {
      return;
    }

    assetLoadInFlightRef.current = true;
    const hasVisibleData = activeAssets.length > 0 || closedAssets.length > 0;
    setLoadingAssets(!hasVisibleData);
    setRefreshingAssets(hasVisibleData);
    setErrorMessage("");

    try {
      const params = new URLSearchParams();

      for (const portfolioId of selectedPortfolioIds) {
        params.append("portfolioId", portfolioId);
      }

      params.set("refresh", "1");

      const res = await fetch(`/api/parqet/assets?${params.toString()}`);
      const rawText = await res.text();
      const data: AssetsApiResponse = JSON.parse(rawText);

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

      const nextActiveAssets = enrichAssetsWithMetadata(
        data.activeAssets ?? [],
      );
      const nextClosedAssets = enrichAssetsWithMetadata(
        data.closedAssets ?? [],
      );
      const compatibilityAssets = [...nextActiveAssets, ...nextClosedAssets];
      const dataWithCoexistence = data as AssetsApiResponse & {
        globalAssetProductReadModel?: unknown;
      };
      const rawGlobalAssetProductReadModel =
        dataWithCoexistence.globalAssetProductReadModel ?? null;
      const globalAssetProductReadModel = readGlobalAssetProductReadModel(
        rawGlobalAssetProductReadModel,
      );
      const canonicalSafeFieldSelection = selectCanonicalDashboardSafeFieldSource({
        compatibilityAssets,
        productReadModel: rawGlobalAssetProductReadModel,
        guardEnabled: guardedGlobalAssetProductEnabled,
      });
      const selectedAssets = splitAssetsByPosition(
        canonicalSafeFieldSelection.assets,
      );
      const nextGeneratedAt = data.generatedAt ?? new Date().toISOString();

      setActiveAssets(selectedAssets.activeAssets);
      setClosedAssets(selectedAssets.closedAssets);
      setRawActivityCount(data.rawActivityCount ?? 0);
      setFilteredActivityCount(data.filteredActivityCount ?? 0);
      setAssetCount(canonicalSafeFieldSelection.assets.length);
      setActiveAssetCount(selectedAssets.activeAssets.length);
      setClosedAssetCount(selectedAssets.closedAssets.length);
      setConsistencyReport(data.consistencyReport ?? null);
      setReconciliationWarnings(data.reconciliationWarnings ?? []);
      setLastUpdatedAt(nextGeneratedAt);
      setLastLoadedPortfolioIds(selectedPortfolioIds);
      setHasCachedData(true);

      const cachePayload: DashboardCache = {
        activeAssets: nextActiveAssets,
        closedAssets: nextClosedAssets,
        rawActivityCount: data.rawActivityCount ?? 0,
        filteredActivityCount: data.filteredActivityCount ?? 0,
        assetCount: data.assetCount ?? 0,
        activeAssetCount: data.activeAssetCount ?? nextActiveAssets.length,
        closedAssetCount: data.closedAssetCount ?? nextClosedAssets.length,
        consistencyReport: data.consistencyReport ?? null,
        reconciliationWarnings: data.reconciliationWarnings ?? [],
        generatedAt: nextGeneratedAt,
        lastUpdatedAt: nextGeneratedAt,
        selectedPortfolioIds,
        freshness: data.freshness,
        activityItems: data.activityItems ?? [],
        globalAssetProductReadModel,
        guardedSourceSelection: canonicalSafeFieldSelection.selection,
      };

      saveDashboardCache(cachePayload);
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
  }

  function applyPortfolioFilterCompat() {
    applyPortfolioFilter();
  }

  function resetPortfolioFilter() {
    const allIds = portfolios.map((portfolio) => portfolio.id);
    resetPortfolioFilterInternal(allIds);
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
    setPortfolioScope(nextScope);
    setMissingPortfolioScopeIds([]);
    setUsedPortfolioScopeFallback(false);
  }, [portfolios, selectedPortfolioIds]);

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
    draftPortfolioIds,
    selectedPortfolioCount,
    loadedPortfolioCount,
    isPortfolioDropdownOpen,
    showWarningsPanel,
    portfolioDropdownRef,

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

    loadingPortfolios,
    loadingAssets,
    refreshingAssets,
    hasCachedData,
    errorMessage,
    authRequired,
    reconnectUrl,

    stats,
    showStaleWarning,

    setIsPortfolioDropdownOpen,
    setShowWarningsPanel,

    toggleDraftPortfolio,
    applyPortfolioFilter: applyPortfolioFilterCompat,
    resetPortfolioFilter,
    loadAssets,
    startReconnect,
  };
}
