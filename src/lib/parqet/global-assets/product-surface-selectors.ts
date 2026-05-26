import type { AssetSummary, PortfolioPosition } from "../../types";
import type {
  ProductReadModelAssetRow,
  ProductReadModelAssets,
  ProductReadModelConfidence,
  ProductReadModelFreshnessState,
  ProductReadModelSourceScope,
  ProductReadModelSourceType,
  ProductReadModelScopeState,
} from "./product-read-model";
import type { BlockedMetric } from "./types";

export type CanonicalSafeFieldSurfaceId = "dashboard" | "asset_table" | "reports";

export type CanonicalSafeFieldProductSource = "compatibility" | "global_asset_product";

export type CanonicalSafeFieldSelectionReason =
  | "guard_not_enabled"
  | "product_read_model_missing"
  | "product_read_model_invalid"
  | "product_read_model_not_fresh"
  | "product_read_model_scope_mismatch"
  | "product_read_model_ready";

export type CanonicalSafeFieldFallbackField =
  | "position_value"
  | "unrealized_pnl"
  | "remaining_cost_basis"
  | "avg_buy_price"
  | "net_shares"
  | "total_dividend_net";

export type CanonicalSafeFieldSelectionDiagnostics = {
  readModelId: string | null;
  compatibilityAssetCount: number;
  productAssetCount: number;
  blockedMetricAssetCount: number;
  blockedMetricCount: number;
  sourceType: ProductReadModelSourceType | "none";
  sourceScope: ProductReadModelSourceScope | "none";
  freshnessState: ProductReadModelFreshnessState | "none";
  scopeState: ProductReadModelScopeState | "none";
  confidence: ProductReadModelConfidence | "none";
  providerRequestCount: number | null;
  warningCount: number;
};

export type CanonicalSafeFieldSelection = {
  surface: CanonicalSafeFieldSurfaceId;
  selectedSource: CanonicalSafeFieldProductSource;
  reason: CanonicalSafeFieldSelectionReason;
  blockedMetrics: BlockedMetric[];
  fallbackFields: CanonicalSafeFieldFallbackField[];
  diagnostics: CanonicalSafeFieldSelectionDiagnostics;
};

export type SelectCanonicalSafeFieldSourceInput = {
  surface: CanonicalSafeFieldSurfaceId;
  compatibilityAssets: AssetSummary[];
  productReadModel?: unknown;
  guardEnabled: boolean;
};

export type GuardedSurfaceId = CanonicalSafeFieldSurfaceId;
export type GuardedProductSource = CanonicalSafeFieldProductSource;
export type GuardedSourceSelectionReason = CanonicalSafeFieldSelectionReason;
export type GuardedFallbackField = CanonicalSafeFieldFallbackField;
export type GuardedSourceSelectionDiagnostics = CanonicalSafeFieldSelectionDiagnostics;
export type GuardedSourceSelection = CanonicalSafeFieldSelection;
export type SelectGuardedSourceInput = SelectCanonicalSafeFieldSourceInput;

const ALWAYS_COMPATIBILITY_FALLBACK_FIELDS: CanonicalSafeFieldFallbackField[] = [
  "position_value",
  "unrealized_pnl",
  "remaining_cost_basis",
  "avg_buy_price",
  "net_shares",
  "total_dividend_net",
];

function uniqueBlockedMetrics(rows: ProductReadModelAssetRow[]): BlockedMetric[] {
  return Array.from(new Set(rows.flatMap((row) => row.blockedMetrics)));
}

