import { afterEach, describe, expect, it } from "vitest";

import {
  buildGlobalAssetsProductReadModelComparisonEvidence,
  projectGlobalAssetsProductReadModel,
} from "../../src/lib/parqet/global-assets/product-read-model";
import {
  buildCompatibilityAssetSummariesFromGuardedRows,
  selectGuardedProductSurfaceSource,
} from "../../src/lib/parqet/global-assets/product-surface-selectors";
import {
  selectGuardedAssetTableSource,
  selectGuardedDashboardSource,
  resolveGlobalAssetProductGuardEnabled,
} from "../../src/lib/dashboard-helpers";
import { loadLocalReportModel } from "../../src/lib/reporting";
import { DASHBOARD_CACHE_KEY } from "../../src/lib/dashboard-cache";
import { runGlobalAssetPipeline, createSyntheticActivity } from "./global-assets-test-helpers";
import type { AssetSummary } from "../../src/lib/types";

type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createLocalStorageMock(seed?: Record<string, string>): LocalStorageMock {
  const store = new Map<string, string>(Object.entries(seed ?? {}));

  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function installWindowWithLocalStorage(seed?: Record<string, string>): void {
  const localStorage = createLocalStorageMock(seed);

  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage,
    },
    configurable: true,
    writable: true,
  });
}

function createCompatibilityAssetsFixture(): AssetSummary[] {
  return [
    {
      isin: "DEMO00000011",
      portfolioIds: ["portfolio_demo_1", "portfolio_demo_2"],
      portfolioNames: ["Portfolio Demo 1", "Portfolio Demo 2"],
      portfolioBreakdown: [
        {
          portfolioId: "portfolio_demo_1",
          portfolioName: "Portfolio Demo 1",
          netShares: 3,
          remainingCostBasis: 300,
          avgBuyPrice: 100,
          latestTradePrice: 110,
          marketPrice: 112,
          positionValue: 336,
          unrealizedPnL: 36,
          totalDividendNet: 12,
        },
      ],
      activityCount: 4,
      buyCount: 2,
      sellCount: 1,
      dividendCount: 1,
      totalBoughtShares: 5,
      totalSoldShares: 2,
      netShares: 3,
      totalInvestedGross: 500,
      remainingCostBasis: 300,
      avgBuyPrice: 100,
      latestTradePrice: 110,
      marketPrice: 112,
      marketPriceAt: "2026-05-14T00:00:00.000Z",
      marketPriceSource: "synthetic-fixture",
      positionValue: 336,
      unrealizedPnL: 36,
      totalDividendNet: 12,
      latestActivityAt: "2026-05-14T00:00:00.000Z",
      name: "Demo Asset One",
      symbol: "DMO1",
      ticker: "DMO1",
      tickerSymbol: "DMO1",
      wkn: "WKNDMO1",
      metadata: null,
      externalMetadata: null,
      assetMeta: null,
    },
    {
      isin: "DEMO00000012",
      portfolioIds: ["portfolio_demo_1"],
      portfolioNames: ["Portfolio Demo 1"],
      portfolioBreakdown: [
        {
          portfolioId: "portfolio_demo_1",
          portfolioName: "Portfolio Demo 1",
          netShares: 0,
          remainingCostBasis: 0,
          avgBuyPrice: null,
          latestTradePrice: 10,
          marketPrice: 10,
          positionValue: 0,
          unrealizedPnL: 0,
          totalDividendNet: 2,
        },
      ],
      activityCount: 2,
      buyCount: 1,
      sellCount: 1,
      dividendCount: 0,
      totalBoughtShares: 1,
      totalSoldShares: 1,
      netShares: 0,
      totalInvestedGross: 10,
      remainingCostBasis: 0,
      avgBuyPrice: null,
      latestTradePrice: 10,
      marketPrice: 10,
      marketPriceAt: "2026-05-14T00:00:00.000Z",
      marketPriceSource: "synthetic-fixture",
      positionValue: 0,
      unrealizedPnL: 0,
      totalDividendNet: 2,
      latestActivityAt: "2026-05-13T00:00:00.000Z",
      name: "Demo Asset Two",
      symbol: "DMO2",
      ticker: "DMO2",
      tickerSymbol: "DMO2",
      wkn: "WKNDMO2",
      metadata: null,
      externalMetadata: null,
      assetMeta: null,
    },
  ];
}

