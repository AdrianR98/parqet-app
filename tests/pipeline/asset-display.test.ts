import { describe, expect, it } from "vitest";

import { getAssetDisplayName } from "../../src/lib/asset-display";
import type { GlobalAssetViewModel } from "../../src/lib/types";

function createAsset(partial: Partial<GlobalAssetViewModel>): GlobalAssetViewModel {
  return {
    isin: "IE00B8GKDB10",
    portfolioIds: [],
    portfolioNames: [],
    portfolioBreakdown: [],
    activityCount: 0,
    buyCount: 0,
    sellCount: 0,
    dividendCount: 0,
    totalBoughtShares: 0,
    totalSoldShares: 0,
    netShares: 0,
    totalInvestedGross: 0,
    remainingCostBasis: 0,
    avgBuyPrice: null,
    latestTradePrice: null,
    marketPrice: null,
    marketPriceAt: null,
    marketPriceSource: null,
    positionValue: null,
    unrealizedPnL: null,
    totalDividendNet: 0,
    latestActivityAt: null,
    metadata: null,
    externalMetadata: null,
    assetMeta: null,
    ...partial,
  };
}

describe("asset display fallback", () => {
  it("prefers symbol before Stammdaten fehlen when metadata is missing", () => {
    const asset = createAsset({
      instrumentMetadataStatus: "missing_name",
      symbol: "VGWD.DE",
      name: undefined,
      wkn: undefined,
    });

    expect(getAssetDisplayName(asset)).toBe("VGWD.DE");
  });

  it("falls back to wkn and then isin before Stammdaten fehlen", () => {
    const withWkn = createAsset({
      instrumentMetadataStatus: "missing",
      symbol: undefined,
      wkn: "A1T8FV",
      name: undefined,
    });
    const withIsin = createAsset({
      instrumentMetadataStatus: "missing",
      symbol: undefined,
      wkn: undefined,
      name: undefined,
    });

    expect(getAssetDisplayName(withWkn)).toBe("A1T8FV");
    expect(getAssetDisplayName(withIsin)).toBe("IE00B8GKDB10");
  });
});