function blockedMetricsToFallbackFields(metrics: BlockedMetric[]): CanonicalSafeFieldFallbackField[] {
  const fallbackFields = new Set<CanonicalSafeFieldFallbackField>(
    ALWAYS_COMPATIBILITY_FALLBACK_FIELDS,
  );

  for (const metric of metrics) {
    if (metric === "market_value") {
      fallbackFields.add("position_value");
    }

    if (metric === "unrealized_pnl" || metric === "realized_gains") {
      fallbackFields.add("unrealized_pnl");
    }

    if (metric === "cost_basis") {
      fallbackFields.add("remaining_cost_basis");
      fallbackFields.add("avg_buy_price");
    }

    if (metric === "position" || metric === "portfolio_breakdown") {
      fallbackFields.add("net_shares");
    }

    if (metric === "dividends") {
      fallbackFields.add("total_dividend_net");
    }
  }

  return Array.from(fallbackFields);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isProductReadModelPortfolioBreakdown(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.portfolioId === "string" &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.blockedMetrics)
  );
}

function isProductReadModelAssetRow(value: unknown): value is ProductReadModelAssetRow {
  if (!isRecord(value) || !isRecord(value.identity) || !isRecord(value.display)) {
    return false;
  }

  return (
    typeof value.display.displayName === "string" &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.blockedMetrics) &&
    Array.isArray(value.portfolioBreakdown) &&
    value.portfolioBreakdown.every(isProductReadModelPortfolioBreakdown)
  );
}

export function readGlobalAssetProductReadModel(value: unknown): ProductReadModelAssets | null {
  if (!isRecord(value)) {
    return null;
  }

  const metadata = value.metadata;
  const summary = value.summary;

  if (
    !isRecord(metadata) ||
    !isRecord(summary) ||
    !Array.isArray(value.assets) ||
    !value.assets.every(isProductReadModelAssetRow)
  ) {
    return null;
  }

  if (
    typeof metadata.readModelId !== "string" ||
    typeof metadata.sourceType !== "string" ||
    typeof metadata.sourceScope !== "string" ||
    typeof metadata.freshnessState !== "string" ||
    typeof metadata.scopeState !== "string" ||
    typeof metadata.confidence !== "string"
  ) {
    return null;
  }

  return value as ProductReadModelAssets;
}

function isFreshEnoughForCanonicalSafeFieldSelection(state: ProductReadModelFreshnessState): boolean {
  return state === "fresh";
}

function isScopeCompatibleForCanonicalSafeFieldSelection(state: ProductReadModelScopeState): boolean {
  return state === "scope_match" || state === "scope_subset";
}

function buildDiagnostics(input: {
  compatibilityAssets: AssetSummary[];
  productReadModel: ProductReadModelAssets | null;
}): CanonicalSafeFieldSelectionDiagnostics {
  const productAssets = input.productReadModel?.assets ?? [];
  const blockedMetrics = uniqueBlockedMetrics(productAssets);
  const warningCount = productAssets.reduce((count, row) => count + row.warnings.length, 0);

  return {
    readModelId: input.productReadModel?.metadata.readModelId ?? null,
    compatibilityAssetCount: input.compatibilityAssets.length,
    productAssetCount: productAssets.length,
    blockedMetricAssetCount: productAssets.filter((row) => row.blockedMetrics.length > 0).length,
    blockedMetricCount: blockedMetrics.length,
    sourceType: input.productReadModel?.metadata.sourceType ?? "none",
    sourceScope: input.productReadModel?.metadata.sourceScope ?? "none",
    freshnessState: input.productReadModel?.metadata.freshnessState ?? "none",
    scopeState: input.productReadModel?.metadata.scopeState ?? "none",
    confidence: input.productReadModel?.metadata.confidence ?? "none",
    providerRequestCount: input.productReadModel?.metadata.providerRequestCount ?? null,
    warningCount,
  };
}

