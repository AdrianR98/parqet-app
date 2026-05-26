import type { GlobalAssetViewModel, PortfolioPosition } from "../../types";
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
  compatibilityAssets: GlobalAssetViewModel[];
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
  const fallbackFields = new Set<CanonicalSafeFieldFallbackField>(ALWAYS_COMPATIBILITY_FALLBACK_FIELDS);

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
  compatibilityAssets: GlobalAssetViewModel[];
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

function toPortfolioPosition(entry: ProductReadModelAssetRow["portfolioBreakdown"][number]): PortfolioPosition {
  return {
    portfolioId: entry.portfolioId,
    portfolioName: entry.portfolioName ?? entry.portfolioId,
    netShares: entry.quantity ?? 0,
    remainingCostBasis: entry.costBasis.amount ?? 0,
    avgBuyPrice:
      entry.quantity != null && entry.quantity > 0 && entry.costBasis.amount != null
        ? entry.costBasis.amount / entry.quantity
        : null,
    latestTradePrice: null,
    marketPrice: null,
    positionValue: entry.marketValue.amount,
    unrealizedPnL: entry.unrealizedPnL.amount,
    totalDividendNet: entry.dividendsNet.amount ?? 0,
  };
}

export function buildGlobalAssetViewModelsFromProductReadModel(
  productReadModel: ProductReadModelAssets,
): GlobalAssetViewModel[] {
  return productReadModel.assets.map((row) => {
    const isin = row.identity.compatibilityIsin ?? row.identity.stableKey ?? row.display.displayName;
    const instrumentMetadataStatus: GlobalAssetViewModel["instrumentMetadataStatus"] =
      row.identity.compatibilityIsin &&
      row.display.displayName.trim().toUpperCase() === row.identity.compatibilityIsin.trim().toUpperCase()
        ? "missing_name"
        : "ok";
    const portfolioBreakdown = row.portfolioBreakdown.map(toPortfolioPosition);
    const quantity = row.quantity ?? 0;
    const remainingCostBasis = row.costBasis.amount ?? 0;

    return {
      isin,
      portfolioIds: portfolioBreakdown.map((entry) => entry.portfolioId),
      portfolioNames: portfolioBreakdown.map((entry) => entry.portfolioName),
      portfolioBreakdown,
      activityCount: 0,
      buyCount: 0,
      sellCount: 0,
      dividendCount: 0,
      totalBoughtShares: 0,
      totalSoldShares: 0,
      netShares: quantity,
      totalInvestedGross: remainingCostBasis,
      remainingCostBasis,
      avgBuyPrice: quantity > 0 ? remainingCostBasis / quantity : null,
      latestTradePrice: null,
      marketPrice: row.marketValue.amount,
      marketPriceAt: null,
      marketPriceSource: null,
      positionValue: row.marketValue.amount,
      unrealizedPnL: row.unrealizedPnL.amount,
      totalDividendNet: row.dividendsNet.amount ?? 0,
      latestActivityAt: row.latestActivityAt,
      name: row.display.displayName,
      symbol: row.display.symbol,
      ticker: row.display.symbol,
      wkn: row.display.wkn,
      metadataSource: null,
      nameSource: null,
      displayNameSource: null,
      metadataUpdatedAt: null,
      instrumentMetadataStatus,
      instrumentMetadataError:
        instrumentMetadataStatus === "ok"
          ? null
          : `Instrumentenname fehlt in market_instruments für ISIN ${isin}`,
      instrument: (row as { instrument?: GlobalAssetViewModel["instrument"] }).instrument ?? null,
      metadata: null,
      externalMetadata: null,
      assetMeta: null,
    };
  });
}