function buildProjectedProductReadModel() {
  const { aggregation } = runGlobalAssetPipeline([
    createSyntheticActivity({
      activityId: "activity_guarded_001",
      type: "buy",
      datetime: "2026-05-10T10:00:00.000Z",
      isin: "DEMO00000011",
      shares: 5,
      price: 100,
      currency: "EUR",
      amount: 500,
      amountNet: 500,
      portfolioId: "portfolio_demo_1",
      portfolioName: "Portfolio Demo 1",
    }),
    createSyntheticActivity({
      activityId: "activity_guarded_002",
      type: "sell",
      datetime: "2026-05-11T10:00:00.000Z",
      isin: "DEMO00000011",
      shares: 2,
      price: 110,
      currency: "EUR",
      amount: 220,
      amountNet: 220,
      portfolioId: "portfolio_demo_2",
      portfolioName: "Portfolio Demo 2",
    }),
    createSyntheticActivity({
      activityId: "activity_guarded_003",
      type: "dividend",
      datetime: "2026-05-12T10:00:00.000Z",
      isin: "DEMO00000011",
      amount: 12,
      amountNet: 12,
      currency: "EUR",
      portfolioId: "portfolio_demo_2",
      portfolioName: "Portfolio Demo 2",
    }),
    createSyntheticActivity({
      activityId: "activity_guarded_004",
      type: "buy",
      datetime: "2026-05-10T10:00:00.000Z",
      isin: "DEMO00000012",
      shares: 1,
      price: 10,
      currency: "EUR",
      amount: 10,
      amountNet: 10,
      portfolioId: "portfolio_demo_1",
      portfolioName: "Portfolio Demo 1",
    }),
    createSyntheticActivity({
      activityId: "activity_guarded_005",
      type: "sell",
      datetime: "2026-05-13T10:00:00.000Z",
      isin: "DEMO00000012",
      shares: 1,
      price: 10,
      currency: "EUR",
      amount: 10,
      amountNet: 10,
      portfolioId: "portfolio_demo_1",
      portfolioName: "Portfolio Demo 1",
    }),
  ]);

  return projectGlobalAssetsProductReadModel({
    aggregation,
    readModelId: "rm-global-assets-guarded",
    snapshotId: "snapshot-guarded-1",
    generatedAt: "2026-05-14T09:00:00.000Z",
    sourceType: "local_snapshot",
    sourceScope: "selected_portfolios",
    freshnessAt: "2026-05-14T08:30:00.000Z",
    freshnessState: "fresh",
    scopeState: "scope_match",
    selectedPortfolioIds: ["portfolio_demo_1", "portfolio_demo_2"],
    providerRequestCount: 0,
  });
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_GLOBAL_ASSET_PRODUCT_GUARD_ENABLED;
  Reflect.deleteProperty(globalThis, "window");
});