export function selectCanonicalSafeFieldProductSurfaceSource(
  input: SelectCanonicalSafeFieldSourceInput,
): CanonicalSafeFieldSelection {
  const productReadModel = readGlobalAssetProductReadModel(input.productReadModel);
  const diagnostics = buildDiagnostics({
    compatibilityAssets: input.compatibilityAssets,
    productReadModel,
  });
  const blockedMetrics = uniqueBlockedMetrics(productReadModel?.assets ?? []);
  const fallbackFields = blockedMetricsToFallbackFields(blockedMetrics);

  if (!input.guardEnabled) {
    return {
      surface: input.surface,
      selectedSource: "compatibility",
      reason: "guard_not_enabled",
      blockedMetrics,
      fallbackFields,
      diagnostics,
    };
  }

  if (input.productReadModel == null) {
    return {
      surface: input.surface,
      selectedSource: "compatibility",
      reason: "product_read_model_missing",
      blockedMetrics,
      fallbackFields,
      diagnostics,
    };
  }

  if (!productReadModel) {
    return {
      surface: input.surface,
      selectedSource: "compatibility",
      reason: "product_read_model_invalid",
      blockedMetrics,
      fallbackFields,
      diagnostics,
    };
  }

  if (input.compatibilityAssets.length > 0 && productReadModel.assets.length === 0) {
    return {
      surface: input.surface,
      selectedSource: "compatibility",
      reason: "product_read_model_missing",
      blockedMetrics,
      fallbackFields,
      diagnostics,
    };
  }

  if (!isFreshEnoughForCanonicalSafeFieldSelection(productReadModel.metadata.freshnessState)) {
    return {
      surface: input.surface,
      selectedSource: "compatibility",
      reason: "product_read_model_not_fresh",
      blockedMetrics,
      fallbackFields,
      diagnostics,
    };
  }

  if (!isScopeCompatibleForCanonicalSafeFieldSelection(productReadModel.metadata.scopeState)) {
    return {
      surface: input.surface,
      selectedSource: "compatibility",
      reason: "product_read_model_scope_mismatch",
      blockedMetrics,
      fallbackFields,
      diagnostics,
    };
  }

  return {
    surface: input.surface,
    selectedSource: "global_asset_product",
    reason: "product_read_model_ready",
    blockedMetrics,
    fallbackFields,
    diagnostics,
  };
}

export function selectGuardedProductSurfaceSource(
  input: SelectGuardedSourceInput,
): GuardedSourceSelection {
  return selectCanonicalSafeFieldProductSurfaceSource(input);
}

function mapPortfolioBreakdown(input: {
  row: ProductReadModelAssetRow;
  fallback?: AssetSummary;
}): PortfolioPosition[] {
  const fallbackByPortfolioId = new Map<string, PortfolioPosition>(
    (input.fallback?.portfolioBreakdown ?? []).map((entry) => [entry.portfolioId, entry]),
  );

  const projected = input.row.portfolioBreakdown.map((entry) => {
    const fallback = fallbackByPortfolioId.get(entry.portfolioId);
    const netShares = fallback?.netShares ?? 0;
    const remainingCostBasis = fallback?.remainingCostBasis ?? 0;
    const avgBuyPrice = fallback?.avgBuyPrice ?? null;
    const positionValue = fallback?.positionValue ?? null;
    const unrealizedPnL = fallback?.unrealizedPnL ?? null;

    return {
      portfolioId: entry.portfolioId,
      portfolioName: entry.portfolioName ?? fallback?.portfolioName ?? entry.portfolioId,
      netShares,
      remainingCostBasis,
      avgBuyPrice,
      latestTradePrice: fallback?.latestTradePrice ?? null,
      marketPrice: fallback?.marketPrice ?? null,
      positionValue,
      unrealizedPnL,
      totalDividendNet: fallback?.totalDividendNet ?? 0,
    };
  });

  const productPortfolioIds = new Set(input.row.portfolioBreakdown.map((entry) => entry.portfolioId));
  const missingCompatibilityEntries =
    input.fallback?.portfolioBreakdown.filter((entry) => !productPortfolioIds.has(entry.portfolioId)) ??
    [];

  return [...projected, ...missingCompatibilityEntries];
}

