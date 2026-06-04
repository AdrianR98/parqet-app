import { describe, expect, it } from "vitest";

import { selectPrmDisplayNameForMetadataOverlay } from "../../src/lib/parqet/global-assets/display-fallback";
import {
  enrichGlobalAssetsProductReadModelMetrics,
  projectGlobalAssetsProductReadModel,
  type ProductReadModelAssets,
} from "../../src/lib/parqet/global-assets/product-read-model";
import { createSyntheticActivity, runGlobalAssetPipeline } from "./global-assets-test-helpers";

function withClassification(
  model: ProductReadModelAssets,
  classifications: Record<string, { displayName?: string; assetType?: string | null; wkn?: string | null; symbol?: string | null; primarySymbol?: string | null; currency?: string | null }>,
): ProductReadModelAssets {
  return enrichGlobalAssetsProductReadModelMetrics({
    ...model,
    assets: model.assets.map((asset) => {
      const isin = asset.identity.compatibilityIsin ?? "";
      const patch = classifications[isin] ?? {};

      return {
        ...asset,
        display: {
          ...asset.display,
          displayName: patch.displayName ?? asset.display.displayName,
        },
        classification: {
          ...(asset.classification ?? {}),
          assetType: patch.assetType ?? asset.classification?.assetType ?? null,
          wkn: patch.wkn ?? asset.classification?.wkn ?? asset.display.wkn ?? null,
          symbol: patch.symbol ?? asset.classification?.symbol ?? asset.display.symbol ?? null,
          primarySymbol: patch.primarySymbol ?? asset.classification?.primarySymbol ?? null,
          currency: patch.currency ?? asset.classification?.currency ?? asset.marketValue.currency ?? null,
        },
      };
    }),
  });
}

