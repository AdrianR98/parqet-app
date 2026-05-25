import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/market-data/db/repository", () => ({
    recordMarketDataRequest: vi.fn(),
}));

import { recordMarketDataRequest } from "../../src/lib/market-data/db/repository";
import { buildUnknownMarketDataRequestCandidates, recordUnknownMarketDataRequestsFromAssets } from "../../src/lib/market-data/runtime-requests";

describe("market-data runtime request discovery", () => {
    it("builds unique candidates only for unknown valid isins", () => {
        const rows = buildUnknownMarketDataRequestCandidates({
            assets: [
                { isin: "us0000000001", portfolioIds: [], portfolioNames: [], portfolioBreakdown: [], activityCount: 0, buyCount: 0, sellCount: 0, dividendCount: 0, totalBoughtShares: 0, totalSoldShares: 0, netShares: 0, totalInvestedGross: 0, remainingCostBasis: 0, avgBuyPrice: null, latestTradePrice: null, marketPrice: null, marketPriceAt: null, marketPriceSource: null, positionValue: null, unrealizedPnL: null, totalDividendNet: 0, latestActivityAt: null, name: "Acme" },
                { isin: "US0000000001", portfolioIds: [], portfolioNames: [], portfolioBreakdown: [], activityCount: 0, buyCount: 0, sellCount: 0, dividendCount: 0, totalBoughtShares: 0, totalSoldShares: 0, netShares: 0, totalInvestedGross: 0, remainingCostBasis: 0, avgBuyPrice: null, latestTradePrice: null, marketPrice: null, marketPriceAt: null, marketPriceSource: null, positionValue: null, unrealizedPnL: null, totalDividendNet: 0, latestActivityAt: null, name: "Acme 2" },
                { isin: "bad", portfolioIds: [], portfolioNames: [], portfolioBreakdown: [], activityCount: 0, buyCount: 0, sellCount: 0, dividendCount: 0, totalBoughtShares: 0, totalSoldShares: 0, netShares: 0, totalInvestedGross: 0, remainingCostBasis: 0, avgBuyPrice: null, latestTradePrice: null, marketPrice: null, marketPriceAt: null, marketPriceSource: null, positionValue: null, unrealizedPnL: null, totalDividendNet: 0, latestActivityAt: null },
            ],
            knownIsins: new Set(["IE00B8GKDB10"]),
        });

        expect(rows).toHaveLength(1);
        expect(rows[0]?.isin).toBe("US0000000001");
    });

    it("records discovered candidates", async () => {
        vi.mocked(recordMarketDataRequest).mockResolvedValue(null);
        vi.mocked(recordMarketDataRequest)
            .mockResolvedValueOnce({} as never)
            .mockResolvedValueOnce({} as never);

        const result = await recordUnknownMarketDataRequestsFromAssets({
            assets: [
                { isin: "US0000000001", portfolioIds: [], portfolioNames: [], portfolioBreakdown: [], activityCount: 0, buyCount: 0, sellCount: 0, dividendCount: 0, totalBoughtShares: 0, totalSoldShares: 0, netShares: 0, totalInvestedGross: 0, remainingCostBasis: 0, avgBuyPrice: null, latestTradePrice: null, marketPrice: null, marketPriceAt: null, marketPriceSource: null, positionValue: null, unrealizedPnL: null, totalDividendNet: 0, latestActivityAt: null },
                { isin: "US0000000002", portfolioIds: [], portfolioNames: [], portfolioBreakdown: [], activityCount: 0, buyCount: 0, sellCount: 0, dividendCount: 0, totalBoughtShares: 0, totalSoldShares: 0, netShares: 0, totalInvestedGross: 0, remainingCostBasis: 0, avgBuyPrice: null, latestTradePrice: null, marketPrice: null, marketPriceAt: null, marketPriceSource: null, positionValue: null, unrealizedPnL: null, totalDividendNet: 0, latestActivityAt: null },
            ],
            knownIsins: new Set(),
        });

        expect(result).toEqual({ attempted: 2, recorded: 2 });
        expect(recordMarketDataRequest).toHaveBeenCalledTimes(2);
    });
});