describe("guarded global-asset product migration selectors", () => {
  it("defaults to safe guarded mode and supports explicit rollback values", () => {
    expect(resolveGlobalAssetProductGuardEnabled()).toBe(true);
    expect(resolveGlobalAssetProductGuardEnabled("true")).toBe(true);
    expect(resolveGlobalAssetProductGuardEnabled("on")).toBe(true);
    expect(resolveGlobalAssetProductGuardEnabled("1")).toBe(true);
    expect(resolveGlobalAssetProductGuardEnabled("false")).toBe(false);
    expect(resolveGlobalAssetProductGuardEnabled("off")).toBe(false);
    expect(resolveGlobalAssetProductGuardEnabled("0")).toBe(false);
  });

  it("projects dashboard/report-ready asset rows with metadata and safe blocked-metric semantics", () => {
    const projected = buildProjectedProductReadModel();

    expect(projected.metadata.readModelId).toBe("rm-global-assets-guarded");
    expect(projected.metadata.sourceType).toBe("local_snapshot");
    expect(projected.metadata.freshnessState).toBe("fresh");
    expect(projected.metadata.scopeState).toBe("scope_match");
    expect(projected.summary.assetCount).toBe(2);
    expect(projected.summary.activeAssetCount).toBe(1);
    expect(projected.summary.closedAssetCount).toBe(1);
    expect(projected.assets[0]?.identity.stableKey).toBe("isin:DEMO00000011");
    expect(projected.assets[0]?.portfolioBreakdown.length).toBeGreaterThan(1);
    expect(projected.assets[0]?.quantity).toBe(3);
    expect(projected.assets[0]?.marketValue.valueClassification).toBe("blocked");
    expect(projected.assets[1]?.status).toBe("closed");
    expect(projected.assets[1]?.quantity).toBe(0);
  });

  it("builds count-safe old/new comparison evidence", () => {
    const projected = buildProjectedProductReadModel();
    const compatibilityAssets = createCompatibilityAssetsFixture();
    const evidence = buildGlobalAssetsProductReadModelComparisonEvidence({
      compatibilityAssets,
      projected,
    });

    expect(evidence.compatibility.assetCount).toBe(2);
    expect(evidence.projected.assetCount).toBe(2);
    expect(evidence.projected.withQuantityCount).toBe(2);
    expect(evidence.projected.withMarketValueCount).toBe(0);
    expect(evidence.delta.assetCount).toBe(0);
  });

  it("selects guarded source for dashboard/asset-table/reports only when enabled and ready", () => {
    const projected = buildProjectedProductReadModel();
    const compatibilityAssets = createCompatibilityAssetsFixture();

    const disabledSelection = selectGuardedProductSurfaceSource({
      surface: "dashboard",
      compatibilityAssets,
      productReadModel: projected,
      guardEnabled: false,
    });
    expect(disabledSelection.selectedSource).toBe("compatibility");
    expect(disabledSelection.reason).toBe("guard_not_enabled");

    const staleSelection = selectGuardedProductSurfaceSource({
      surface: "reports",
      compatibilityAssets,
      productReadModel: {
        ...projected,
        metadata: {
          ...projected.metadata,
          freshnessState: "stale",
        },
      },
      guardEnabled: true,
    });
    expect(staleSelection.selectedSource).toBe("compatibility");
    expect(staleSelection.reason).toBe("product_read_model_not_fresh");

    const scopeMismatchSelection = selectGuardedProductSurfaceSource({
      surface: "asset_table",
      compatibilityAssets,
      productReadModel: {
        ...projected,
        metadata: {
          ...projected.metadata,
          scopeState: "scope_missing",
        },
      },
      guardEnabled: true,
    });
    expect(scopeMismatchSelection.selectedSource).toBe("compatibility");
    expect(scopeMismatchSelection.reason).toBe("product_read_model_scope_mismatch");

    const readySelection = selectGuardedProductSurfaceSource({
      surface: "dashboard",
      compatibilityAssets,
      productReadModel: projected,
      guardEnabled: true,
    });
    expect(readySelection.selectedSource).toBe("global_asset_product");
    expect(readySelection.reason).toBe("product_read_model_ready");
  });

  it("keeps valuation/performance and transfer-sensitive fields compatibility-backed while using safe product identity fields", () => {
    const projected = buildProjectedProductReadModel();
    const projectedWithForcedValuationValues = {
      ...projected,
      assets: projected.assets.map((asset) =>
        asset.identity.compatibilityIsin === "DEMO00000011"
          ? {
              ...asset,
              display: {
                ...asset.display,
                displayName: "Guarded Product Asset",
                symbol: "GPA",
                wkn: "WKNGPA1",
              },
              quantity: 999,
              marketValue: {
                ...asset.marketValue,
                amount: 999_999,
                currency: "EUR",
              },
              costBasis: {
                ...asset.costBasis,
                amount: 888_888,
                currency: "EUR",
              },
              unrealizedPnL: {
                ...asset.unrealizedPnL,
                amount: 777_777,
                currency: "EUR",
              },
              portfolioBreakdown: asset.portfolioBreakdown.map((entry, index) => ({
                ...entry,
                portfolioName:
                  index === 0 ? "Guarded Portfolio One" : "Guarded Portfolio Two",
                quantity: 444,
                marketValue: {
                  ...entry.marketValue,
                  amount: 444_444,
                  currency: "EUR",
                },
                costBasis: {
                  ...entry.costBasis,
                  amount: 333_333,
                  currency: "EUR",
                },
                unrealizedPnL: {
                  ...entry.unrealizedPnL,
                  amount: 222_222,
                  currency: "EUR",
                },
              })),
            }
          : asset,
      ),
    };
    const compatibilityAssets = createCompatibilityAssetsFixture();
    const fallbackRows = buildCompatibilityAssetSummariesFromGuardedRows({
      productReadModel: projectedWithForcedValuationValues,
      compatibilityAssets,
    });
    const dashboardSelection = selectGuardedDashboardSource({
      compatibilityAssets,
      productReadModel: projectedWithForcedValuationValues,
      guardEnabled: true,
    });
    const assetTableSelection = selectGuardedAssetTableSource({
      compatibilityAssets,
      productReadModel: projectedWithForcedValuationValues,
      guardEnabled: true,
    });

    expect(fallbackRows[0]?.name).toBe("Guarded Product Asset");
    expect(fallbackRows[0]?.portfolioBreakdown[0]?.portfolioName).toBe(
      "Guarded Portfolio One",
    );
    expect(fallbackRows[0]?.positionValue).toBe(336);
    expect(fallbackRows[0]?.unrealizedPnL).toBe(36);
    expect(fallbackRows[0]?.netShares).toBe(3);
    expect(fallbackRows[0]?.remainingCostBasis).toBe(300);
    expect(fallbackRows[0]?.avgBuyPrice).toBe(100);
    expect(fallbackRows[0]?.portfolioBreakdown[0]?.positionValue).toBe(336);
    expect(fallbackRows[0]?.portfolioBreakdown[0]?.unrealizedPnL).toBe(36);
    expect(fallbackRows[0]?.portfolioBreakdown[0]?.netShares).toBe(3);
    expect(dashboardSelection.selection.selectedSource).toBe("global_asset_product");
    expect(assetTableSelection.selection.selectedSource).toBe("global_asset_product");
    expect(dashboardSelection.selection.fallbackFields).toContain("position_value");
    expect(dashboardSelection.selection.fallbackFields).toContain("unrealized_pnl");
    expect(dashboardSelection.selection.fallbackFields).toContain("remaining_cost_basis");
    expect(dashboardSelection.selection.fallbackFields).toContain("avg_buy_price");
    expect(dashboardSelection.selection.fallbackFields).toContain("net_shares");
  });
});