describe("global asset extended KPI metrics", () => {
  it("computes activity, dividend, freshness and quality metrics on PRM asset rows", () => {
    const { aggregation } = runGlobalAssetPipeline(
      [
        createSyntheticActivity({
          activityId: "ext_kpi_a1",
          type: "buy",
          datetime: "2026-05-01T10:00:00.000Z",
          isin: "DE000EXT0001",
          shares: 2,
          currency: "EUR",
          price: 50,
          amount: 100,
          amountNet: 100,
        }),
        createSyntheticActivity({
          activityId: "ext_kpi_a2",
          type: "buy",
          datetime: "2026-05-10T10:00:00.000Z",
          isin: "DE000EXT0001",
          shares: 1,
          currency: "EUR",
          price: 50,
          amount: 50,
          amountNet: 50,
        }),
        createSyntheticActivity({
          activityId: "ext_kpi_a3",
          type: "sell",
          datetime: "2026-05-15T10:00:00.000Z",
          isin: "DE000EXT0001",
          shares: 1,
          currency: "EUR",
          price: 55,
          amount: 55,
          amountNet: 55,
        }),
        createSyntheticActivity({
          activityId: "ext_kpi_a4",
          type: "dividend",
          datetime: "2026-05-20T10:00:00.000Z",
          isin: "DE000EXT0001",
          currency: "EUR",
          amount: 5,
          amountNet: 4,
        }),
      ],
      {
        marketPriceOverlaysByIsin: {
          DE000EXT0001: {
            priceAmount: 60,
            currency: "EUR",
            priceDate: "2026-06-03",
            priceTimestamp: "2026-06-03T17:00:00.000Z",
            priceSource: "market_data_db",
          },
        },
      },
    );

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const enriched = withClassification(projected, {
      DE000EXT0001: {
        displayName: "Demo ETF",
        assetType: "ETF",
        wkn: "A0TEST",
        symbol: "DEMO",
        primarySymbol: "DEMO.DE",
        currency: "EUR",
      },
    });
    const asset = enriched.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0001");

    expect(asset?.metrics?.activity?.grossBuyVolume?.amount).toBe(150);
    expect(asset?.metrics?.activity?.grossSellVolume?.amount).toBe(55);
    expect(asset?.metrics?.activity?.buyCount).toBe(2);
    expect(asset?.metrics?.activity?.sellCount).toBe(1);
    expect(asset?.metrics?.income?.dividendCount).toBe(1);
    expect(asset?.metrics?.income?.lastDividendDate).toBe("2026-05-20T10:00:00.000Z");
    expect(asset?.metrics?.structure?.portfolioWeight?.value).toBe(1);
    expect(asset?.metrics?.quality?.marketPriceFreshness?.state).toBe("fresh");
    expect(asset?.metrics?.quality?.warningCount).toBe(0);
    expect(asset?.metrics?.quality?.metadataCompletenessScore).toBe(100);
    expect(asset?.metrics?.quality?.dataConfidenceScore).toBeGreaterThanOrEqual(90);
    expect(asset?.marketValue.amount).toBe(120);
  });

  it("annualizes quarterly-like dividend history and derives dividend yield and return decomposition", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "ext_kpi_income_1",
        type: "buy",
        datetime: "2025-01-01T10:00:00.000Z",
        isin: "DE000EXT0501",
        shares: 10,
        currency: "EUR",
        price: 10,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_income_2",
        type: "dividend",
        datetime: "2025-01-15T10:00:00.000Z",
        isin: "DE000EXT0501",
        currency: "EUR",
        amount: 5,
        amountNet: 5,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_income_3",
        type: "dividend",
        datetime: "2025-04-15T10:00:00.000Z",
        isin: "DE000EXT0501",
        currency: "EUR",
        amount: 5,
        amountNet: 5,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_income_4",
        type: "dividend",
        datetime: "2025-07-15T10:00:00.000Z",
        isin: "DE000EXT0501",
        currency: "EUR",
        amount: 5,
        amountNet: 5,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_income_5",
        type: "dividend",
        datetime: "2025-10-15T10:00:00.000Z",
        isin: "DE000EXT0501",
        currency: "EUR",
        amount: 5,
        amountNet: 5,
      }),
    ], {
      marketPriceOverlaysByIsin: {
        DE000EXT0501: {
          priceAmount: 12,
          currency: "EUR",
          priceDate: "2026-06-03",
          priceTimestamp: "2026-06-03T17:00:00.000Z",
          priceSource: "market_data_db",
        },
      },
    });

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const enriched = withClassification(projected, {
      DE000EXT0501: {
        displayName: "Income Demo",
        assetType: "ETF",
        currency: "EUR",
      },
    });
    const asset = enriched.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0501");

    expect(asset?.metrics?.income?.annualizedDividendIncome?.amount).toBe(20);
    expect(asset?.metrics?.income?.annualizedDividendIncome?.status).toBe("ready");
    expect(asset?.metrics?.income?.payoutFrequency?.value).toBe("quarterly");
    expect(asset?.metrics?.income?.dividendYieldOnCost?.value).toBeCloseTo(0.2, 8);
    expect(asset?.metrics?.income?.currentDividendYield?.value).toBeCloseTo(20 / 120, 8);
    expect(asset?.metrics?.returns?.incomeReturn?.value).toBeCloseTo(20 / 100, 8);
    expect(asset?.metrics?.returns?.incomeReturn?.status).toBe("partial");
    expect(asset?.metrics?.returns?.priceReturnExcludingDividends?.value).toBeCloseTo(20 / 100, 8);
    expect(asset?.metrics?.returns?.totalReturnIncludingDividends?.value).toBeCloseTo(40 / 100, 8);
  });

  it("computes ready 1Y dividend growth from comparable trailing periods", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "ext_kpi_growth1y_buy",
        type: "buy",
        datetime: "2023-01-01T10:00:00.000Z",
        isin: "DE000EXT0801",
        shares: 10,
        currency: "EUR",
        price: 10,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_growth1y_seed",
        type: "dividend",
        datetime: "2023-10-15T10:00:00.000Z",
        isin: "DE000EXT0801",
        currency: "EUR",
        amount: 1,
        amountNet: 1,
      }),
      ...[
        ["2024-01-15T10:00:00.000Z", 2],
        ["2024-04-15T10:00:00.000Z", 2],
        ["2024-07-15T10:00:00.000Z", 2],
        ["2024-10-15T10:00:00.000Z", 2],
        ["2025-01-15T10:00:00.000Z", 3],
        ["2025-04-15T10:00:00.000Z", 3],
        ["2025-07-15T10:00:00.000Z", 3],
        ["2025-10-15T10:00:00.000Z", 3],
      ].map(([datetime, amount], index) =>
        createSyntheticActivity({
          activityId: `ext_kpi_growth1y_${index}`,
          type: "dividend",
          datetime,
          isin: "DE000EXT0801",
          currency: "EUR",
          amount,
          amountNet: amount,
        }),
      ),
    ]);

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const asset = projected.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0801");

    expect(asset?.metrics?.income?.dividendGrowth1y?.status).toBe("ready");
    expect(asset?.metrics?.income?.dividendGrowth1y?.value).toBeCloseTo(0.5, 8);
    expect(projected.summary.metrics?.income?.dividendGrowth1y?.status).toBe("ready");
    expect(projected.summary.metrics?.income?.dividendGrowth1y?.value).toBeCloseTo(0.5, 8);
  });

  it("marks dividend growth partial or missing when comparable history is insufficient", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "ext_kpi_growth_missing_buy",
        type: "buy",
        datetime: "2025-01-01T10:00:00.000Z",
        isin: "DE000EXT0802",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_growth_missing_div_1",
        type: "dividend",
        datetime: "2025-01-15T10:00:00.000Z",
        isin: "DE000EXT0802",
        currency: "EUR",
        amount: 5,
        amountNet: 5,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_growth_missing_div_2",
        type: "dividend",
        datetime: "2025-04-15T10:00:00.000Z",
        isin: "DE000EXT0802",
        currency: "EUR",
        amount: 5,
        amountNet: 5,
      }),
    ]);

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const asset = projected.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0802");

    expect(asset?.metrics?.income?.dividendGrowth1y?.status).toBe("partial");
    expect(asset?.metrics?.income?.dividendGrowth1y?.note).toBe(
      "dividend_growth_1y_insufficient_comparable_history",
    );
    expect(asset?.metrics?.income?.dividendGrowth3y?.status).toBe("partial");
  });

  it("marks dividend growth partial when the baseline period is zero and the current period is positive", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "ext_kpi_growth_zero_buy",
        type: "buy",
        datetime: "2023-01-01T10:00:00.000Z",
        isin: "DE000EXT0803",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_growth_zero_seed",
        type: "dividend",
        datetime: "2023-04-15T10:00:00.000Z",
        isin: "DE000EXT0803",
        currency: "EUR",
        amount: 0,
        amountNet: 0,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_growth_zero_baseline",
        type: "dividend",
        datetime: "2024-04-15T10:00:00.000Z",
        isin: "DE000EXT0803",
        currency: "EUR",
        amount: 0,
        amountNet: 0,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_growth_zero_current",
        type: "dividend",
        datetime: "2025-04-15T10:00:00.000Z",
        isin: "DE000EXT0803",
        currency: "EUR",
        amount: 6,
        amountNet: 6,
      }),
    ]);

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const asset = projected.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0803");

    expect(asset?.metrics?.income?.dividendGrowth1y?.status).toBe("partial");
    expect(asset?.metrics?.income?.dividendGrowth1y?.note).toBe(
      "dividend_growth_1y_baseline_zero_current_positive",
    );
  });

  it("marks dividend growth partial for mixed-currency dividend history", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "ext_kpi_growth_mix_buy",
        type: "buy",
        datetime: "2023-01-01T10:00:00.000Z",
        isin: "DE000EXT0804",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_growth_mix_seed",
        type: "dividend",
        datetime: "2023-04-15T10:00:00.000Z",
        isin: "DE000EXT0804",
        currency: "EUR",
        amount: 1,
        amountNet: 1,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_growth_mix_base",
        type: "dividend",
        datetime: "2024-04-15T10:00:00.000Z",
        isin: "DE000EXT0804",
        currency: "EUR",
        amount: 2,
        amountNet: 2,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_growth_mix_current",
        type: "dividend",
        datetime: "2025-04-15T10:00:00.000Z",
        isin: "DE000EXT0804",
        currency: "USD",
        amount: 3,
        amountNet: 3,
      }),
    ]);

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const asset = projected.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0804");

    expect(asset?.metrics?.income?.dividendGrowth1y?.status).toBe("partial");
    expect(asset?.metrics?.income?.dividendGrowth1y?.note).toBe(
      "dividend_growth_1y_unconverted_mixed_currencies",
    );
  });

  it("computes conservative 3Y dividend growth from comparable trailing periods", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "ext_kpi_growth3y_buy",
        type: "buy",
        datetime: "2019-01-01T10:00:00.000Z",
        isin: "DE000EXT0805",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_growth3y_seed",
        type: "dividend",
        datetime: "2019-06-15T10:00:00.000Z",
        isin: "DE000EXT0805",
        currency: "EUR",
        amount: 1,
        amountNet: 1,
      }),
      ...[
        ["2020-06-15T10:00:00.000Z", 5],
        ["2021-06-15T10:00:00.000Z", 5],
        ["2022-06-15T10:00:00.000Z", 5],
        ["2023-06-15T10:00:00.000Z", 10],
        ["2024-06-15T10:00:00.000Z", 10],
        ["2025-06-15T10:00:00.000Z", 10],
      ].map(([datetime, amount], index) =>
        createSyntheticActivity({
          activityId: `ext_kpi_growth3y_${index}`,
          type: "dividend",
          datetime,
          isin: "DE000EXT0805",
          currency: "EUR",
          amount,
          amountNet: amount,
        }),
      ),
    ]);

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const asset = projected.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0805");

    expect(asset?.metrics?.income?.dividendGrowth3y?.status).toBe("ready");
    expect(asset?.metrics?.income?.dividendGrowth3y?.value).toBeCloseTo(1, 8);
  });

  it("counts undated dividends but keeps last dividend date based on dated events only", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "ext_kpi_div_1",
        type: "buy",
        datetime: "2026-05-01T10:00:00.000Z",
        isin: "DE000EXT0301",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_div_2",
        type: "dividend",
        datetime: "2026-05-10T10:00:00.000Z",
        isin: "DE000EXT0301",
        currency: "EUR",
        amount: 5,
        amountNet: 4,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_div_3",
        type: "dividend",
        isin: "DE000EXT0301",
        currency: "EUR",
        amount: 6,
        amountNet: 5,
      }),
    ]);

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const asset = projected.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0301");

    expect(asset?.metrics?.income?.dividendCount).toBe(2);
    expect(asset?.metrics?.income?.lastDividendDate).toBe("2026-05-10T10:00:00.000Z");
  });

  it("computes concentration metrics and asset-type allocation with unknown bucket", () => {
    const positions = [
      { isin: "DE000EXT0101", shares: 1, price: 10, marketPrice: 50, assetType: "ETF" },
      { isin: "DE000EXT0102", shares: 1, price: 10, marketPrice: 40, assetType: "ETF" },
      { isin: "DE000EXT0103", shares: 1, price: 10, marketPrice: 30, assetType: "Stock" },
      { isin: "DE000EXT0104", shares: 1, price: 10, marketPrice: 20, assetType: "Stock" },
      { isin: "DE000EXT0105", shares: 1, price: 10, marketPrice: 10, assetType: null },
      { isin: "DE000EXT0106", shares: 1, price: 10, marketPrice: 5, assetType: "Bond" },
    ] as const;

    const { aggregation } = runGlobalAssetPipeline(
      positions.map((position, index) =>
        createSyntheticActivity({
          activityId: `ext_kpi_b${index}`,
          type: "buy",
          datetime: `2026-05-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
          isin: position.isin,
          shares: position.shares,
          currency: "EUR",
          price: position.price,
          amount: position.price,
          amountNet: position.price,
        }),
      ),
      {
        marketPriceOverlaysByIsin: Object.fromEntries(
          positions.map((position, index) => [
            position.isin,
            {
              priceAmount: position.marketPrice,
              currency: "EUR",
              priceDate: `2026-05-${String(index + 1).padStart(2, "0")}`,
              priceTimestamp: `2026-05-${String(index + 1).padStart(2, "0")}T17:00:00.000Z`,
              priceSource: "market_data_db",
            },
          ]),
        ),
      },
    );

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const enriched = withClassification(
      projected,
      Object.fromEntries(
        positions.map((position) => [
          position.isin,
          {
            displayName: position.isin,
            assetType: position.assetType,
            currency: "EUR",
          },
        ]),
      ),
    );

    const largestAsset = enriched.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0101");
    expect(largestAsset?.metrics?.structure?.portfolioWeight?.value).toBeCloseTo(50 / 155, 8);
    expect(enriched.summary.metrics?.structure?.top5Concentration?.value).toBeCloseTo(150 / 155, 8);
    expect(enriched.summary.metrics?.structure?.top10Concentration?.value).toBe(1);
    expect(enriched.summary.metrics?.structure?.herfindahlIndex?.value).toBeCloseTo(
      [50, 40, 30, 20, 10, 5]
        .map((value) => value / 155)
        .reduce((sum, weight) => sum + weight * weight, 0),
      8,
    );

    const allocationBuckets = enriched.summary.metrics?.structure?.allocationByAssetType?.buckets ?? [];
    expect(allocationBuckets.find((bucket) => bucket.label === "ETF")?.positionValue.amount).toBe(90);
    expect(allocationBuckets.find((bucket) => bucket.label === "Stock")?.positionValue.amount).toBe(50);
    expect(allocationBuckets.find((bucket) => bucket.label === "Bond")?.positionValue.amount).toBe(5);
    expect(allocationBuckets.find((bucket) => bucket.label === "Unbekannt")?.positionValue.amount).toBe(10);
  });

  it("marks mixed-currency structure metrics partial and preserves backward-compatible PRM fields", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "ext_kpi_c1",
        type: "buy",
        datetime: "2026-05-01T10:00:00.000Z",
        isin: "DE000EXT0201",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_c2",
        type: "buy",
        datetime: "2026-05-02T10:00:00.000Z",
        isin: "DE000EXT0202",
        shares: 1,
        currency: "USD",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
    ]);

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const enriched = withClassification(projected, {
      DE000EXT0201: { displayName: "Euro Asset", assetType: "ETF", currency: "EUR" },
      DE000EXT0202: { displayName: "Dollar Asset", assetType: "Stock", currency: "USD" },
    });

    const eurAsset = enriched.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0201");

    expect(eurAsset?.marketValue.amount).not.toBeNull();
    expect(eurAsset?.valuation.sourceKind).toBe("latest_trade_price_fallback");
    expect(eurAsset?.metrics?.structure?.portfolioWeight?.status).toBe("partial");
    expect(eurAsset?.metrics?.structure?.portfolioWeight?.value).toBeNull();
    expect(eurAsset?.metrics?.structure?.portfolioWeight?.note).toBe(
      "portfolio_weight_unconverted_mixed_or_unknown_currency",
    );
    expect(eurAsset?.metrics?.quality?.marketPriceFreshness?.state).toBe("fallback");
    expect(eurAsset?.metrics?.quality?.warningCount).toBeGreaterThanOrEqual(1);
    expect(enriched.summary.metrics?.structure?.top5Concentration?.status).toBe("partial");
    expect(enriched.summary.metrics?.structure?.allocationByAssetType?.status).toBe("partial");
    expect(enriched.summary.metrics?.quality?.warningCount).toBeGreaterThanOrEqual(2);
  });

  it("derives payout frequency basics for monthly, irregular and none cases", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "ext_kpi_freq_m1",
        type: "buy",
        datetime: "2025-01-01T10:00:00.000Z",
        isin: "DE000EXT0601",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_freq_m2",
        type: "dividend",
        datetime: "2025-01-05T10:00:00.000Z",
        isin: "DE000EXT0601",
        currency: "EUR",
        amount: 2,
        amountNet: 2,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_freq_m3",
        type: "dividend",
        datetime: "2025-02-05T10:00:00.000Z",
        isin: "DE000EXT0601",
        currency: "EUR",
        amount: 2,
        amountNet: 2,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_freq_m4",
        type: "dividend",
        datetime: "2025-03-05T10:00:00.000Z",
        isin: "DE000EXT0601",
        currency: "EUR",
        amount: 2,
        amountNet: 2,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_freq_i1",
        type: "buy",
        datetime: "2025-01-01T10:00:00.000Z",
        isin: "DE000EXT0602",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_freq_i2",
        type: "dividend",
        datetime: "2025-01-15T10:00:00.000Z",
        isin: "DE000EXT0602",
        currency: "EUR",
        amount: 3,
        amountNet: 3,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_freq_i3",
        type: "dividend",
        datetime: "2025-05-20T10:00:00.000Z",
        isin: "DE000EXT0602",
        currency: "EUR",
        amount: 3,
        amountNet: 3,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_freq_i4",
        type: "dividend",
        datetime: "2025-06-01T10:00:00.000Z",
        isin: "DE000EXT0602",
        currency: "EUR",
        amount: 3,
        amountNet: 3,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_freq_n1",
        type: "buy",
        datetime: "2025-01-01T10:00:00.000Z",
        isin: "DE000EXT0603",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
    ]);

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });

    expect(projected.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0601")?.metrics?.income?.payoutFrequency?.value).toBe("monthly");
    expect(projected.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0602")?.metrics?.income?.payoutFrequency?.value).toBe("irregular");
    expect(projected.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0603")?.metrics?.income?.payoutFrequency?.value).toBe("none");
  });

  it("marks dividend income metrics partial for mixed-currency dividend history", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "ext_kpi_mix_1",
        type: "buy",
        datetime: "2025-01-01T10:00:00.000Z",
        isin: "DE000EXT0701",
        shares: 1,
        currency: "EUR",
        price: 100,
        amount: 100,
        amountNet: 100,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_mix_2",
        type: "dividend",
        datetime: "2025-01-15T10:00:00.000Z",
        isin: "DE000EXT0701",
        currency: "EUR",
        amount: 4,
        amountNet: 4,
      }),
      createSyntheticActivity({
        activityId: "ext_kpi_mix_3",
        type: "dividend",
        datetime: "2025-04-15T10:00:00.000Z",
        isin: "DE000EXT0701",
        currency: "USD",
        amount: 4,
        amountNet: 4,
      }),
    ], {
      marketPriceOverlaysByIsin: {
        DE000EXT0701: {
          priceAmount: 120,
          currency: "EUR",
          priceDate: "2026-06-03",
          priceTimestamp: "2026-06-03T17:00:00.000Z",
          priceSource: "market_data_db",
        },
      },
    });

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const asset = projected.assets.find((entry) => entry.identity.compatibilityIsin === "DE000EXT0701");

    expect(asset?.metrics?.income?.annualizedDividendIncome?.status).toBe("partial");
    expect(asset?.metrics?.income?.dividendYieldOnCost?.status).toBe("partial");
    expect(asset?.metrics?.income?.currentDividendYield?.status).toBe("partial");
  });

  it("preserves meaningful PRM display fallback when metadata status is not ok", () => {
    expect(
      selectPrmDisplayNameForMetadataOverlay({
        resolutionStatus: "missing",
        instrumentDisplayName: null,
        existingDisplayName: "VGWD.DE",
        symbol: "VGWD.DE",
        wkn: "A1T8FV",
        isin: "IE00B8GKDB10",
      }),
    ).toBe("VGWD.DE");

    expect(
      selectPrmDisplayNameForMetadataOverlay({
        resolutionStatus: "missing_name",
        instrumentDisplayName: null,
        existingDisplayName: "Stammdaten fehlen",
        symbol: "VGWD.DE",
        wkn: "A1T8FV",
        isin: "IE00B8GKDB10",
      }),
    ).toBe("VGWD.DE");
  });

  it("counts snapshot-scope warnings from asset rows plus non-overlapping model warnings", () => {
    const fixture = withClassification(
      projectGlobalAssetsProductReadModel({
        aggregation: runGlobalAssetPipeline([
          createSyntheticActivity({
            activityId: "ext_kpi_warn_1",
            type: "buy",
            datetime: "2026-05-01T10:00:00.000Z",
            isin: "DE000EXT0401",
            shares: 1,
            currency: "EUR",
            price: 100,
            amount: 100,
            amountNet: 100,
          }),
        ]).aggregation,
        freshnessState: "fresh",
        scopeState: "scope_match",
      }),
      {
        DE000EXT0401: {
          displayName: "Warning Demo",
          assetType: "ETF",
          currency: "EUR",
        },
      },
    );

    const warningFixture: ProductReadModelAssets = {
      ...fixture,
      metadata: {
        ...fixture.metadata,
        warnings: [
          { code: "GLOBAL_SCOPE_WARNING", severity: "Warning", source: "aggregation", blockedMetrics: [] },
          { code: "MARKET_PRICE_FALLBACK_USED", severity: "Warning", source: "aggregation", blockedMetrics: ["confidence"] },
        ],
      },
      assets: fixture.assets.map((asset, index) =>
        index === 0
          ? {
              ...asset,
              warnings: [
                ...asset.warnings,
                { code: "MARKET_PRICE_FALLBACK_USED", severity: "Warning", source: "aggregation", blockedMetrics: ["confidence"] },
              ],
            }
          : asset,
      ),
    };
    const enriched = enrichGlobalAssetsProductReadModelMetrics(warningFixture);

    expect(enriched.summary.metrics?.quality?.warningCount).toBe(3);
  });
});
