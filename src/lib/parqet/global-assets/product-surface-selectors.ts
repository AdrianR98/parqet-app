import type { AssetSummary, PortfolioPosition } from "../../types";
import type {
  ProductReadModelAssetRow,
  ProductReadModelAssets,
  ProductReadModelFreshnessState,
  ProductReadModelScopeState,
} from "./product-read-model";
import type { BlockedMetric } from "./types";

export type GuardedSurfaceId = "dashboard" | "asset_table" | "reports";

export type GuardedProductSource = "compatibility" | "global_asset_product";

export type GuardedSourceSelectionReason =
  | "guard_not_enabled"
  | "product_read_model_missing"
  | "product_read_model_not_fresh"
  | "product_read_model_scope_mismatch"
  | "product_read_model_ready";

export type GuardedFallbackField =
  | "position_value"
  | "unrealized_pnl"
  | "remaining_cost_basis"
  | "avg_buy_price"
  | "net_shares"
  | "total_dividend_net";

export type GuardedSourceSelectionDiagnostics = {
  compatibilityAssetCount: number;
  productAssetCount: number;
  blockedMetricAssetCount: number;
  blockedMetricCount: number;
  freshnessState: ProductReadModelFreshnessState | "none";
  scopeState: ProductReadModelScopeState | "none";
  warningCount: number;
};

export type GuardedSourceSelection = {
  surface: GuardedSurfaceId;
  selectedSource: GuardedProductSource;
  reason: GuardedSourceSelectionReason;
  blockedMetrics: BlockedMetric[];
  fallbackFields: GuardedFallbackField[];
  diagnostics: GuardedSourceSelectionDiagnostics;
};

export type SelectGuardedSourceInput = {
  surface: GuardedSurfaceId;
  compatibilityAssets: AssetSummary[];
  productReadModel?: ProductReadModelAssets | null;
  guardEnabled: boolean;
};

function uniqueBlockedMetrics(rows: ProductReadModelAssetRow[]): BlockedMetric[] {
  return Array.from(new Set(rows.flatMap((row) => row.blockedMetrics)));
}

