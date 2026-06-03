import { describe, expect, it } from "vitest";

import {
  findAssetByKey,
  selectCanonicalAssetDetailAsset,
  scopeAssetMetrics,
} from "../../src/lib/asset-detail";
import { buildGlobalAssetViewModelsFromProductReadModel } from "../../src/lib/view-models/global-asset-view-model-builder";
import type { ProductReadModelAssets } from "../../src/lib/parqet/global-assets/product-read-model";
import type { GlobalAssetViewModel } from "../../src/lib/types";

function createRuntimeFallbackAsset(): GlobalAssetViewModel {
  return {
    isin: "DEMO00000099",
    portfolioIds: ["portfolio_demo_1"],
    portfolioNames: ["Portfolio Demo 1"],
    portfolioBreakdown: [
      {
        portfolioId: "portfolio_demo_1",
        portfolioName: "Portfolio Demo 1",
        netShares: 2,
        remainingCostBasis: 200,
        avgBuyPrice: 100,
        latestTradePrice: 100,
        marketPrice: 100,
        positionValue: 200,
        unrealizedPnL: 0,
        totalDividendNet: 10,
      },
    ],
    activityCount: 1,
    buyCount: 1,
    sellCount: 0,
    dividendCount: 0,
    totalBoughtShares: 2,
    totalSoldShares: 0,
    netShares: 2,
    totalInvestedGross: 200,
    remainingCostBasis: 200,
    avgBuyPrice: 100,
    latestTradePrice: 100,
    marketPrice: 100,
    marketPriceAt: "2026-06-03T12:00:00.000Z",
    marketPriceSource: "runtime_fallback",
    positionValue: 200,
    unrealizedPnL: 0,
    totalDividendNet: 10,
    latestActivityAt: "2026-06-03T12:00:00.000Z",
    name: "Runtime Asset",
    symbol: "RTA",
    ticker: "RTA",
    tickerSymbol: "RTA",
    wkn: "WKNRTA1",
    metadata: null,
    externalMetadata: null,
    assetMeta: null,
  };
}

