// src/lib/dashboard-cache.ts

import type {
  ActivitiesAuditItem,
  AssetSummary,
  ConsistencyReport,
  ReconciliationWarning,
  SnapshotFreshness,
} from "./types";
import type { ProductReadModelAssets } from "./parqet/global-assets/product-read-model";
import type { GuardedSourceSelection } from "./parqet/global-assets/product-surface-selectors";
import {
  LOCAL_STORAGE_LIMITS,
  parseJsonWithLimit,
  safeNonNegativeNumber,
  safeStringArray,
  safeTrimmedString,
} from "./local-storage-guards";

/**
 * Zentraler localStorage-Key fuer den Dashboard-Cache.
 *
 * WICHTIG:
 * Version auf v3 erhoeht, weil portfolioBreakdown fuer
 * ISIN-basierte Assets verpflichtend geworden ist.
 */
export const DASHBOARD_CACHE_KEY = "parqet-dashboard-cache-v3";

/**
 * Ab wann der Datenstand als veraltet markiert werden soll.
 * Aktuell: 5 Tage.
 */
export const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Struktur des localStorage-Caches fuer das Dashboard.
 */
export type DashboardCache = {
  activeAssets: AssetSummary[];
  closedAssets: AssetSummary[];
  rawActivityCount: number;
  filteredActivityCount: number;
  assetCount: number;
  activeAssetCount: number;
  closedAssetCount: number;
  consistencyReport: ConsistencyReport | null;
  reconciliationWarnings: ReconciliationWarning[];
  generatedAt: string | null;
  lastUpdatedAt: string | null;
  selectedPortfolioIds: string[];
  freshness?: SnapshotFreshness;
  activityItems?: ActivitiesAuditItem[];
  globalAssetProductReadModel?: ProductReadModelAssets | null;
  guardedSourceSelection?: GuardedSourceSelection | null;
};

/**
 * Prueft, ob der Code im Browser laeuft.
 * localStorage darf nur dort angesprochen werden.
 */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Validiert grob, ob ein Asset bereits die neue Struktur besitzt.
 *
 * Entscheidend ist hier vor allem:
 * - portfolioBreakdown muss vorhanden und ein Array sein
 * - isin, portfolioIds, portfolioNames muessen vorhanden sein
 *
 * Hintergrund:
 * Aeltere Cache-Eintraege aus v1 enthalten dieses Feld nicht.
 * Diese Daten duerfen nicht mehr wiederhergestellt werden, weil die
 * neue AssetTable sonst nur Fallback-Zeilen mit 0-Werten anzeigt.
 *
 * instrumentMetadataStatus ist fuer moderne Produktionsdaten vorhanden,
 * wird fuer Test- und Kompatibilitaetsfixtures aber toleriert, solange
 * die restliche v3-Shape gueltig ist.
 */
function isCacheAssetCompatible(asset: unknown): asset is AssetSummary {
  if (!asset || typeof asset !== "object") {
    return false;
  }

  const candidate = asset as Partial<AssetSummary>;

  return (
    typeof candidate.isin === "string" &&
    Array.isArray(candidate.portfolioIds) &&
    Array.isArray(candidate.portfolioNames) &&
    Array.isArray(candidate.portfolioBreakdown)
  );
}

/**
 * Validiert grob die geladene Cache-Struktur.
 *
 * Wenn die neue Struktur nicht vorhanden ist, wird der Cache komplett
 * verworfen, damit die App sauber frische Daten vom Server holt.
 */