function blockedMetricsToFallbackFields(metrics: BlockedMetric[]): GuardedFallbackField[] {
  const fallbackFields = new Set<GuardedFallbackField>();

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

function isFreshEnoughForGuardedSelection(state: ProductReadModelFreshnessState): boolean {
  return state === "fresh";
}

function isScopeCompatibleForGuardedSelection(state: ProductReadModelScopeState): boolean {
  return state === "scope_match" || state === "scope_subset";
}

function buildDiagnostics(input: SelectGuardedSourceInput): GuardedSourceSelectionDiagnostics {
  const productAssets = input.productReadModel?.assets ?? [];
  const blockedMetrics = uniqueBlockedMetrics(productAssets);
  const warningCount = productAssets.reduce((count, row) => count + row.warnings.length, 0);

  return {
    compatibilityAssetCount: input.compatibilityAssets.length,
    productAssetCount: productAssets.length,
    blockedMetricAssetCount: productAssets.filter((row) => row.blockedMetrics.length > 0).length,
    blockedMetricCount: blockedMetrics.length,
    freshnessState: input.productReadModel?.metadata.freshnessState ?? "none",
    scopeState: input.productReadModel?.metadata.scopeState ?? "none",
    warningCount,
  };
}

export function selectGuardedProductSurfaceSource(
  input: SelectGuardedSourceInput,
): GuardedSourceSelection {
  const diagnostics = buildDiagnostics(input);
  const blockedMetrics = uniqueBlockedMetrics(input.productReadModel?.assets ?? []);
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

  if (!input.productReadModel) {
    return {
      surface: input.surface,
      selectedSource: "compatibility",
      reason: "product_read_model_missing",
      blockedMetrics,
      fallbackFields,
      diagnostics,
    };
  }

  if (!isFreshEnoughForGuardedSelection(input.productReadModel.metadata.freshnessState)) {
    return {
      surface: input.surface,
      selectedSource: "compatibility",
      reason: "product_read_model_not_fresh",
      blockedMetrics,
      fallbackFields,
      diagnostics,
    };
  }

  if (!isScopeCompatibleForGuardedSelection(input.productReadModel.metadata.scopeState)) {
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

function mapPortfolioBreakdown(input: {
  row: ProductReadModelAssetRow;
  fallback?: AssetSummary;
}): PortfolioPosition[] {
  const fallbackByPortfolioId = new Map<string, PortfolioPosition>(
    (input.fallback?.portfolioBreakdown ?? []).map((entry) => [entry.portfolioId, entry]),
  );

  return input.row.portfolioBreakdown.map((entry) => {
    const fallback = fallbackByPortfolioId.get(entry.portfolioId);
    const netShares = entry.quantity ?? fallback?.netShares ?? 0;
    const remainingCostBasis = entry.costBasis.amount ?? fallback?.remainingCostBasis ?? 0;
    const avgBuyPrice = netShares > 0 ? remainingCostBasis / netShares : fallback?.avgBuyPrice ?? null;
    const positionValue = entry.marketValue.amount ?? fallback?.positionValue ?? null;
    const unrealizedPnL = entry.unrealizedPnL.amount ?? fallback?.unrealizedPnL ?? null;

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
      totalDividendNet: entry.dividendsNet.amount ?? fallback?.totalDividendNet ?? 0,
    };
  });
}

export function buildCompatibilityAssetSummariesFromGuardedRows(input: {
  productReadModel: ProductReadModelAssets;
  compatibilityAssets: AssetSummary[];
}): AssetSummary[] {
  const fallbackByIsin = new Map<string, AssetSummary>(
    input.compatibilityAssets.map((asset) => [asset.isin.toUpperCase(), asset]),
  );

  return input.productReadModel.assets.map((row) => {
    const fallbackIsin = row.identity.compatibilityIsin?.toUpperCase() ?? null;
    const fallback = fallbackIsin ? fallbackByIsin.get(fallbackIsin) : undefined;
    const isin =
      row.identity.compatibilityIsin ??
      fallback?.isin ??
      row.identity.stableKey ??
      row.display.displayName;
    const netShares = row.quantity ?? fallback?.netShares ?? 0;
    const remainingCostBasis = row.costBasis.amount ?? fallback?.remainingCostBasis ?? 0;
    const avgBuyPrice = netShares > 0 ? remainingCostBasis / netShares : fallback?.avgBuyPrice ?? null;
    const positionValue = row.marketValue.amount ?? fallback?.positionValue ?? null;
    const unrealizedPnL = row.unrealizedPnL.amount ?? fallback?.unrealizedPnL ?? null;

    return {
      isin,
      portfolioIds: row.portfolioBreakdown.map((entry) => entry.portfolioId),
      portfolioNames: row.portfolioBreakdown.map(
        (entry) => entry.portfolioName ?? entry.portfolioId,
      ),
      portfolioBreakdown: mapPortfolioBreakdown({ row, fallback }),
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
      totalDividendNet: row.dividendsNet.amount ?? fallback?.totalDividendNet ?? 0,
      latestActivityAt: row.latestActivityAt ?? fallback?.latestActivityAt ?? null,
      name: row.display.displayName,
      assetName: fallback?.assetName ?? row.display.displayName,
      displayName: fallback?.displayName ?? row.display.displayName,
      title: fallback?.title ?? row.display.displayName,
      symbol: row.display.symbol ?? fallback?.symbol ?? null,
      ticker: fallback?.ticker ?? null,
      tickerSymbol: fallback?.tickerSymbol ?? null,
      wkn: row.display.wkn ?? fallback?.wkn ?? null,
      metadata: fallback?.metadata ?? null,
      externalMetadata: fallback?.externalMetadata ?? null,
      assetMeta: fallback?.assetMeta ?? null,
    };
  });
}