describe("reports guarded source integration", () => {
  it("uses guarded reports source by default when local coexistence cache is ready", () => {
    const projected = buildProjectedProductReadModel();
    const compatibilityAssets = createCompatibilityAssetsFixture();
    const projectedWithSafeIdentity = {
      ...projected,
      assets: projected.assets.map((asset) =>
        asset.identity.compatibilityIsin === "DEMO00000011"
          ? {
              ...asset,
              display: {
                ...asset.display,
                displayName: "Guarded Report Asset",
              },
            }
          : asset,
      ),
    };

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify({
        activeAssets: compatibilityAssets.filter((asset) => asset.netShares > 0),
        closedAssets: compatibilityAssets.filter((asset) => asset.netShares === 0),
        rawActivityCount: 5,
        filteredActivityCount: 5,
        assetCount: 2,
        activeAssetCount: 1,
        closedAssetCount: 1,
        consistencyReport: null,
        reconciliationWarnings: [],
        generatedAt: "2026-05-14T09:00:00.000Z",
        lastUpdatedAt: "2026-05-14T09:00:00.000Z",
        selectedPortfolioIds: ["portfolio_demo_1", "portfolio_demo_2"],
        freshness: {
          present: true,
          loadedAt: "2026-05-14T08:30:00.000Z",
          updatedAt: "2026-05-14T09:00:00.000Z",
          status: "fresh",
          source: "snapshot",
          refreshStatus: "refreshed",
          stale: false,
          scope: {
            portfolioCount: 2,
            fingerprint: "synthetic-fingerprint",
          },
          lastRefreshErrorCategory: null,
        },
        activityItems: [],
        globalAssetProductReadModel: projectedWithSafeIdentity,
      }),
    });

    const report = loadLocalReportModel();

    expect(report).not.toBeNull();
    expect(report?.guardedSelection.selectedSource).toBe("global_asset_product");
    expect(report?.guardedSelection.reason).toBe("product_read_model_ready");
    expect(report?.assets[0]?.name).toBe("Guarded Report Asset");
    expect(report?.assets.length).toBe(2);
    expect(report?.totals.totalPositionValue).toBe(336);
    expect(report?.totals.totalUnrealizedPnL).toBe(36);
  });

  it("falls back to compatibility report source when old cache has no global asset product model", () => {
    process.env.NEXT_PUBLIC_GLOBAL_ASSET_PRODUCT_GUARD_ENABLED = "true";
    const compatibilityAssets = createCompatibilityAssetsFixture();

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify({
        activeAssets: compatibilityAssets.filter((asset) => asset.netShares > 0),
        closedAssets: compatibilityAssets.filter((asset) => asset.netShares === 0),
        rawActivityCount: 5,
        filteredActivityCount: 5,
        assetCount: 2,
        activeAssetCount: 1,
        closedAssetCount: 1,
        consistencyReport: null,
        reconciliationWarnings: [],
        generatedAt: "2026-05-14T09:00:00.000Z",
        lastUpdatedAt: "2026-05-14T09:00:00.000Z",
        selectedPortfolioIds: ["portfolio_demo_1", "portfolio_demo_2"],
        freshness: {
          present: true,
          loadedAt: "2026-05-14T08:30:00.000Z",
          updatedAt: "2026-05-14T09:00:00.000Z",
          status: "fresh",
          source: "snapshot",
          refreshStatus: "refreshed",
          stale: false,
          scope: {
            portfolioCount: 2,
            fingerprint: "synthetic-fingerprint",
          },
          lastRefreshErrorCategory: null,
        },
        activityItems: [],
      }),
    });

    const report = loadLocalReportModel();

    expect(report).not.toBeNull();
    expect(report?.guardedSelection.selectedSource).toBe("compatibility");
    expect(report?.guardedSelection.reason).toBe("product_read_model_missing");
    expect(report?.assets.length).toBe(2);
    expect(report?.totals.totalPositionValue).toBe(336);
    expect(report?.totals.totalUnrealizedPnL).toBe(36);
  });

  it("falls back to compatibility report source when product read model is stale", () => {
    process.env.NEXT_PUBLIC_GLOBAL_ASSET_PRODUCT_GUARD_ENABLED = "true";
    const projected = buildProjectedProductReadModel();
    const compatibilityAssets = createCompatibilityAssetsFixture();

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify({
        activeAssets: compatibilityAssets.filter((asset) => asset.netShares > 0),
        closedAssets: compatibilityAssets.filter((asset) => asset.netShares === 0),
        rawActivityCount: 5,
        filteredActivityCount: 5,
        assetCount: 2,
        activeAssetCount: 1,
        closedAssetCount: 1,
        consistencyReport: null,
        reconciliationWarnings: [],
        generatedAt: "2026-05-14T09:00:00.000Z",
        lastUpdatedAt: "2026-05-14T09:00:00.000Z",
        selectedPortfolioIds: ["portfolio_demo_1", "portfolio_demo_2"],
        freshness: {
          present: true,
          loadedAt: "2026-05-14T08:30:00.000Z",
          updatedAt: "2026-05-14T09:00:00.000Z",
          status: "fresh",
          source: "snapshot",
          refreshStatus: "refreshed",
          stale: false,
          scope: {
            portfolioCount: 2,
            fingerprint: "synthetic-fingerprint",
          },
          lastRefreshErrorCategory: null,
        },
        activityItems: [],
        globalAssetProductReadModel: {
          ...projected,
          metadata: {
            ...projected.metadata,
            freshnessState: "stale",
          },
        },
      }),
    });

    const report = loadLocalReportModel();

    expect(report).not.toBeNull();
    expect(report?.guardedSelection.selectedSource).toBe("compatibility");
    expect(report?.guardedSelection.reason).toBe("product_read_model_not_fresh");
    expect(report?.assets.length).toBe(2);
    expect(report?.totals.totalPositionValue).toBe(336);
    expect(report?.totals.totalUnrealizedPnL).toBe(36);
  });

  it.each(["false", "off", "0"])(
    "supports rollback by forcing compatibility report source when guard flag is %s",
    (rawFlagValue) => {
      process.env.NEXT_PUBLIC_GLOBAL_ASSET_PRODUCT_GUARD_ENABLED = rawFlagValue;
      const projected = buildProjectedProductReadModel();
      const compatibilityAssets = createCompatibilityAssetsFixture();

      installWindowWithLocalStorage({
        [DASHBOARD_CACHE_KEY]: JSON.stringify({
          activeAssets: compatibilityAssets.filter((asset) => asset.netShares > 0),
          closedAssets: compatibilityAssets.filter((asset) => asset.netShares === 0),
          rawActivityCount: 5,
          filteredActivityCount: 5,
          assetCount: 2,
          activeAssetCount: 1,
          closedAssetCount: 1,
          consistencyReport: null,
          reconciliationWarnings: [],
          generatedAt: "2026-05-14T09:00:00.000Z",
          lastUpdatedAt: "2026-05-14T09:00:00.000Z",
          selectedPortfolioIds: ["portfolio_demo_1", "portfolio_demo_2"],
          freshness: {
            present: true,
            loadedAt: "2026-05-14T08:30:00.000Z",
            updatedAt: "2026-05-14T09:00:00.000Z",
            status: "fresh",
            source: "snapshot",
            refreshStatus: "refreshed",
            stale: false,
            scope: {
              portfolioCount: 2,
              fingerprint: "synthetic-fingerprint",
            },
            lastRefreshErrorCategory: null,
          },
          activityItems: [],
          globalAssetProductReadModel: projected,
        }),
      });

      const report = loadLocalReportModel();

      expect(report).not.toBeNull();
      expect(report?.guardedSelection.selectedSource).toBe("compatibility");
      expect(report?.guardedSelection.reason).toBe("guard_not_enabled");
      expect(report?.totals.totalPositionValue).toBe(336);
      expect(report?.totals.totalUnrealizedPnL).toBe(36);
    },
  );
});
