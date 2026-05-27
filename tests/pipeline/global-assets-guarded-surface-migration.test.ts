import { afterEach, describe, expect, it } from "vitest";

import {
  buildGlobalAssetsProductReadModelComparisonEvidence,
  projectGlobalAssetsProductReadModel,
} from "../../src/lib/parqet/global-assets/product-read-model";
import {
  buildGlobalAssetViewModelsFromProductReadModel,
  selectCanonicalSafeFieldProductSurfaceSource,
} from "../../src/lib/parqet/global-assets/product-surface-selectors";
import {
  selectCanonicalAssetTableSafeFieldSource,
  selectCanonicalDashboardSafeFieldSource,
  resolveGlobalAssetProductGuardEnabled,
} from "../../src/lib/dashboard-helpers";
import { loadLocalReportModel } from "../../src/lib/reporting";
import { DASHBOARD_CACHE_KEY } from "../../src/lib/dashboard-cache";
import { runGlobalAssetPipeline, createSyntheticActivity } from "./global-assets-test-helpers";
import type { GlobalAssetViewModel } from "../../src/lib/types";

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

function createRuntimeFallbackAssetsFixture(): GlobalAssetViewModel[] {
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

describe("canonical global-asset safe-field migration selectors", () => {
  it("defaults to canonical safe-field mode and supports explicit rollback values", () => {
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
    const runtimeFallbackAssets = createRuntimeFallbackAssetsFixture();
    const evidence = buildGlobalAssetsProductReadModelComparisonEvidence({
      runtimeFallbackAssets,
      projected,
    });

    expect(evidence.compatibility.assetCount).toBe(2);
    expect(evidence.projected.assetCount).toBe(2);
    expect(evidence.projected.withQuantityCount).toBe(2);
    expect(evidence.projected.withMarketValueCount).toBe(0);
    expect(evidence.delta.assetCount).toBe(0);
  });

  it("selects canonical safe-field source for dashboard/asset-table/reports only when enabled and ready", () => {
    const projected = buildProjectedProductReadModel();
    const runtimeFallbackAssets = createRuntimeFallbackAssetsFixture();

    const disabledSelection = selectCanonicalSafeFieldProductSurfaceSource({
      surface: "dashboard",
      runtimeFallbackAssets,
      productReadModel: projected,
      guardEnabled: false,
    });
    expect(disabledSelection.selectedSource).toBe("runtime_assets_fallback");
    expect(disabledSelection.reason).toBe("guard_disabled");

    const staleSelection = selectCanonicalSafeFieldProductSurfaceSource({
      surface: "reports",
      runtimeFallbackAssets,
      productReadModel: {
        ...projected,
        metadata: {
          ...projected.metadata,
          freshnessState: "stale",
        },
      },
      guardEnabled: true,
    });
    expect(staleSelection.selectedSource).toBe("runtime_assets_fallback");
    expect(staleSelection.reason).toBe("product_read_model_not_fresh");

    const scopeMismatchSelection = selectCanonicalSafeFieldProductSurfaceSource({
      surface: "asset_table",
      runtimeFallbackAssets,
      productReadModel: {
        ...projected,
        metadata: {
          ...projected.metadata,
          scopeState: "scope_missing",
        },
      },
      guardEnabled: true,
    });
    expect(scopeMismatchSelection.selectedSource).toBe("runtime_assets_fallback");
    expect(scopeMismatchSelection.reason).toBe("product_read_model_scope_mismatch");

    const readySelection = selectCanonicalSafeFieldProductSurfaceSource({
      surface: "dashboard",
      runtimeFallbackAssets,
      productReadModel: projected,
      guardEnabled: true,
    });
    expect(readySelection.selectedSource).toBe("global_asset_product");
    expect(readySelection.reason).toBe("product_read_model_ready");
    expect(readySelection.diagnostics.readModelId).toBe("rm-global-assets-guarded");
    expect(readySelection.diagnostics.sourceType).toBe("local_snapshot");
    expect(readySelection.diagnostics.sourceScope).toBe("selected_portfolios");
    expect(readySelection.diagnostics.confidence).toBe(projected.metadata.confidence);
    expect(readySelection.diagnostics.providerRequestCount).toBe(0);
  });

  it("falls back to runtime fallback for invalid or empty product read-model data", () => {
    const projected = buildProjectedProductReadModel();
    const runtimeFallbackAssets = createRuntimeFallbackAssetsFixture();

    const invalidSelection = selectCanonicalSafeFieldProductSurfaceSource({
      surface: "dashboard",
      runtimeFallbackAssets,
      productReadModel: { assets: [] },
      guardEnabled: true,
    });
    expect(invalidSelection.selectedSource).toBe("runtime_assets_fallback");
    expect(invalidSelection.reason).toBe("product_read_model_invalid");

    const emptySelection = selectCanonicalSafeFieldProductSurfaceSource({
      surface: "reports",
      runtimeFallbackAssets,
      productReadModel: {
        ...projected,
        assets: [],
      },
      guardEnabled: true,
    });
    expect(emptySelection.selectedSource).toBe("runtime_assets_fallback");
    expect(emptySelection.reason).toBe("product_read_model_empty");
  });

  it("keeps valuation/performance and transfer-sensitive fields runtime-fallback-backed while using canonical product safe fields", () => {
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
              dividendsNet: {
                ...asset.dividendsNet,
                amount: 666_666,
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
                dividendsNet: {
                  ...entry.dividendsNet,
                  amount: 111_111,
                  currency: "EUR",
                },
              })),
            }
          : asset,
      ),
    };
    const runtimeFallbackAssets = createRuntimeFallbackAssetsFixture();
    const fallbackByIsin = new Map(
      runtimeFallbackAssets.map((asset) => [asset.isin, asset])
    );
    const projectedRows = buildGlobalAssetViewModelsFromProductReadModel(
      projectedWithForcedValuationValues
    );
    const selectedRows = projectedRows.map((asset) => {
      const fallbackAsset = fallbackByIsin.get(asset.isin);
      if (!fallbackAsset) {
        return asset;
      }

      return {
        ...asset,
        netShares: fallbackAsset.netShares,
        remainingCostBasis: fallbackAsset.remainingCostBasis,
        avgBuyPrice: fallbackAsset.avgBuyPrice,
        positionValue: fallbackAsset.positionValue,
        unrealizedPnL: fallbackAsset.unrealizedPnL,
        totalDividendNet: fallbackAsset.totalDividendNet,
        latestTradePrice: fallbackAsset.latestTradePrice,
        marketPrice: fallbackAsset.marketPrice,
        portfolioBreakdown: asset.portfolioBreakdown.map((entry) => {
          const fallbackEntry = fallbackAsset.portfolioBreakdown.find(
            (candidate) => candidate.portfolioId === entry.portfolioId
          );

          if (!fallbackEntry) {
            return entry;
          }

          return {
            ...entry,
            netShares: fallbackEntry.netShares,
            remainingCostBasis: fallbackEntry.remainingCostBasis,
            avgBuyPrice: fallbackEntry.avgBuyPrice,
            positionValue: fallbackEntry.positionValue,
            unrealizedPnL: fallbackEntry.unrealizedPnL,
            totalDividendNet: fallbackEntry.totalDividendNet,
            latestTradePrice: fallbackEntry.latestTradePrice,
            marketPrice: fallbackEntry.marketPrice,
          };
        }),
      };
    });
    const dashboardSelection = selectCanonicalDashboardSafeFieldSource({
      runtimeFallbackAssets,
      productReadModel: projectedWithForcedValuationValues,
      guardEnabled: true,
    });
    const assetTableSelection = selectCanonicalAssetTableSafeFieldSource({
      runtimeFallbackAssets,
      productReadModel: projectedWithForcedValuationValues,
      guardEnabled: true,
    });

    expect(selectedRows[0]?.name).toBe("Guarded Product Asset");
    expect(selectedRows[0]?.portfolioBreakdown[0]?.portfolioName).toBe(
      "Guarded Portfolio One",
    );
    expect(selectedRows[0]?.positionValue).toBe(336);
    expect(selectedRows[0]?.unrealizedPnL).toBe(36);
    expect(selectedRows[0]?.netShares).toBe(3);
    expect(selectedRows[0]?.remainingCostBasis).toBe(300);
    expect(selectedRows[0]?.avgBuyPrice).toBe(100);
    expect(selectedRows[0]?.totalDividendNet).toBe(12);
    expect(selectedRows[0]?.portfolioBreakdown[0]?.positionValue).toBe(336);
    expect(selectedRows[0]?.portfolioBreakdown[0]?.unrealizedPnL).toBe(36);
    expect(selectedRows[0]?.portfolioBreakdown[0]?.netShares).toBe(3);
    expect(selectedRows[0]?.portfolioBreakdown[0]?.totalDividendNet).toBe(12);
    expect(dashboardSelection.selection.selectedSource).toBe("global_asset_product");
    expect(assetTableSelection.selection.selectedSource).toBe("global_asset_product");
    expect(dashboardSelection.selection.affectedFields).toContain("position_value");
    expect(dashboardSelection.selection.affectedFields).toContain("unrealized_pnl");
    expect(dashboardSelection.selection.affectedFields).toContain("remaining_cost_basis");
    expect(dashboardSelection.selection.affectedFields).toContain("avg_buy_price");
    expect(dashboardSelection.selection.affectedFields).toContain("net_shares");
    expect(dashboardSelection.selection.affectedFields).toContain("total_dividend_net");
  });

  it("keeps runtime fallback rows when product read model is empty", () => {
    const projected = buildProjectedProductReadModel();
    const runtimeFallbackAssets = createRuntimeFallbackAssetsFixture();
    const projectedWithoutAssets = {
      ...projected,
      assets: [],
    };
    const selection = selectCanonicalSafeFieldProductSurfaceSource({
      surface: "dashboard",
      runtimeFallbackAssets,
      productReadModel: projectedWithoutAssets,
      guardEnabled: true,
    });

    expect(selection.selectedSource).toBe("runtime_assets_fallback");
    expect(selection.reason).toBe("product_read_model_empty");
    expect(selection.diagnostics.runtimeFallbackAssetCount).toBe(2);
    expect(selection.diagnostics.productAssetCount).toBe(0);
  });
});

