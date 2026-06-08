import { calculateAvgBuyPrice } from "../calculations/global-asset-metrics";
import type { GlobalAssetViewModel, PortfolioPosition } from "../types";
import type { ProductReadModelAssetRow, ProductReadModelAssets } from "../parqet/global-assets/product-read-model";
import {
  logDevDiagnostic,
  logValuationInvariant,
  summarizeDiagnostics,
} from "../debug/dev-diagnostics";

let lastMissingMetadataWarningKey: string | null = null;

function resolveLatestTradePrice(input: {
  rowValuation?: ProductReadModelAssetRow["valuation"] | null;
  breakdownValuation?: ProductReadModelAssetRow["portfolioBreakdown"][number]["valuation"] | null;
}): number | null {
  return (
    input.breakdownValuation?.latestTradePrice?.amount ??
    input.rowValuation?.latestTradePrice?.amount ??
    null
  );
}

function resolveMarketPrice(input: {
  rowValuation?: ProductReadModelAssetRow["valuation"] | null;
  breakdownValuation?: ProductReadModelAssetRow["portfolioBreakdown"][number]["valuation"] | null;
}): number | null {
  return (
    input.breakdownValuation?.marketPrice?.amount ??
    input.rowValuation?.marketPrice?.amount ??
    null
  );
}

function resolveMarketPriceAt(
  valuation?: ProductReadModelAssetRow["valuation"] | null,
): string | null {
  return valuation?.priceTimestamp ?? valuation?.priceDate ?? null;
}

function resolveMarketPriceSource(
  valuation?: ProductReadModelAssetRow["valuation"] | null,
): string | null {
  if (!valuation) {
    return null;
  }

  if (valuation.sourceKind === "market_data_db") {
    return valuation.priceSource ?? "market_data_db";
  }

  if (valuation.sourceKind === "latest_trade_price_fallback") {
    return "latest_trade_price_fallback";
  }

  return null;
}

function toPortfolioPosition(
  entry: ProductReadModelAssetRow["portfolioBreakdown"][number],
  rowValuation?: ProductReadModelAssetRow["valuation"] | null,
): PortfolioPosition {
  const quantity = entry.quantity ?? 0;
  const remainingCostBasis = entry.costBasis.amount ?? 0;

  return {
    portfolioId: entry.portfolioId,
    portfolioName: entry.portfolioName ?? entry.portfolioId,
    netShares: quantity,
    remainingCostBasis,
    avgBuyPrice: calculateAvgBuyPrice(quantity, remainingCostBasis),
    latestTradePrice: resolveLatestTradePrice({
      rowValuation,
      breakdownValuation: entry.valuation,
    }),
    marketPrice: resolveMarketPrice({
      rowValuation,
      breakdownValuation: entry.valuation,
    }),
    positionValue: entry.marketValue.amount,
    unrealizedPnL: entry.unrealizedPnL.amount,
    totalDividendNet: entry.dividendsNet.amount ?? 0,
  };
}

export function buildGlobalAssetViewModelsFromProductReadModel(
  productReadModel: ProductReadModelAssets,
): GlobalAssetViewModel[] {
  const viewModels = productReadModel.assets.map((row) => {
    const isin = row.identity.compatibilityIsin ?? row.identity.stableKey ?? row.display.displayName;
    const instrumentMetadataStatus: GlobalAssetViewModel["instrumentMetadataStatus"] =
      row.identity.compatibilityIsin &&
      row.display.displayName.trim().toUpperCase() === row.identity.compatibilityIsin.trim().toUpperCase()
        ? "missing_name"
        : "ok";
    const portfolioBreakdown = row.portfolioBreakdown.map((entry) =>
      toPortfolioPosition(entry, row.valuation),
    );
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
      avgBuyPrice: calculateAvgBuyPrice(quantity, remainingCostBasis),
      latestTradePrice: resolveLatestTradePrice({
        rowValuation: row.valuation,
      }),
      marketPrice: resolveMarketPrice({
        rowValuation: row.valuation,
      }),
      marketPriceAt: resolveMarketPriceAt(row.valuation),
      marketPriceSource: resolveMarketPriceSource(row.valuation),
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
          : `Asset-Stammdaten fehlen für ISIN ${isin}`,
      instrument: (row as { instrument?: GlobalAssetViewModel["instrument"] }).instrument ?? null,
      metadata: null,
      externalMetadata: null,
      assetMeta: null,
    };
  });

  let valuationAnomalies = 0;

  for (const row of viewModels) {
    const rowInvariant = logValuationInvariant("view_model:asset", {
      isin: row.isin,
      assetLabel: row.name ?? row.isin,
      quantity: row.netShares,
      marketPrice: row.marketPrice,
      marketValue: row.positionValue,
      remainingCostBasis: row.remainingCostBasis,
      unrealizedPnL: row.unrealizedPnL,
      valuationSourceKind: row.marketPriceSource,
      priceDate: row.marketPriceAt,
      priceSource: row.marketPriceSource,
    });

    if (rowInvariant.checked && !rowInvariant.isConsistent) {
      valuationAnomalies += 1;
    }
  }

  const missingDisplayNameCount = viewModels.filter((row) => {
    const displayName = row.name?.trim() ?? "";
    return displayName.length === 0 || displayName.toUpperCase() === row.isin.trim().toUpperCase();
  }).length;
  const fallbackIdentityCount = viewModels.filter((row) => {
    const displayName = row.name?.trim() ?? "";
    const normalizedDisplay = displayName.toUpperCase();
    const normalizedIsin = row.isin.trim().toUpperCase();
    const normalizedWkn = row.wkn?.trim().toUpperCase() ?? "";
    const normalizedSymbol = row.symbol?.trim().toUpperCase() ?? "";

    return normalizedDisplay === normalizedIsin ||
      (normalizedWkn.length > 0 && normalizedDisplay === normalizedWkn) ||
      (normalizedSymbol.length > 0 && normalizedDisplay === normalizedSymbol);
  }).length;

  summarizeDiagnostics("view_model_builder", {
    assetCount: viewModels.length,
    valuationAnomalies,
    withDisplayNameCount: viewModels.length - missingDisplayNameCount,
    fallbackIdentityCount,
    missingMetadataTitleCount: missingDisplayNameCount,
  }, "metadata");

  if (missingDisplayNameCount > 0) {
    const warningKey = `missing_metadata_titles_detected:${missingDisplayNameCount}`;
    if (lastMissingMetadataWarningKey !== warningKey) {
      lastMissingMetadataWarningKey = warningKey;
      logDevDiagnostic("metadata", "missing_metadata_titles_detected", {
        missingMetadataTitleCount: missingDisplayNameCount,
      }, "warn");
    }
  } else {
    lastMissingMetadataWarningKey = null;
  }

  return viewModels;
}
