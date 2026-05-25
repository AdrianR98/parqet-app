import { afterEach, describe, expect, it } from "vitest";

import {
  DASHBOARD_CACHE_KEY,
  loadDashboardCache,
  saveDashboardCache,
  type DashboardCache,
} from "../../src/lib/dashboard-cache";
import {
  KNOWN_PORTFOLIOS_STORAGE_KEY,
  loadKnownPortfolios,
} from "../../src/lib/app-settings";
import { LOCAL_STORAGE_LIMITS } from "../../src/lib/local-storage-guards";

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

function installWindowWithLocalStorage(seed?: Record<string, string>): LocalStorageMock {
  const localStorage = createLocalStorageMock(seed);

  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage,
    },
    configurable: true,
    writable: true,
  });

  return localStorage;
}

function createCache(overrides?: Partial<DashboardCache>): DashboardCache {
  return {
    activeAssets: [
      {
        isin: "DEMO00000011",
        portfolioIds: ["portfolio_1"],
        portfolioNames: ["Portfolio 1"],
        portfolioBreakdown: [],
        activityCount: 1,
        buyCount: 1,
        sellCount: 0,
        dividendCount: 0,
        totalBoughtShares: 1,
        totalSoldShares: 0,
        netShares: 1,
        totalInvestedGross: 100,
        remainingCostBasis: 100,
        avgBuyPrice: 100,
        latestTradePrice: 100,
        marketPrice: 100,
        marketPriceAt: null,
        marketPriceSource: null,
        positionValue: 100,
        unrealizedPnL: 0,
        totalDividendNet: 0,
        latestActivityAt: null,
      },
    ],
    closedAssets: [],
    rawActivityCount: 1,
    filteredActivityCount: 1,
    assetCount: 1,
    activeAssetCount: 1,
    closedAssetCount: 0,
    consistencyReport: null,
    reconciliationWarnings: [],
    generatedAt: "2026-05-25T00:00:00.000Z",
    lastUpdatedAt: "2026-05-25T00:00:00.000Z",
    selectedPortfolioIds: ["portfolio_1"],
    ...overrides,
  };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("dashboard cache hardening", () => {
  it("returns null and removes cache for oversized raw payload before JSON.parse", () => {
    const oversized = "x".repeat(LOCAL_STORAGE_LIMITS.maxRawPayloadChars + 1);
    const localStorage = installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: oversized,
    });

    const loaded = loadDashboardCache();

    expect(loaded).toBeNull();
    expect(localStorage.getItem(DASHBOARD_CACHE_KEY)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: "{broken-json",
    });

    expect(loadDashboardCache()).toBeNull();
  });

  it("caps asset arrays and truncates oversized strings", () => {
    const baseAsset = createCache().activeAssets[0];
    const activeAssets = Array.from({ length: LOCAL_STORAGE_LIMITS.maxAssets + 500 }, (_, index) => ({
      ...baseAsset,
      isin: `DEMO${String(index).padStart(8, "0")}`,
      name: index === 0
        ? "A".repeat(LOCAL_STORAGE_LIMITS.maxDisplayTextChars + 50)
        : "Demo",
      portfolioBreakdown: index === 0
        ? Array.from(
            { length: LOCAL_STORAGE_LIMITS.maxPortfolioBreakdownRowsPerAsset + 20 },
            () => ({ portfolioId: "p1", portfolioName: "Portfolio", netShares: 1 }),
          )
        : [],
    }));

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify(createCache({ activeAssets })),
    });

    const loaded = loadDashboardCache();

    expect(loaded).not.toBeNull();
    expect((loaded?.activeAssets.length ?? 0) + (loaded?.closedAssets.length ?? 0)).toBe(
      LOCAL_STORAGE_LIMITS.maxAssets,
    );
    expect(loaded?.activeAssets[0]?.name?.length).toBe(
      LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
    );
    expect(loaded?.activeAssets[0]?.portfolioBreakdown.length).toBe(
      LOCAL_STORAGE_LIMITS.maxPortfolioBreakdownRowsPerAsset,
    );
  });

  it("keeps valid cache payloads compatible", () => {
    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify(createCache()),
    });

    const loaded = loadDashboardCache();
    expect(loaded).not.toBeNull();
    expect(loaded?.assetCount).toBe(1);
    expect(loaded?.activeAssets[0]?.isin).toBe("DEMO00000011");
  });

  it("sanitizes nested metadata and instrument fields and drops unknown fields", () => {
    const oversizedDisplayName = "D".repeat(LOCAL_STORAGE_LIMITS.maxDisplayTextChars + 50);
    const oversizedPortfolioName = "P".repeat(LOCAL_STORAGE_LIMITS.maxPortfolioNameChars + 50);
    const seededCache = createCache({
      activeAssets: [
        {
          ...createCache().activeAssets[0],
          portfolioBreakdown: [
            {
              portfolioId: "portfolio_1",
              portfolioName: oversizedPortfolioName,
              netShares: 1,
              remainingCostBasis: 100,
              avgBuyPrice: 100,
              latestTradePrice: 100,
              marketPrice: 100,
              positionValue: 100,
              unrealizedPnL: 0,
              totalDividendNet: 0,
              unknown: "drop-me",
            } as unknown as DashboardCache["activeAssets"][number]["portfolioBreakdown"][number],
          ],
          metadata: {
            displayName: oversizedDisplayName,
            logoUrl: "https://example.com/logo.png",
            injected: "drop-me",
          } as unknown as DashboardCache["activeAssets"][number]["metadata"],
          instrument: {
            isin: "DEMO00000011",
            displayName: oversizedDisplayName,
            name: "Demo",
            wkn: "WKN",
            assetType: "equity",
            currency: "EUR",
            metadataStatus: "ok",
            metadataError: null,
            marketDataStatus: "active",
            marketDataStatusReason: null,
            marketDataSuccessorIsin: null,
            marketDataSuccessorSymbol: null,
            primaryMapping: {
              provider: "demo",
              symbol: "DMO",
              exchange: "XETRA",
              currency: "EUR",
              verifiedAt: "2026-05-25T00:00:00.000Z",
              isPrimary: true,
              isActive: true,
              injected: "drop-me",
            },
            injected: "drop-me",
          } as unknown as DashboardCache["activeAssets"][number]["instrument"],
        },
      ],
    });

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify(seededCache),
    });

    const loaded = loadDashboardCache();
    const firstAsset = loaded?.activeAssets[0];

    expect(firstAsset?.metadata?.displayName?.length).toBe(
      LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
    );
    expect(firstAsset?.instrument?.displayName?.length).toBe(
      LOCAL_STORAGE_LIMITS.maxDisplayTextChars,
    );
    expect(firstAsset?.portfolioBreakdown[0]?.portfolioName.length).toBe(
      LOCAL_STORAGE_LIMITS.maxPortfolioNameChars,
    );
    expect("injected" in (firstAsset?.metadata ?? {})).toBe(false);
    expect("injected" in (firstAsset?.instrument ?? {})).toBe(false);
    expect("unknown" in (firstAsset?.portfolioBreakdown[0] ?? {})).toBe(false);
  });

  it("drops oversized globalAssetProductReadModel and invalid guardedSourceSelection", () => {
    const oversizedProductAssets = Array.from(
      { length: LOCAL_STORAGE_LIMITS.maxAssets + 1 },
      () => ({ blockedMetrics: [] }),
    );
    const seededCache = createCache({
      globalAssetProductReadModel: {
        metadata: { readModelId: "rm-1" },
        assets: oversizedProductAssets,
        summary: {},
      } as unknown as DashboardCache["globalAssetProductReadModel"],
      guardedSourceSelection: {
        selectedSource: "invalid-source",
        reason: "invalid-reason",
        blockedMetrics: [],
        fallbackFields: [],
      } as unknown as DashboardCache["guardedSourceSelection"],
    });

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify(seededCache),
    });

    const loaded = loadDashboardCache();
    expect(loaded?.globalAssetProductReadModel).toBeNull();
    expect(loaded?.guardedSourceSelection).toBeNull();
  });

  it("does not persist oversized serialized payload on write", () => {
    const localStorage = installWindowWithLocalStorage();
    const hugeWarnings = Array.from({ length: LOCAL_STORAGE_LIMITS.maxWarnings }, () => ({
      isin: "DEMO00000011",
      severity: "warning" as const,
      message: "B".repeat(LOCAL_STORAGE_LIMITS.maxWarningMessageChars),
    }));
    const hugeActivityItems = Array.from(
      { length: LOCAL_STORAGE_LIMITS.maxActivities },
      (_, index) => ({
        id: `activity-${index}`,
        datetime: "2026-05-25T00:00:00.000Z",
        year: 2026,
        monthKey: "2026-05",
        monthLabel: "May 2026",
        portfolioId: "portfolio_1",
        portfolioName: "Portfolio 1",
        isin: "DEMO00000011",
        name: "Demo",
        symbol: "DMO",
        wkn: "WKN1",
        type: "buy" as const,
        rawType: "buy",
        shares: 1,
        price: 1,
        amount: 1,
        amountNet: 1,
        warningMessages: ["x"],
      }),
    );

    saveDashboardCache(
      createCache({
        reconciliationWarnings: hugeWarnings,
        activityItems: hugeActivityItems,
      }),
    );

    expect(localStorage.getItem(DASHBOARD_CACHE_KEY)).toBeNull();
  });

  it("drops non-string known-portfolio optional fields from localStorage values", () => {
    installWindowWithLocalStorage({
      [KNOWN_PORTFOLIOS_STORAGE_KEY]: JSON.stringify([
        {
          id: "portfolio_1",
          name: "Portfolio 1",
          currency: 42,
          createdAt: { bad: "type" },
          distinctBrokers: ["A", 7],
        },
      ]),
    });

    const portfolios = loadKnownPortfolios();
    expect(portfolios).toHaveLength(1);
    expect(portfolios[0]?.currency).toBe("");
    expect(portfolios[0]?.createdAt).toBe("");
    expect(portfolios[0]?.distinctBrokers).toEqual(["A"]);
  });
});
