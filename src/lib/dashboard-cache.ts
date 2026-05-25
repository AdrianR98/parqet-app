// src/lib/dashboard-cache.ts

import type {
  ActivitiesAuditItem,
  AssetInstrumentPrimaryMapping,
  AssetInstrumentSnapshot,
  AssetMetadata,
  AssetSummary,
  ConsistencyReport,
  PortfolioPosition,
  ReconciliationWarning,
  SnapshotFreshness,
} from "./types";
import type { ProductReadModelAssets } from "./parqet/global-assets/product-read-model";
import type { GuardedSourceSelection } from "./parqet/global-assets/product-surface-selectors";
import {
  LOCAL_STORAGE_LIMITS,
  parseJsonWithLimit,
  safeBoolean,
  safeFiniteNumber,
  safeNullableFiniteNumber,
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
export const DASHBOARD_CACHE_CHANGED_EVENT = "assettrace:dashboard-cache-changed";

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

export function notifyDashboardCacheChanged(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.dispatchEvent(new Event(DASHBOARD_CACHE_CHANGED_EVENT));
  } catch {
    // ignore browser event dispatch errors
  }
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

function sanitizeInstrumentMetadataStatus(
  value: unknown,
): AssetSummary["instrumentMetadataStatus"] | undefined {
  return value === "ok" ||
    value === "missing" ||
    value === "db_unavailable" ||
    value === "missing_name"
    ? value
    : undefined;
}

function sanitizeMarketDataStatus(
  value: unknown,
): AssetInstrumentSnapshot["marketDataStatus"] {
  return value === "active" ||
    value === "excluded" ||
    value === "legacy" ||
    value === "derivative" ||
    value === "unknown" ||
    value === null
    ? value
    : null;
}

function sanitizeAssetMetadataLike(value: unknown): Partial<AssetMetadata> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AssetMetadata> & { logoUrl?: unknown };

  return {
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
    metadataUpdatedAt:
      safeTrimmedString(
        candidate.metadataUpdatedAt,
        LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
      ) ?? null,
    instrumentMetadataStatus: sanitizeInstrumentMetadataStatus(
      candidate.instrumentMetadataStatus,
    ),
    instrumentMetadataError:
      safeTrimmedString(
        candidate.instrumentMetadataError,
        LOCAL_STORAGE_LIMITS.maxWarningMessageChars,
      ) ?? null,
    marketPrice: safeNullableFiniteNumber(candidate.marketPrice),
    marketPriceAt:
      safeTrimmedString(
        candidate.marketPriceAt,
        LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
      ) ?? null,
    marketPriceSource:
      safeTrimmedString(
        candidate.marketPriceSource,
        LOCAL_STORAGE_LIMITS.maxIdLikeChars,
      ) ?? null,
    currency:
      safeTrimmedString(candidate.currency, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    assetType:
      safeTrimmedString(candidate.assetType, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    exchange:
      safeTrimmedString(candidate.exchange, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    logoUrl:
      safeTrimmedString(candidate.logoUrl, LOCAL_STORAGE_LIMITS.maxLogoUrlChars) ??
      null,
  };
}

function sanitizeInstrumentPrimaryMapping(
  value: unknown,
): AssetInstrumentPrimaryMapping | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AssetInstrumentPrimaryMapping>;
  const provider = safeTrimmedString(
    candidate.provider,
    LOCAL_STORAGE_LIMITS.maxIdLikeChars,
  );
  const symbol = safeTrimmedString(
    candidate.symbol,
    LOCAL_STORAGE_LIMITS.maxIdLikeChars,
  );

  if (!provider || !symbol) {
    return null;
  }

  return {
    provider,
    symbol,
    exchange:
      safeTrimmedString(candidate.exchange, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    currency:
      safeTrimmedString(candidate.currency, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    verifiedAt:
      safeTrimmedString(candidate.verifiedAt, LOCAL_STORAGE_LIMITS.maxDisplayTextChars) ??
      null,
    isPrimary: safeBoolean(candidate.isPrimary),
    isActive: safeBoolean(candidate.isActive),
  };
}

function sanitizeInstrumentSnapshot(value: unknown): AssetInstrumentSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AssetInstrumentSnapshot>;
  const isin = safeTrimmedString(candidate.isin, LOCAL_STORAGE_LIMITS.maxIdLikeChars);
  const metadataStatus = sanitizeInstrumentMetadataStatus(candidate.metadataStatus);

  if (!isin || !metadataStatus) {
    return null;
  }

  return {
    isin,
    displayName:
      safeTrimmedString(
        candidate.displayName,
        LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
      ) ?? null,
    name:
      safeTrimmedString(candidate.name, LOCAL_STORAGE_LIMITS.maxDisplayTextChars) ??
      null,
    wkn: safeTrimmedString(candidate.wkn, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ?? null,
    assetType:
      safeTrimmedString(candidate.assetType, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    currency:
      safeTrimmedString(candidate.currency, LOCAL_STORAGE_LIMITS.maxIdLikeChars) ??
      null,
    metadataStatus,
    metadataError:
      safeTrimmedString(
        candidate.metadataError,
        LOCAL_STORAGE_LIMITS.maxWarningMessageChars,
      ) ?? null,
    marketDataStatus: sanitizeMarketDataStatus(candidate.marketDataStatus),
    marketDataStatusReason:
      safeTrimmedString(
        candidate.marketDataStatusReason,
        LOCAL_STORAGE_LIMITS.maxWarningMessageChars,
      ) ?? null,
    marketDataSuccessorIsin:
      safeTrimmedString(
        candidate.marketDataSuccessorIsin,
        LOCAL_STORAGE_LIMITS.maxIdLikeChars,
      ) ?? null,
    marketDataSuccessorSymbol:
      safeTrimmedString(
        candidate.marketDataSuccessorSymbol,
        LOCAL_STORAGE_LIMITS.maxIdLikeChars,
      ) ?? null,
    primaryMapping: sanitizeInstrumentPrimaryMapping(candidate.primaryMapping),
  };
}

function sanitizePortfolioBreakdownRow(value: unknown): PortfolioPosition | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PortfolioPosition>;
  const portfolioId = safeTrimmedString(
    candidate.portfolioId,
    LOCAL_STORAGE_LIMITS.maxIdLikeChars,
  );
  const portfolioName = safeTrimmedString(
    candidate.portfolioName,
    LOCAL_STORAGE_LIMITS.maxPortfolioNameChars,
  );

  if (!portfolioId || !portfolioName) {
    return null;
  }

  return {
    portfolioId,
    portfolioName,
    netShares: safeFiniteNumber(candidate.netShares),
    remainingCostBasis: safeFiniteNumber(candidate.remainingCostBasis),
    avgBuyPrice: safeNullableFiniteNumber(candidate.avgBuyPrice),
    latestTradePrice: safeNullableFiniteNumber(candidate.latestTradePrice),
    marketPrice: safeNullableFiniteNumber(candidate.marketPrice),
    positionValue: safeNullableFiniteNumber(candidate.positionValue),
    unrealizedPnL: safeNullableFiniteNumber(candidate.unrealizedPnL),
    totalDividendNet: safeFiniteNumber(candidate.totalDividendNet),
  };
}

function sanitizeGlobalAssetProductReadModel(
  value: unknown,
): ProductReadModelAssets | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as ProductReadModelAssets;
  if (!Array.isArray(candidate.assets)) {
    return null;
  }

  if (candidate.assets.length > LOCAL_STORAGE_LIMITS.maxAssets) {
    return null;
  }

  return candidate;
}

function sanitizeGuardedSourceSelection(value: unknown): GuardedSourceSelection | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as GuardedSourceSelection;

  const selectedSourceValid =
    candidate.selectedSource === "compatibility" ||
    candidate.selectedSource === "global_asset_product";
  const reasonValid =
    candidate.reason === "guard_not_enabled" ||
    candidate.reason === "product_read_model_missing" ||
    candidate.reason === "product_read_model_invalid" ||
    candidate.reason === "product_read_model_not_fresh" ||
    candidate.reason === "product_read_model_scope_mismatch" ||
    candidate.reason === "product_read_model_ready";

  if (
    !selectedSourceValid ||
    !reasonValid ||
    !Array.isArray(candidate.blockedMetrics) ||
    !Array.isArray(candidate.fallbackFields)
  ) {
    return null;
  }

  return candidate;
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
    portfolioBreakdown: sanitizePortfolioBreakdownRows(candidate.portfolioBreakdown)
      .map(sanitizePortfolioBreakdownRow)
      .filter((row): row is PortfolioPosition => row !== null),
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
    metadata: sanitizeAssetMetadataLike(candidate.metadata),
    externalMetadata: sanitizeAssetMetadataLike(candidate.externalMetadata),
    assetMeta: sanitizeAssetMetadataLike(candidate.assetMeta),
    instrument: sanitizeInstrumentSnapshot(candidate.instrument),
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
    globalAssetProductReadModel: sanitizeGlobalAssetProductReadModel(
      cache.globalAssetProductReadModel,
    ),
    guardedSourceSelection: sanitizeGuardedSourceSelection(
      cache.guardedSourceSelection,
    ),
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
    notifyDashboardCacheChanged();
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
    notifyDashboardCacheChanged();
  } catch {
    // localStorage-Fehler bewusst ignorieren
  }
}