function isDashboardCacheCompatible(cache: unknown): cache is DashboardCache {
  if (!cache || typeof cache !== "object") {
    return false;
  }

  const candidate = cache as Partial<DashboardCache>;

  if (
    !Array.isArray(candidate.activeAssets) ||
    !Array.isArray(candidate.closedAssets)
  ) {
    return false;
  }

  const activeAssetsValid = candidate.activeAssets.every(
    isCacheAssetCompatible,
  );
  const closedAssetsValid = candidate.closedAssets.every(
    isCacheAssetCompatible,
  );

  const reconciliationWarnings = candidate.reconciliationWarnings;
  const generatedAtValid =
    candidate.generatedAt === null || typeof candidate.generatedAt === "string";
  const selectedPortfolioIdsValid = Array.isArray(
    candidate.selectedPortfolioIds,
  );
  const activityItemsValid =
    candidate.activityItems === undefined ||
    Array.isArray(candidate.activityItems);
  const guardedProductReadModelValid =
    candidate.globalAssetProductReadModel === undefined ||
    candidate.globalAssetProductReadModel === null ||
    typeof candidate.globalAssetProductReadModel === "object";
  const guardedSelectionValid =
    candidate.guardedSourceSelection === undefined ||
    candidate.guardedSourceSelection === null ||
    typeof candidate.guardedSourceSelection === "object";

  return (
    activeAssetsValid &&
    closedAssetsValid &&
    selectedPortfolioIdsValid &&
    Array.isArray(reconciliationWarnings) &&
    generatedAtValid &&
    activityItemsValid &&
    guardedProductReadModelValid &&
    guardedSelectionValid
  );
}

function sanitizePortfolioBreakdownRows(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((row) => row && typeof row === "object")
    .slice(0, LOCAL_STORAGE_LIMITS.maxPortfolioBreakdownRowsPerAsset);
}