// Temporary compatibility boundary:
// Product read-model rows are still projected back into AssetSummary for legacy dashboard surfaces.
// This bridge is targeted for deletion after all consumers migrate to GlobalAssetViewModel outputs.
function buildAssetSummaryFromCanonicalSafeFieldRow(input: {
  row: ProductReadModelAssetRow;
  fallback?: AssetSummary;
}): AssetSummary {
  const { row, fallback } = input;
  const compatibilityIsin = row.identity.compatibilityIsin?.trim().toUpperCase() ?? null;
  const rowDisplayName = row.display.displayName.trim();
  const inferredMissingName =
    Boolean(compatibilityIsin) &&
    rowDisplayName.toUpperCase() === compatibilityIsin;
  const inferredStatus: AssetSummary["instrumentMetadataStatus"] = inferredMissingName
    ? "missing_name"
    : "ok";
  const inferredError = compatibilityIsin
    ? `Instrumentenname fehlt in market_instruments für ISIN ${compatibilityIsin}`
    : null;
  const authoritativeStatus = fallback?.instrumentMetadataStatus ?? inferredStatus;
  const authoritativeError =
    fallback?.instrumentMetadataError ??
    (authoritativeStatus === "ok" ? null : inferredError);
  const isin =
    row.identity.compatibilityIsin ??
    fallback?.isin ??
    row.identity.stableKey ??
    row.display.displayName;
  const authoritativeInstrument = fallback?.instrument ?? null;
  const isIsinAsset = Boolean(compatibilityIsin) && /^[A-Z0-9]{12}$/.test(compatibilityIsin ?? "");
  const hasDbInstrumentContext =
    Boolean(authoritativeInstrument) || typeof fallback?.instrumentMetadataStatus === "string";
  const dbDisplayName = authoritativeInstrument?.displayName ?? fallback?.instrumentDisplayName ?? null;
  const dbName = authoritativeInstrument?.name ?? fallback?.instrumentName ?? null;
  const productDisplayName =
    dbDisplayName ??
    dbName ??
    row.display.displayName?.trim() ??
    fallback?.displayName ??
    fallback?.name ??
    isin;
  const authoritativeDisplayName = authoritativeStatus === "ok"
    ? isIsinAsset
      ? hasDbInstrumentContext
        ? (dbDisplayName ?? dbName ?? "Stammdaten fehlen")
        : productDisplayName
      : productDisplayName
    : "Stammdaten fehlen";
  const authoritativeSymbol = isIsinAsset
    ? hasDbInstrumentContext
      ? (authoritativeInstrument?.primaryMapping?.symbol ?? null)
      : (authoritativeInstrument?.primaryMapping?.symbol ?? fallback?.symbol ?? null)
    : (authoritativeInstrument?.primaryMapping?.symbol ?? fallback?.symbol ?? null);
  const authoritativeWkn = fallback?.wkn ?? row.display.wkn ?? null;
  const netShares = fallback?.netShares ?? 0;
  const remainingCostBasis = fallback?.remainingCostBasis ?? 0;
  const avgBuyPrice = fallback?.avgBuyPrice ?? null;
  const positionValue = fallback?.positionValue ?? null;
  const unrealizedPnL = fallback?.unrealizedPnL ?? null;
  const portfolioBreakdown = mapPortfolioBreakdown({ row, fallback });

  return {
    isin,
    portfolioIds: portfolioBreakdown.map((entry) => entry.portfolioId),
    portfolioNames: portfolioBreakdown.map((entry) => entry.portfolioName),
    portfolioBreakdown,
    activityCount: fallback?.activityCount ?? 0,
    buyCount: fallback?.buyCount ?? 0,
    sellCount: fallback?.sellCount ?? 0,
    dividendCount: fallback?.dividendCount ?? 0,
    totalBoughtShares: fallback?.totalBoughtShares ?? 0,
    totalSoldShares: fallback?.totalSoldShares ?? 0,
    netShares,
    totalInvestedGross: fallback?.totalInvestedGross ?? 0,
    remainingCostBasis,
    avgBuyPrice,
    latestTradePrice: fallback?.latestTradePrice ?? null,
    marketPrice: fallback?.marketPrice ?? null,
    marketPriceAt: fallback?.marketPriceAt ?? null,
    marketPriceSource: fallback?.marketPriceSource ?? null,
    positionValue,
    unrealizedPnL,
    totalDividendNet: fallback?.totalDividendNet ?? 0,
    latestActivityAt: row.latestActivityAt ?? fallback?.latestActivityAt ?? null,
    name: authoritativeDisplayName,
    assetName: authoritativeDisplayName,
    displayName: authoritativeDisplayName,
    title: authoritativeDisplayName,
    instrumentDisplayName: authoritativeDisplayName,
    instrumentName: dbName ?? fallback?.name ?? productDisplayName,
    instrumentMetadataStatus: authoritativeStatus,
    instrumentMetadataError: authoritativeError,
    instrument: authoritativeInstrument,
    symbol: authoritativeSymbol,
    ticker: isIsinAsset
      ? hasDbInstrumentContext
        ? (authoritativeInstrument?.primaryMapping?.symbol ?? null)
        : (authoritativeInstrument?.primaryMapping?.symbol ?? fallback?.ticker ?? null)
      : (authoritativeInstrument?.primaryMapping?.symbol ?? fallback?.ticker ?? null),
    tickerSymbol: isIsinAsset
      ? hasDbInstrumentContext
        ? (authoritativeInstrument?.primaryMapping?.symbol ?? null)
        : (authoritativeInstrument?.primaryMapping?.symbol ?? fallback?.tickerSymbol ?? null)
      : (authoritativeInstrument?.primaryMapping?.symbol ?? fallback?.tickerSymbol ?? null),
    wkn: authoritativeWkn,
    metadata: {
      ...(fallback?.metadata ?? {}),
      curatedName: authoritativeDisplayName,
      displayName: authoritativeDisplayName,
      instrumentDisplayName: authoritativeDisplayName,
      instrumentMetadataStatus: authoritativeStatus,
      instrumentMetadataError: authoritativeError,
    },
    externalMetadata: {
      ...(fallback?.externalMetadata ?? {}),
      curatedName: authoritativeDisplayName,
      displayName: authoritativeDisplayName,
      instrumentDisplayName: authoritativeDisplayName,
      wkn: authoritativeWkn,
      instrumentMetadataStatus: authoritativeStatus,
      instrumentMetadataError: authoritativeError,
    },
    assetMeta: fallback?.assetMeta ?? null,
  };
}

