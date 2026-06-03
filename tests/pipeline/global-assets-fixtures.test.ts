import { describe, expect, it } from "vitest";

import { buildGlobalAssetsFromNormalizationResult } from "../../src/lib/parqet/global-assets/aggregate";
import { normalizeActivities } from "../../src/lib/parqet/global-assets/normalize";
import type { ParqetActivityWithPortfolioContext } from "../../src/lib/parqet/global-assets/types";

function createSyntheticActivity(input: {
  activityId: string;
  type: string;
  datetime: string;
  isin?: string;
  shares?: number;
  currency?: string;
  price?: number;
  amount?: number;
  amountNet?: number;
}): ParqetActivityWithPortfolioContext {
  return {
    portfolioId: "portfolio_demo_1",
    portfolioName: "Portfolio Demo 1",
    portfolioCurrency: "EUR",
    raw: {
      id: input.activityId,
      type: input.type,
      datetime: input.datetime,
      isin: input.isin ?? "DEMO00000001",
      shares: input.shares,
      currency: input.currency ?? "EUR",
      price: input.price,
      amount: input.amount,
      amountNet: input.amountNet,
    },
  };
}

describe("global asset synthetic fixtures", () => {
  it("basic_buy_sell: closes a synthetic position", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_demo_1",
        type: "buy",
        datetime: "2025-01-01T10:00:00.000Z",
        shares: 10,
      }),
      createSyntheticActivity({
        activityId: "activity_demo_2",
        type: "sell",
        datetime: "2025-01-02T10:00:00.000Z",
        shares: 10,
      }),
    ]);

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization);

    expect(normalization.summary.normalizedCount).toBe(2);
    expect(aggregation.summary.assetCount).toBe(1);
    expect(aggregation.assets[0]?.totals.quantity).toBe(0);
    expect(aggregation.assets[0]?.status).toBe("closed");
    expect(aggregation.summary.negativeQuantityAssetCount).toBe(0);
  });

  it("buy_only_open_position: keeps position active", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_demo_3",
        type: "buy",
        datetime: "2025-02-01T10:00:00.000Z",
        shares: 5,
      }),
    ]);

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization);

    expect(normalization.summary.normalizedCount).toBe(1);
    expect(aggregation.summary.assetCount).toBe(1);
    expect(aggregation.assets[0]?.totals.quantity).toBe(5);
    expect(aggregation.assets[0]?.status).toBe("active");
  });

  it("unknown_activity_type: normalizes to unknown and does not change quantity", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_demo_4",
        type: "mystery_event",
        datetime: "2025-03-01T10:00:00.000Z",
        shares: 4,
      }),
    ]);

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization);

    expect(normalization.activities[0]?.activityType).toBe("unknown");
    expect(normalization.warnings.some((warning) => warning.code === "UNKNOWN_ACTIVITY_TYPE")).toBe(true);
    expect(aggregation.summary.assetCount).toBe(1);
    expect(aggregation.assets[0]?.totals.quantity).toBe(0);
    expect(aggregation.assets[0]?.timeline[0]?.displayType).toBe("unknown_event");
    expect(aggregation.assets[0]?.status).toBe("closed");
  });

  it("market_price_overlay: uses current market price instead of latest trade price", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_demo_5",
        type: "buy",
        datetime: "2025-04-01T10:00:00.000Z",
        shares: 2,
        currency: "EUR",
        price: 100,
        amount: 200,
        amountNet: 200,
      }),
    ]);

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization, {
      marketPriceOverlaysByIsin: {
        DEMO00000001: {
          priceAmount: 120,
          currency: "EUR",
          priceDate: "2025-04-03",
          priceTimestamp: "2025-04-03T17:00:00.000Z",
          priceSource: "yfinance",
        },
      },
    });

    expect(aggregation.assets[0]?.valuation?.sourceKind).toBe("market_data_db");
    expect(aggregation.assets[0]?.totals.marketValue?.amount).toBe(240);
    expect(aggregation.assets[0]?.totals.unrealizedPnL?.amount).toBe(40);
    expect(aggregation.assets[0]?.warnings.some((warning) => warning.code === "MARKET_PRICE_FALLBACK_USED")).toBe(false);
  });

  it("market_price_fallback: keeps latest trade price as explicit degraded fallback", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_demo_6",
        type: "buy",
        datetime: "2025-05-01T10:00:00.000Z",
        shares: 2,
        currency: "EUR",
        price: 100,
        amount: 200,
        amountNet: 200,
      }),
    ]);

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization);

    expect(aggregation.assets[0]?.valuation?.sourceKind).toBe("latest_trade_price_fallback");
    expect(aggregation.assets[0]?.totals.marketValue?.amount).toBe(200);
    expect(aggregation.assets[0]?.warnings.some((warning) => warning.code === "MARKET_PRICE_FALLBACK_USED")).toBe(true);
  });
});
