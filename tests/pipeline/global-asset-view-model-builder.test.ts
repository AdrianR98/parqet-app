import { describe, expect, it } from "vitest";

import { buildGlobalAssetViewModelsFromProductReadModel } from "../../src/lib/view-models/global-asset-view-model-builder";
import type { ProductReadModelAssets } from "../../src/lib/parqet/global-assets/product-read-model";

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
          displayName: "Demo Asset",
          subtitle: null,
          symbol: "DEMO",
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
          priceDate: "2026-06-02",
          priceTimestamp: "2026-06-02T17:00:00.000Z",
          priceSource: "yfinance",
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
          } as ProductReadModelAssets["assets"][number]["portfolioBreakdown"][number],
        ],
        latestActivityAt: "2026-06-01T12:00:00.000Z",
      },
    ],
  };
}

describe("global asset PRM view-model builder", () => {
  it("does not crash when portfolio breakdown valuation is missing and falls back to row valuation", () => {
    const viewModels = buildGlobalAssetViewModelsFromProductReadModel(
      createProductReadModelFixture(),
    );

    expect(viewModels).toHaveLength(1);
    expect(viewModels[0]?.portfolioBreakdown[0]?.marketPrice).toBe(125);
    expect(viewModels[0]?.portfolioBreakdown[0]?.latestTradePrice).toBe(100);
    expect(viewModels[0]?.positionValue).toBe(250);
    expect(viewModels[0]?.unrealizedPnL).toBe(50);
  });
});
