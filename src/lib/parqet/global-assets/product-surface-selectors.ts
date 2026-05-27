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

export type CanonicalSafeFieldProductSource =
  | "global_asset_product"
  | "runtime_assets_fallback";

export type CanonicalSafeFieldSelectionReason =
  | "guard_disabled"
  | "product_read_model_missing"
  | "product_read_model_invalid"
  | "product_read_model_empty"
  | "product_read_model_not_fresh"
  | "product_read_model_scope_mismatch"
  | "product_read_model_ready";

export type CanonicalSafeFieldAffectedField =
  | "position_value"
  | "unrealized_pnl"
  | "remaining_cost_basis"
  | "avg_buy_price"
  | "net_shares"
  | "total_dividend_net";

export type CanonicalSafeFieldSelectionDiagnostics = {
  readModelId: string | null;
  runtimeFallbackAssetCount: number;
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
  affectedFields: CanonicalSafeFieldAffectedField[];
  diagnostics: CanonicalSafeFieldSelectionDiagnostics;
};

export type SelectCanonicalSafeFieldSourceInput = {
  surface: CanonicalSafeFieldSurfaceId;
  /**
   * Already-loaded runtime assets used as compatibility fallback when the
   * Product Read Model is unavailable for canonical field selection.
   */
  runtimeFallbackAssets: GlobalAssetViewModel[];
  productReadModel?: unknown;
  guardEnabled: boolean;
};

export type GuardedSurfaceId = CanonicalSafeFieldSurfaceId;
export type GuardedProductSource = CanonicalSafeFieldProductSource;
export type GuardedSourceSelectionReason = CanonicalSafeFieldSelectionReason;
export type GuardedAffectedField = CanonicalSafeFieldAffectedField;
export type GuardedSourceSelectionDiagnostics = CanonicalSafeFieldSelectionDiagnostics;
export type GuardedSourceSelection = CanonicalSafeFieldSelection;
export type SelectGuardedSourceInput = SelectCanonicalSafeFieldSourceInput;

const DEFAULT_AFFECTED_FIELDS: CanonicalSafeFieldAffectedField[] = [
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

function blockedMetricsToAffectedFields(metrics: BlockedMetric[]): CanonicalSafeFieldAffectedField[] {
  const affectedFields = new Set<CanonicalSafeFieldAffectedField>(DEFAULT_AFFECTED_FIELDS);

  for (const metric of metrics) {
    if (metric === "market_value") {
      affectedFields.add("position_value");
    }

    if (metric === "unrealized_pnl" || metric === "realized_gains") {
      affectedFields.add("unrealized_pnl");
    }

    if (metric === "cost_basis") {
      affectedFields.add("remaining_cost_basis");
      affectedFields.add("avg_buy_price");
    }

    if (metric === "position" || metric === "portfolio_breakdown") {
      affectedFields.add("net_shares");
    }

    if (metric === "dividends") {
      affectedFields.add("total_dividend_net");
    }
  }

  return Array.from(affectedFields);
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
  runtimeFallbackAssets: GlobalAssetViewModel[];
  productReadModel: ProductReadModelAssets | null;
}): CanonicalSafeFieldSelectionDiagnostics {
  const productAssets = input.productReadModel?.assets ?? [];
  const blockedMetrics = uniqueBlockedMetrics(productAssets);
  const warningCount = productAssets.reduce((count, row) => count + row.warnings.length, 0);

  return {
    readModelId: input.productReadModel?.metadata.readModelId ?? null,
    runtimeFallbackAssetCount: input.runtimeFallbackAssets.length,
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

function buildUnavailableSelection(input: {
  surface: CanonicalSafeFieldSurfaceId;
  reason: Exclude<CanonicalSafeFieldSelectionReason, "product_read_model_ready">;
  blockedMetrics: BlockedMetric[];
  affectedFields: CanonicalSafeFieldAffectedField[];
  diagnostics: CanonicalSafeFieldSelectionDiagnostics;
}): CanonicalSafeFieldSelection {
  return {
    surface: input.surface,
    selectedSource: "runtime_assets_fallback",
    reason: input.reason,
    blockedMetrics: input.blockedMetrics,
    affectedFields: input.affectedFields,
    diagnostics: input.diagnostics,
  };
}

export function selectCanonicalSafeFieldProductSurfaceSource(
  input: SelectCanonicalSafeFieldSourceInput,
): CanonicalSafeFieldSelection {
  const productReadModel = readGlobalAssetProductReadModel(input.productReadModel);
  const diagnostics = buildDiagnostics({
    runtimeFallbackAssets: input.runtimeFallbackAssets,
    productReadModel,
  });
  const blockedMetrics = uniqueBlockedMetrics(productReadModel?.assets ?? []);
  const affectedFields = blockedMetricsToAffectedFields(blockedMetrics);

  if (!input.guardEnabled) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "guard_disabled",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  if (input.productReadModel == null) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "product_read_model_missing",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  if (!productReadModel) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "product_read_model_invalid",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  if (input.runtimeFallbackAssets.length > 0 && productReadModel.assets.length === 0) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "product_read_model_empty",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  if (!isFreshEnoughForCanonicalSafeFieldSelection(productReadModel.metadata.freshnessState)) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "product_read_model_not_fresh",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  if (!isScopeCompatibleForCanonicalSafeFieldSelection(productReadModel.metadata.scopeState)) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "product_read_model_scope_mismatch",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  return {
    surface: input.surface,
    selectedSource: "global_asset_product",
    reason: "product_read_model_ready",
    blockedMetrics,
    affectedFields,
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

    // Phase-3 transition: continuity counters stay shape-compatible but are
    // explicitly non-canonical placeholders for legacy runtime consumers.
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