describe("reports canonical safe-field source integration", () => {
  it("uses canonical reports safe-field source by default when local coexistence cache is ready", () => {
    const projected = buildProjectedProductReadModel();
    const runtimeFallbackAssets = createRuntimeFallbackAssetsFixture();
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
        activeAssets: runtimeFallbackAssets.filter((asset) => asset.netShares > 0),
        closedAssets: runtimeFallbackAssets.filter((asset) => asset.netShares === 0),
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
    expect(report?.totals.totalPositionValue).toBeNull();
    expect(report?.totals.totalUnrealizedPnL).toBeNull();
  });

  it("falls back to runtime fallback report source when old cache has no global asset product model", () => {
    process.env.NEXT_PUBLIC_GLOBAL_ASSET_PRODUCT_GUARD_ENABLED = "true";
    const runtimeFallbackAssets = createRuntimeFallbackAssetsFixture();

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify({
        activeAssets: runtimeFallbackAssets.filter((asset) => asset.netShares > 0),
        closedAssets: runtimeFallbackAssets.filter((asset) => asset.netShares === 0),
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
    expect(report?.guardedSelection.selectedSource).toBe("runtime_assets_fallback");
    expect(report?.guardedSelection.reason).toBe("product_read_model_missing");
    expect(report?.assets.length).toBe(2);
    expect(report?.totals.totalPositionValue).toBe(336);
    expect(report?.totals.totalUnrealizedPnL).toBe(36);
  });

  it("falls back to runtime fallback report source when product read model is stale", () => {
    process.env.NEXT_PUBLIC_GLOBAL_ASSET_PRODUCT_GUARD_ENABLED = "true";
    const projected = buildProjectedProductReadModel();
    const runtimeFallbackAssets = createRuntimeFallbackAssetsFixture();

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify({
        activeAssets: runtimeFallbackAssets.filter((asset) => asset.netShares > 0),
        closedAssets: runtimeFallbackAssets.filter((asset) => asset.netShares === 0),
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
    expect(report?.guardedSelection.selectedSource).toBe("runtime_assets_fallback");
    expect(report?.guardedSelection.reason).toBe("product_read_model_not_fresh");
    expect(report?.assets.length).toBe(2);
    expect(report?.totals.totalPositionValue).toBe(336);
    expect(report?.totals.totalUnrealizedPnL).toBe(36);
  });

  it.each(["false", "off", "0"])(
    "supports rollback by forcing runtime fallback report source when guard flag is %s",
    (rawFlagValue) => {
      process.env.NEXT_PUBLIC_GLOBAL_ASSET_PRODUCT_GUARD_ENABLED = rawFlagValue;
      const projected = buildProjectedProductReadModel();
      const runtimeFallbackAssets = createRuntimeFallbackAssetsFixture();

      installWindowWithLocalStorage({
        [DASHBOARD_CACHE_KEY]: JSON.stringify({
          activeAssets: runtimeFallbackAssets.filter((asset) => asset.netShares > 0),
          closedAssets: runtimeFallbackAssets.filter((asset) => asset.netShares === 0),
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
      expect(report?.guardedSelection.selectedSource).toBe("runtime_assets_fallback");
      expect(report?.guardedSelection.reason).toBe("guard_disabled");
      expect(report?.totals.totalPositionValue).toBe(336);
      expect(report?.totals.totalUnrealizedPnL).toBe(36);
    },
  );
});
