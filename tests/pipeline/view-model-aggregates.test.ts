import { describe, expect, it } from "vitest";

import { buildAllocationSegmentsFromAssets } from "../../src/lib/calculations/view-model-aggregates";
import type { GlobalAssetViewModel } from "../../src/lib/types";

function createAsset(partial: Partial<GlobalAssetViewModel>): GlobalAssetViewModel {
  return {
    isin: "US0000000001",
    portfolioIds: [],
    portfolioNames: [],
    portfolioBreakdown: [],
    activityCount: 0,
    buyCount: 0,
    sellCount: 0,
    dividendCount: 0,
    totalBoughtShares: 0,
    totalSoldShares: 0,
    netShares: 1,
    totalInvestedGross: 0,
    remainingCostBasis: 0,
    avgBuyPrice: null,
    latestTradePrice: null,
    marketPrice: null,
    marketPriceAt: null,
    marketPriceSource: null,
    positionValue: 100,
    unrealizedPnL: null,
    totalDividendNet: 0,
    latestActivityAt: null,
    metadata: null,
    externalMetadata: null,
    assetMeta: null,
    ...partial,
  };
}

describe("allocation segments", () => {
  it("builds unique keys even when labels are duplicated", () => {
    const segments = buildAllocationSegmentsFromAssets(
      [
        createAsset({
          isin: "US0000000001",
          name: "Stammdaten fehlen",
          positionValue: 100,
        }),
        createAsset({
          isin: "US0000000002",
          name: "Stammdaten fehlen",
          positionValue: 80,
        }),
      ],
      {
        maxIndividualSegments: 15,
        palette: ["#111111", "#222222"],
        otherColor: "#999999",
        getLabel: (asset) => asset.name ?? asset.isin,
      },
    );

    expect(segments).toHaveLength(2);
    expect(segments[0]?.label).toBe("Stammdaten fehlen");
    expect(segments[1]?.label).toBe("Stammdaten fehlen");
    expect(segments[0]?.key).toBe("US0000000001");
    expect(segments[1]?.key).toBe("US0000000002");
    expect(new Set(segments.map((segment) => segment.key)).size).toBe(2);
  });
});

