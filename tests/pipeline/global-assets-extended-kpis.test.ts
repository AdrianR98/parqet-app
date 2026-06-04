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