export function buildAssetSummariesFromCanonicalSafeFields(input: {
  productReadModel: ProductReadModelAssets;
  compatibilityAssets: AssetSummary[];
}): AssetSummary[] {
  const productRowsByIsin = new Map<string, ProductReadModelAssetRow>();
  const productRowsWithoutCompatibilityIsin: ProductReadModelAssetRow[] = [];

  for (const row of input.productReadModel.assets) {
    const fallbackIsin = row.identity.compatibilityIsin?.toUpperCase() ?? null;

    if (fallbackIsin) {
      productRowsByIsin.set(fallbackIsin, row);
    } else {
      productRowsWithoutCompatibilityIsin.push(row);
    }
  }

  const compatibilityRows = input.compatibilityAssets.map((fallback) => {
    const row = productRowsByIsin.get(fallback.isin.toUpperCase());

    if (!row) {
      return fallback;
    }

    return buildAssetSummaryFromCanonicalSafeFieldRow({ row, fallback });
  });

  const productOnlyRows = productRowsWithoutCompatibilityIsin.map((row) =>
    buildAssetSummaryFromCanonicalSafeFieldRow({ row }),
  );

  return [...compatibilityRows, ...productOnlyRows];
}

export function buildCompatibilityAssetSummariesFromGuardedRows(input: {
  productReadModel: ProductReadModelAssets;
  compatibilityAssets: AssetSummary[];
}): AssetSummary[] {
  // Alias retained only to keep current call sites stable during phased AssetSummary removal.
  return buildAssetSummariesFromCanonicalSafeFields(input);
}