function sanitizeAssetSummary(asset: unknown): AssetSummary | null {
  if (!isCacheAssetCompatible(asset)) {
    return null;
  }

  const candidate = asset as AssetSummary;

  return {
    ...candidate,
    isin: safeTrimmedString(candidate.isin, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ?? "",
    portfolioIds: safeStringArray(
      candidate.portfolioIds,
      LOCAL_STORAGE_LIMITS.maxPortfolioIds,
      LOCAL_STORAGE_LIMITS.maxIdLikeChars,
    ),
    portfolioNames: safeStringArray(
      candidate.portfolioNames,
      LOCAL_STORAGE_LIMITS.maxPortfolioIds,
      LOCAL_STORAGE_LIMITS.maxPortfolioNameChars,
    ),
    portfolioBreakdown: sanitizePortfolioBreakdownRows(candidate.portfolioBreakdown) as AssetSummary["portfolioBreakdown"],
    name:
      safeTrimmedString(candidate.name, LOCAL_STORAGE_LIMITS.maxDisplayTextChars) ??
      null,
    assetName:
      safeTrimmedString(candidate.assetName, LOCAL_STORAGE_LIMITS.maxDisplayTextChars) ??
      null,
    displayName:
      safeTrimmedString(
        candidate.displayName,
        LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
      ) ?? null,
    title:
      safeTrimmedString(candidate.title, LOCAL_STORAGE_LIMITS.maxDisplayTextChars) ??
      null,
    symbol:
      safeTrimmedString(candidate.symbol, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    ticker:
      safeTrimmedString(candidate.ticker, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    tickerSymbol:
      safeTrimmedString(
        candidate.tickerSymbol,
        LOCAL_STORAGE_LIMITS.maxIdLikeChars,
      ) ?? null,
    wkn: safeTrimmedString(candidate.wkn, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ?? null,
    curatedName:
      safeTrimmedString(
        candidate.curatedName,
        LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
      ) ?? null,
    metadataSource:
      safeTrimmedString(
        candidate.metadataSource,
        LOCAL_STORAGE_LIMITS.maxIdLikeChars,
      ) ?? null,
    nameSource:
      safeTrimmedString(candidate.nameSource, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    displayNameSource:
      safeTrimmedString(
        candidate.displayNameSource,
        LOCAL_STORAGE_LIMITS.maxIdLikeChars,
      ) ?? null,
    instrumentDisplayName:
      safeTrimmedString(
        candidate.instrumentDisplayName,
        LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
      ) ?? null,
    instrumentName:
      safeTrimmedString(
        candidate.instrumentName,
        LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
      ) ?? null,
    instrumentMetadataError:
      safeTrimmedString(
        candidate.instrumentMetadataError,
        LOCAL_STORAGE_LIMITS.maxWarningMessageChars,
      ) ?? null,
  };
}

function sanitizeReconciliationWarning(
  warning: unknown,
): ReconciliationWarning | null {
  if (!warning || typeof warning !== "object") {
    return null;
  }

  const candidate = warning as ReconciliationWarning;
  const severity = candidate.severity;

  if (severity !== "info" && severity !== "warning" && severity !== "error") {
    return null;
  }

  return {
    ...candidate,
    isin: safeTrimmedString(candidate.isin, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ?? "",
    message:
      safeTrimmedString(
        candidate.message,
        LOCAL_STORAGE_LIMITS.maxWarningMessageChars,
      ) ?? "",
    source:
      candidate.source === "reconciliation" || candidate.source === "override"
        ? candidate.source
        : undefined,
    reviewStatus:
      candidate.reviewStatus === "open" ||
      candidate.reviewStatus === "overridden" ||
      candidate.reviewStatus === "accepted"
        ? candidate.reviewStatus
        : undefined,
    lastChangedAt:
      safeTrimmedString(candidate.lastChangedAt, LOCAL_STORAGE_LIMITS.maxDisplayTextChars) ??
      null,
  };
}

function sanitizeActivitiesAuditItem(item: unknown): ActivitiesAuditItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const candidate = item as ActivitiesAuditItem;
  const id = safeTrimmedString(candidate.id, LOCAL_STORAGE_LIMITS.maxIdLikeChars);
  const isin = safeTrimmedString(candidate.isin, LOCAL_STORAGE_LIMITS.maxIdLikeChars);
  const datetime = safeTrimmedString(
    candidate.datetime,
    LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
  );
  const monthKey = safeTrimmedString(
    candidate.monthKey,
    LOCAL_STORAGE_LIMITS.maxIdLikeChars,
  );
  const monthLabel = safeTrimmedString(
    candidate.monthLabel,
    LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
  );
  const rawType = safeTrimmedString(candidate.rawType, LOCAL_STORAGE_LIMITS.maxIdLikeChars);
  const portfolioName = safeTrimmedString(
    candidate.portfolioName,
    LOCAL_STORAGE_LIMITS.maxPortfolioNameChars,
  );

  if (!id || !isin || !datetime || !monthKey || !monthLabel || !rawType || !portfolioName) {
    return null;
  }

  return {
    ...candidate,
    id,
    isin,
    datetime,
    monthKey,
    monthLabel,
    rawType,
    portfolioId:
      safeTrimmedString(candidate.portfolioId, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    portfolioName,
    name:
      safeTrimmedString(candidate.name, LOCAL_STORAGE_LIMITS.maxDisplayTextChars) ??
      null,
    symbol:
      safeTrimmedString(candidate.symbol, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    wkn: safeTrimmedString(candidate.wkn, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ?? null,
    note:
      safeTrimmedString(candidate.note, LOCAL_STORAGE_LIMITS.maxWarningMessageChars) ??
      null,
    warningMessages: safeStringArray(
      candidate.warningMessages,
      LOCAL_STORAGE_LIMITS.maxWarningListItems,
      LOCAL_STORAGE_LIMITS.maxWarningMessageChars,
    ),
    instrumentMetadataError:
      safeTrimmedString(
        candidate.instrumentMetadataError,
        LOCAL_STORAGE_LIMITS.maxWarningMessageChars,
      ) ?? null,
  };
}

function sanitizeDashboardCache(cache: DashboardCache): DashboardCache {
  const mergedAssets = [...cache.activeAssets, ...cache.closedAssets]
    .map(sanitizeAssetSummary)
    .filter((asset): asset is AssetSummary => asset !== null)
    .slice(0, LOCAL_STORAGE_LIMITS.maxAssets);

  const activeAssets = mergedAssets.filter((asset) => asset.netShares > 1e-8);
  const closedAssets = mergedAssets.filter((asset) => asset.netShares <= 1e-8);

  const reconciliationWarnings = cache.reconciliationWarnings
    .map(sanitizeReconciliationWarning)
    .filter((warning): warning is ReconciliationWarning => warning !== null)
    .slice(0, LOCAL_STORAGE_LIMITS.maxWarnings);

  const activityItems =
    cache.activityItems?.map(sanitizeActivitiesAuditItem).filter(
      (item): item is ActivitiesAuditItem => item !== null,
    ) ?? [];

  return {
    ...cache,
    activeAssets,
    closedAssets,
    assetCount: safeNonNegativeNumber(cache.assetCount, activeAssets.length + closedAssets.length),
    activeAssetCount: safeNonNegativeNumber(cache.activeAssetCount, activeAssets.length),
    closedAssetCount: safeNonNegativeNumber(cache.closedAssetCount, closedAssets.length),
    rawActivityCount: safeNonNegativeNumber(cache.rawActivityCount),
    filteredActivityCount: safeNonNegativeNumber(cache.filteredActivityCount),
    selectedPortfolioIds: safeStringArray(
      cache.selectedPortfolioIds,
      LOCAL_STORAGE_LIMITS.maxPortfolioIds,
      LOCAL_STORAGE_LIMITS.maxIdLikeChars,
    ),
    generatedAt:
      safeTrimmedString(cache.generatedAt, LOCAL_STORAGE_LIMITS.maxDisplayTextChars) ??
      null,
    lastUpdatedAt:
      safeTrimmedString(cache.lastUpdatedAt, LOCAL_STORAGE_LIMITS.maxDisplayTextChars) ??
      null,
    reconciliationWarnings,
    activityItems: activityItems.slice(0, LOCAL_STORAGE_LIMITS.maxActivities),
  };
}

export function hasGuardedGlobalAssetCoexistence(cache: DashboardCache | null): boolean {
  if (!cache) {
    return false;
  }

  return Boolean(cache.globalAssetProductReadModel);
}

export function getGuardedGlobalAssetCoexistenceDiagnostics(cache: DashboardCache | null): {
  hasCoexistingProductReadModel: boolean;
  selectedSource: GuardedSourceSelection["selectedSource"] | "none";
  reason: GuardedSourceSelection["reason"] | "none";
  compatibilityAssetCount: number;
  productAssetCount: number;
  blockedMetricAssetCount: number;
} {
  const selection = cache?.guardedSourceSelection ?? null;
  const productAssets = cache?.globalAssetProductReadModel?.assets ?? [];

  return {
    hasCoexistingProductReadModel: Boolean(cache?.globalAssetProductReadModel),
    selectedSource: selection?.selectedSource ?? "none",
    reason: selection?.reason ?? "none",
    compatibilityAssetCount: (cache?.activeAssets.length ?? 0) + (cache?.closedAssets.length ?? 0),
    productAssetCount: productAssets.length,
    blockedMetricAssetCount: productAssets.filter((asset) => asset.blockedMetrics.length > 0).length,
  };
}

/**
 * Liest den Dashboard-Cache aus localStorage.
 *
 * Rueckgabe:
 * - DashboardCache bei gueltigen Daten
 * - null bei leerem, defektem oder veraltetem Cache
 */
export function loadDashboardCache(): DashboardCache | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY);

    if (!raw) {
      return null;
    }

    const parsedResult = parseJsonWithLimit(
      raw,
      LOCAL_STORAGE_LIMITS.maxRawPayloadChars,
    );
    if (!parsedResult) {
      return null;
    }
    if (parsedResult.oversized) {
      window.localStorage.removeItem(DASHBOARD_CACHE_KEY);
      return null;
    }
    const parsed = parsedResult.value;

    if (!isDashboardCacheCompatible(parsed)) {
      return null;
    }

    return sanitizeDashboardCache(parsed);
  } catch {
    return null;
  }
}

/**
 * Schreibt den Dashboard-Cache in localStorage.
 *
 * Fehler werden bewusst still behandelt, damit das Dashboard
 * auch dann weiter funktioniert, wenn localStorage blockiert ist.
 */
export function saveDashboardCache(cache: DashboardCache): void {
  if (!isBrowser()) {
    return;
  }

  try {
    const normalized = sanitizeDashboardCache(cache);
    const serialized = JSON.stringify(normalized);

    // Uebersize-Payloads werden nicht geschrieben, um localStorage nicht zu vergiften.
    if (serialized.length > LOCAL_STORAGE_LIMITS.maxRawPayloadChars) {
      return;
    }

    window.localStorage.setItem(DASHBOARD_CACHE_KEY, serialized);
  } catch {
    // localStorage-Fehler bewusst ignorieren
  }
}

/**
 * Entfernt den Dashboard-Cache komplett.
 */
export function clearDashboardCache(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(DASHBOARD_CACHE_KEY);
  } catch {
    // localStorage-Fehler bewusst ignorieren
  }
}
