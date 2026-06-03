import { describe, expect, it } from "vitest";

import type { ActivityContext } from "../../src/lib/parqet-assets/build-activity-context";
import type { Portfolio } from "../../src/lib/types";
import { buildGlobalAssetProductReadModelFromActivityContext } from "../../src/lib/parqet/global-assets/coexistence";

function createPortfolio(id: string, name: string, currency = "EUR"): Portfolio {
  return {
    id,
    name,
    currency,
    createdAt: "2026-05-14T00:00:00.000Z",
    distinctBrokers: [],
  };
}

function createActivityContextFixture(): ActivityContext {
  const portfolio = createPortfolio("portfolio_demo_1", "Portfolio Demo 1");
  const portfolioNameById = new Map([[portfolio.id, portfolio.name]]);
  const filteredActivities = [
    {
      id: "activity_coexistence_001",
      type: "buy",
      datetime: "2026-05-10T10:00:00.000Z",
      shares: 2,
      price: 100,
      amount: 200,
      amountNet: 200,
      currency: "EUR",
      portfolioId: portfolio.id,
      isin: "DEMO00000011",
      name: "Demo Asset One",
      symbol: "DMO1",
      wkn: "WKNDMO1",
      asset: {
        isin: "DEMO00000011",
      },
    },
    {
      id: "activity_coexistence_002",
      type: "dividend",
      datetime: "2026-05-12T10:00:00.000Z",
      amount: 10,
      amountNet: 10,
      currency: "EUR",
      portfolioId: portfolio.id,
      isin: "DEMO00000011",
      name: "Demo Asset One",
      symbol: "DMO1",
      wkn: "WKNDMO1",
      asset: {
        isin: "DEMO00000011",
      },
    },
  ];

  return {
    authorizedPortfolios: [portfolio],
    selectedPortfolios: [portfolio],
    portfolioNameById,
    rawActivities: filteredActivities,
    rawActivityCount: filteredActivities.length,
    filteredActivities,
    normalizedActivities: [],
    correctedActivities: [],
    reconciliationWarnings: [],
    freshness: {
      present: true,
      loadedAt: "2026-05-14T08:00:00.000Z",
      updatedAt: "2026-05-14T08:30:00.000Z",
      status: "fresh",
      source: "provider",
      refreshStatus: "refreshed",
      stale: false,
      scope: {
        portfolioCount: 1,
        fingerprint: "fixture-fingerprint-001",
      },
      lastRefreshErrorCategory: null,
    },
  };
}

describe("global-asset coexistence cache population bridge", () => {
  it("builds a product read model from existing activity-context data without extra fetch metadata", () => {
    const productReadModel = buildGlobalAssetProductReadModelFromActivityContext({
      activityContext: createActivityContextFixture(),
      requestedPortfolioIds: ["portfolio_demo_1"],
      generatedAt: "2026-05-14T09:00:00.000Z",
      marketPriceOverlaysByIsin: {
        DEMO00000011: {
          priceAmount: 120,
          currency: "EUR",
          priceDate: "2026-05-13",
          priceTimestamp: "2026-05-13T17:00:00.000Z",
          priceSource: "yfinance",
        },
      },
    });

    expect(productReadModel).not.toBeNull();
    expect(productReadModel?.metadata.sourceType).toBe("provider");
    expect(productReadModel?.metadata.sourceScope).toBe("selected_portfolios");
    expect(productReadModel?.metadata.freshnessState).toBe("fresh");
    expect(productReadModel?.metadata.scopeState).toBe("scope_match");
    expect(productReadModel?.metadata.snapshotId).toBe("activity-snapshot:fixture-fingerprint-001");
    expect(productReadModel?.metadata.providerRequestCount).toBeNull();
    expect(productReadModel?.summary.assetCount).toBe(1);
    expect(productReadModel?.assets[0]?.valuation.marketPrice.amount).toBe(120);
    expect(productReadModel?.assets[0]?.valuation.priceSource).toBe("yfinance");
    expect(productReadModel?.assets[0]?.marketValue.amount).toBe(240);
    expect(productReadModel?.assets[0]?.unrealizedPnL.amount).toBe(40);
  });

  it("marks scope as missing when requested portfolio ids are not covered by the selected context", () => {
    const productReadModel = buildGlobalAssetProductReadModelFromActivityContext({
      activityContext: createActivityContextFixture(),
      requestedPortfolioIds: ["portfolio_demo_1", "portfolio_demo_2"],
      generatedAt: "2026-05-14T09:00:00.000Z",
    });

    expect(productReadModel).not.toBeNull();
    expect(productReadModel?.metadata.scopeState).toBe("scope_missing");
  });

  it("returns null when no selected portfolio scope is available for a safe product projection", () => {
    const emptyScopeContext = createActivityContextFixture();
    emptyScopeContext.selectedPortfolios = [];

    const productReadModel = buildGlobalAssetProductReadModelFromActivityContext({
      activityContext: emptyScopeContext,
      requestedPortfolioIds: ["portfolio_demo_1"],
      generatedAt: "2026-05-14T09:00:00.000Z",
    });

    expect(productReadModel).toBeNull();
  });
});
