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

  it("market_price_overlay_eur_reporting: leaves native EUR prices unconverted", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_eur_native_1",
        type: "buy",
        datetime: "2026-06-01T10:00:00.000Z",
        isin: "DE000EUR0001",
        shares: 2,
        currency: "EUR",
        price: 100,
        amount: 200,
        amountNet: 200,
      }),
    ]);

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization, {
      reportingCurrency: "EUR",
      marketPriceOverlaysByIsin: {
        DE000EUR0001: {
          priceAmount: 120,
          currency: "EUR",
          reportingCurrency: "EUR",
          priceDate: "2026-06-03",
          priceTimestamp: "2026-06-03T17:00:00.000Z",
          priceSource: "market_data_db",
        },
      },
    });

    const valuation = aggregation.assets[0]?.valuation;

    expect(valuation?.nativeMarketPrice).toEqual({ amount: 120, currency: "EUR" });
    expect(valuation?.reportingMarketPrice).toEqual({ amount: 120, currency: "EUR" });
    expect(valuation?.fxStatus).toBe("not_required");
    expect(aggregation.assets[0]?.totals.marketValue?.amount).toBe(240);
    expect(aggregation.assets[0]?.warnings.some((warning) => warning.code === "FX_RATE_MISSING")).toBe(false);
  });

  it("market_price_overlay_usd_reporting: converts SPCX USD market price to EUR reporting value", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_spcx_usd_1",
        type: "buy",
        datetime: "2026-06-01T10:00:00.000Z",
        isin: "US84615Q1031",
        shares: 10,
        currency: "EUR",
        price: 100,
        amount: 1000,
        amountNet: 1000,
      }),
    ]);

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization, {
      reportingCurrency: "EUR",
      marketPriceOverlaysByIsin: {
        US84615Q1031: {
          priceAmount: 100,
          currency: "USD",
          reportingCurrency: "EUR",
          fxRate: {
            fromCurrency: "USD",
            toCurrency: "EUR",
            rate: 0.92,
            rateDate: "2026-06-03",
            provider: "ecb",
            source: "manual_fixture",
          },
          priceDate: "2026-06-03",
          priceTimestamp: "2026-06-03T17:00:00.000Z",
          priceSource: "market_data_db",
        },
      },
    });

    const asset = aggregation.assets[0];

    expect(asset?.valuation?.nativeMarketPrice).toEqual({ amount: 100, currency: "USD" });
    expect(asset?.valuation?.marketPrice).toEqual({ amount: 92, currency: "EUR" });
    expect(asset?.valuation?.fxStatus).toBe("converted");
    expect(asset?.totals.marketValue?.amount).toBe(920);
    expect(asset?.totals.marketValue?.currency).toBe("EUR");
    expect(asset?.totals.unrealizedPnL?.amount).toBe(-80);
  });

  it("market_price_overlay_usd_reporting: blocks EUR valuation when the USD/EUR FX rate is missing", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_spcx_missing_fx_1",
        type: "buy",
        datetime: "2026-06-01T10:00:00.000Z",
        isin: "US84615Q1031",
        shares: 10,
        currency: "EUR",
        price: 100,
        amount: 1000,
        amountNet: 1000,
      }),
    ]);

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization, {
      reportingCurrency: "EUR",
      marketPriceOverlaysByIsin: {
        US84615Q1031: {
          priceAmount: 100,
          currency: "USD",
          reportingCurrency: "EUR",
          priceDate: "2026-06-03",
          priceTimestamp: "2026-06-03T17:00:00.000Z",
          priceSource: "market_data_db",
        },
      },
    });

    const asset = aggregation.assets[0];
    const fxWarning = asset?.warnings.find((warning) => warning.code === "FX_RATE_MISSING");

    expect(asset?.valuation?.nativeMarketPrice).toEqual({ amount: 100, currency: "USD" });
    expect(asset?.valuation?.marketPrice).toBeNull();
    expect(asset?.valuation?.fxStatus).toBe("missing_rate");
    expect(asset?.totals.marketValue).toBeNull();
    expect(asset?.totals.unrealizedPnL).toBeNull();
    expect(fxWarning?.blockedMetrics).toEqual(expect.arrayContaining(["market_value", "unrealized_pnl"]));
  });

  it("market_price_overlay_usd_reporting: does not mutate native USD price rows during conversion", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_spcx_no_mutation_1",
        type: "buy",
        datetime: "2026-06-01T10:00:00.000Z",
        isin: "US84615Q1031",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
    ]);
    const overlay = {
      priceAmount: 100,
      currency: "USD",
      reportingCurrency: "EUR",
      fxRate: {
        fromCurrency: "USD",
        toCurrency: "EUR",
        rate: 0.92,
        rateDate: "2026-06-03",
        provider: "ecb",
        source: "manual_fixture",
      },
      priceDate: "2026-06-03",
      priceTimestamp: "2026-06-03T17:00:00.000Z",
      priceSource: "market_data_db",
    } as const;

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization, {
      reportingCurrency: "EUR",
      marketPriceOverlaysByIsin: {
        US84615Q1031: overlay,
      },
    });

    expect(overlay.priceAmount).toBe(100);
    expect(overlay.currency).toBe("USD");
    expect(aggregation.assets[0]?.valuation?.nativeMarketPrice).toEqual({ amount: 100, currency: "USD" });
    expect(aggregation.assets[0]?.valuation?.reportingMarketPrice).toEqual({ amount: 92, currency: "EUR" });
  });

  it("market_price_overlay_vanguard_regression: derives market value and unrealized pnl from current market price", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_vanguard_1",
        type: "buy",
        datetime: "2025-04-01T10:00:00.000Z",
        isin: "IE00B8GKDB10",
        shares: 33.142924,
        currency: "EUR",
        price: 69.83,
        amount: 2314.42,
        amountNet: 2314.42,
      }),
    ]);

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization, {
      marketPriceOverlaysByIsin: {
        IE00B8GKDB10: {
          priceAmount: 77.95,
          currency: "EUR",
          priceDate: "2025-04-03",
          priceTimestamp: "2025-04-03T17:00:00.000Z",
          priceSource: "market_data_db",
        },
      },
    });

    expect(aggregation.assets[0]?.valuation?.sourceKind).toBe("market_data_db");
    expect(aggregation.assets[0]?.totals.quantity).toBe(33.142924);
    expect(aggregation.assets[0]?.totals.costBasis?.amount).toBe(2314.42);
    expect(aggregation.assets[0]?.totals.marketValue?.amount).toBeCloseTo(2583.49, 2);
    expect(aggregation.assets[0]?.totals.unrealizedPnL?.amount).toBeCloseTo(269.07, 2);
    expect(aggregation.assets[0]?.portfolioBreakdowns[0]?.marketValue?.amount).toBeCloseTo(2583.49, 2);
    expect(aggregation.assets[0]?.portfolioBreakdowns[0]?.pnl?.amount).toBeCloseTo(269.07, 2);
  });

  it("market_price_overlay_vanguard_large_position: applies market overlay for prm valuation path", () => {
    const normalization = normalizeActivities([
      createSyntheticActivity({
        activityId: "activity_vanguard_large_1",
        type: "buy",
        datetime: "2026-06-01T10:00:00.000Z",
        isin: "IE00B8GKDB10",
        shares: 86.6166,
        currency: "EUR",
        price: 72.90033718118316,
        amount: 6314.42,
        amountNet: 6314.42,
      }),
    ]);

    const aggregation = buildGlobalAssetsFromNormalizationResult(normalization, {
      marketPriceOverlaysByIsin: {
        IE00B8GKDB10: {
          priceAmount: 77.949997,
          currency: "EUR",
          priceDate: "2026-06-03",
          priceTimestamp: "2026-06-03T17:00:00.000Z",
          priceSource: "market_data_db",
        },
      },
    });

    expect(aggregation.assets[0]?.valuation?.sourceKind).toBe("market_data_db");
    expect(aggregation.assets[0]?.totals.marketValue?.amount).toBeCloseTo(6751.76, 2);
    expect(aggregation.assets[0]?.totals.unrealizedPnL?.amount).toBeCloseTo(437.34, 2);
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
