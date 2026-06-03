import { calculateAvgBuyPrice } from "../calculations/global-asset-metrics";
import type { GlobalAssetViewModel, PortfolioPosition } from "../types";
import type { ProductReadModelAssetRow, ProductReadModelAssets } from "../parqet/global-assets/product-read-model";

function toPortfolioPosition(
  entry: ProductReadModelAssetRow["portfolioBreakdown"][number],
): PortfolioPosition {
  const quantity = entry.quantity ?? 0;
  const remainingCostBasis = entry.costBasis.amount ?? 0;

  return {
    portfolioId: entry.portfolioId,
    portfolioName: entry.portfolioName ?? entry.portfolioId,
    netShares: quantity,
    remainingCostBasis,
    avgBuyPrice: calculateAvgBuyPrice(quantity, remainingCostBasis),
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
      avgBuyPrice: calculateAvgBuyPrice(quantity, remainingCostBasis),
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
          : `Asset-Stammdaten fehlen für ISIN ${isin}`,
      instrument: (row as { instrument?: GlobalAssetViewModel["instrument"] }).instrument ?? null,
      metadata: null,
      externalMetadata: null,
      assetMeta: null,
    };
  });
}