function createProductReadModelFixture(): ProductReadModelAssets {
  return {
    metadata: {
      readModelId: "rm-demo",
      snapshotId: null,
      generatedAt: "2026-06-03T12:00:00.000Z",
      sourceType: "app_calculated",
      sourceScope: "selected_portfolios",
      freshnessAt: null,
      freshnessState: "fresh",
      scopeState: "scope_match",
      selectedPortfolioIds: ["portfolio_demo_1"],
      confidence: "high",
      warnings: [],
      blockedMetrics: [],
      valueClassification: "app_calculated",
      providerRequestCount: null,
    },
    summary: {
      assetCount: 1,
      activeAssetCount: 1,
      closedAssetCount: 0,
      unknownAssetCount: 0,
      warningAssetCount: 0,
      blockerWarningCount: 0,
      blockedMetricAssetCount: 0,
      blockedMetricCount: 0,
      valueClassificationCounts: {
        provider_reference: 0,
        app_calculated: 1,
        estimated: 0,
        preliminary: 0,
        blocked: 0,
        none: 0,
      },
    },
    assets: [
      {
        identity: {
          assetKey: { type: "isin", value: "DEMO00000099" },
          stableKey: "isin:DEMO00000099",
          compatibilityIsin: "DEMO00000099",
        },
        display: {
          displayName: "PRM Asset",
          subtitle: null,
          symbol: "PRM",
          wkn: null,
        },
        status: "active",
        quantity: 2,
        quantityValueClassification: "app_calculated",
        valuation: {
          marketPrice: {
            amount: 125,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          latestTradePrice: {
            amount: 100,
            currency: "EUR",
            valueClassification: "preliminary",
            blockedMetrics: [],
          },
          priceDate: "2026-06-03",
          priceTimestamp: "2026-06-03T17:00:00.000Z",
          priceSource: "market_data_db",
          sourceKind: "market_data_db",
          freshnessState: "fresh",
        },
        marketValue: {
          amount: 250,
          currency: "EUR",
          valueClassification: "app_calculated",
          blockedMetrics: [],
        },
        costBasis: {
          amount: 200,
          currency: "EUR",
          valueClassification: "app_calculated",
          blockedMetrics: [],
        },
        unrealizedPnL: {
          amount: 50,
          currency: "EUR",
          valueClassification: "app_calculated",
          blockedMetrics: [],
        },
        dividendsNet: {
          amount: 10,
          currency: "EUR",
          valueClassification: "app_calculated",
          blockedMetrics: [],
        },
        fees: { amount: null, currency: null, valueClassification: "preliminary", blockedMetrics: [] },
        taxes: { amount: null, currency: null, valueClassification: "preliminary", blockedMetrics: [] },
        warnings: [],
        blockedMetrics: [],
        confidence: "high",
        valueClassification: "app_calculated",
        sourceType: "app_calculated",
        sourceScope: "selected_portfolios",
        freshnessState: "fresh",
        scopeState: "scope_match",
        portfolioBreakdown: [
          {
            portfolioId: "portfolio_demo_1",
            portfolioName: "Portfolio Demo 1",
            status: "active",
            quantity: 2,
            valuation: {
              marketPrice: {
                amount: 125,
                currency: "EUR",
                valueClassification: "app_calculated",
                blockedMetrics: [],
              },
              latestTradePrice: {
                amount: 100,
                currency: "EUR",
                valueClassification: "preliminary",
                blockedMetrics: [],
              },
              priceDate: "2026-06-03",
              priceTimestamp: "2026-06-03T17:00:00.000Z",
              priceSource: "market_data_db",
              sourceKind: "market_data_db",
              freshnessState: "fresh",
            },
            marketValue: {
              amount: 250,
              currency: "EUR",
              valueClassification: "app_calculated",
              blockedMetrics: [],
            },
            costBasis: {
              amount: 200,
              currency: "EUR",
              valueClassification: "app_calculated",
              blockedMetrics: [],
            },
            unrealizedPnL: {
              amount: 50,
              currency: "EUR",
              valueClassification: "app_calculated",
              blockedMetrics: [],
            },
            dividendsNet: {
              amount: 10,
              currency: "EUR",
              valueClassification: "app_calculated",
              blockedMetrics: [],
            },
            fees: { amount: null, currency: null, valueClassification: "preliminary", blockedMetrics: [] },
            taxes: { amount: null, currency: null, valueClassification: "preliminary", blockedMetrics: [] },
            warnings: [],
            blockedMetrics: [],
            confidence: "high",
          },
        ],
        latestActivityAt: "2026-06-03T12:00:00.000Z",
      },
    ],
  };
}

describe("asset detail PRM convergence", () => {
  it("prefers the PRM-backed asset row for detail valuation KPIs when the guard is ready", () => {
    const runtimeFallbackAssets = [createRuntimeFallbackAsset()];
    const selection = selectCanonicalAssetDetailAsset({
      assetKey: "DEMO00000099",
      runtimeFallbackAssets,
      productReadModel: createProductReadModelFixture(),
      guardEnabled: true,
    });

    expect(selection.assetSource).toBe("global_asset_product");
    expect(selection.selection.selectedSource).toBe("global_asset_product");
    expect(selection.asset?.name).toBe("PRM Asset");
    expect(selection.asset?.positionValue).toBe(250);
    expect(selection.asset?.unrealizedPnL).toBe(50);
    expect(selection.asset?.remainingCostBasis).toBe(200);
    expect(selection.asset?.marketPrice).toBe(125);
    expect(selection.asset?.latestTradePrice).toBe(100);
  });

  it("falls back explicitly to runtime rows when the PRM cannot be selected", () => {
    const runtimeFallbackAssets = [createRuntimeFallbackAsset()];
    const selection = selectCanonicalAssetDetailAsset({
      assetKey: "DEMO00000099",
      runtimeFallbackAssets,
      productReadModel: {
        ...createProductReadModelFixture(),
        metadata: {
          ...createProductReadModelFixture().metadata,
          freshnessState: "stale",
        },
      },
      guardEnabled: true,
    });

    expect(selection.assetSource).toBe("runtime_assets_fallback");
    expect(selection.selection.selectedSource).toBe("runtime_assets_fallback");
    expect(selection.selection.reason).toBe("product_read_model_not_fresh");
    expect(selection.asset?.name).toBe("Runtime Asset");
    expect(selection.asset?.positionValue).toBe(200);
    expect(selection.asset?.unrealizedPnL).toBe(0);
  });

  it("keeps scoped detail metrics aligned with the selected PRM-backed asset row", () => {
    const prmAsset = findAssetByKey(
      buildGlobalAssetViewModelsFromProductReadModel(createProductReadModelFixture()),
      "DEMO00000099",
    );

    expect(prmAsset).not.toBeNull();

    const metrics = scopeAssetMetrics(prmAsset!, ["portfolio_demo_1"]);
    expect(metrics.positionValue).toBe(250);
    expect(metrics.unrealizedPnL).toBe(50);
    expect(metrics.remainingCostBasis).toBe(200);
    expect(metrics.marketPrice).toBe(125);
    expect(metrics.latestTradePrice).toBe(100);
  });
});
