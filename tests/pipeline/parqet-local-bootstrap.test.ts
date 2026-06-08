import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadKnownPortfoliosMock = vi.fn();
const loadPortfolioScopeMock = vi.fn();
const resolvePortfolioScopeMock = vi.fn();
const saveKnownPortfoliosMock = vi.fn();
const savePortfolioScopeMock = vi.fn();
const loadDashboardCacheMock = vi.fn();
const persistDashboardCacheWriteMock = vi.fn();
const resolveGlobalAssetProductGuardEnabledMock = vi.fn(() => false);

vi.mock("../../src/lib/app-settings", () => ({
  loadKnownPortfolios: () => loadKnownPortfoliosMock(),
  loadPortfolioScope: () => loadPortfolioScopeMock(),
  resolvePortfolioScope: (...args: unknown[]) => resolvePortfolioScopeMock(...args),
  saveKnownPortfolios: (...args: unknown[]) => saveKnownPortfoliosMock(...args),
  savePortfolioScope: (...args: unknown[]) => savePortfolioScopeMock(...args),
}));

vi.mock("../../src/lib/dashboard-cache", () => ({
  loadDashboardCache: () => loadDashboardCacheMock(),
}));

vi.mock("../../src/lib/dashboard-cache-writer", () => ({
  persistDashboardCacheWrite: (...args: unknown[]) => persistDashboardCacheWriteMock(...args),
}));

vi.mock("../../src/lib/dashboard-helpers", () => ({
  resolveGlobalAssetProductGuardEnabled: () => resolveGlobalAssetProductGuardEnabledMock(),
}));

import {
  buildParqetBootstrapAssetsUrl,
  ensureParqetLocalBootstrap,
  resolveParqetBootstrapScope,
} from "../../src/lib/parqet-local-bootstrap";

describe("parqet local bootstrap", () => {
  beforeEach(() => {
    loadKnownPortfoliosMock.mockReset();
    loadPortfolioScopeMock.mockReset();
    resolvePortfolioScopeMock.mockReset();
    saveKnownPortfoliosMock.mockReset();
    savePortfolioScopeMock.mockReset();
    loadDashboardCacheMock.mockReset();
    persistDashboardCacheWriteMock.mockReset();
    resolveGlobalAssetProductGuardEnabledMock.mockReset();
    resolveGlobalAssetProductGuardEnabledMock.mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(globalThis, "window", {
      value: {},
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("builds bootstrap asset urls with optional refresh", () => {
    expect(buildParqetBootstrapAssetsUrl(["p1"])).toBe("/api/parqet/assets?portfolioId=p1");
    expect(buildParqetBootstrapAssetsUrl(["p1"], true)).toBe("/api/parqet/assets?portfolioId=p1&refresh=1");
  });

  it("resolves scope from known portfolios before cached ids", () => {
    loadPortfolioScopeMock.mockReturnValue({ mode: "all", selectedPortfolioIds: [] });
    resolvePortfolioScopeMock.mockReturnValue({
      scope: { mode: "all", selectedPortfolioIds: [] },
      selectedPortfolioIds: ["p1"],
      missingPortfolioIds: [],
      usedFallback: false,
      hasEmptyManualIntersection: false,
    });

    const selectedIds = resolveParqetBootstrapScope({
      knownPortfolios: [{ id: "p1", name: "Portfolio 1" }],
      cachedSelectedPortfolioIds: ["cached"],
    });

    expect(selectedIds).toEqual(["p1"]);
  });

  it("uses local snapshot assets first and avoids provider portfolios when known portfolios exist", async () => {
    loadDashboardCacheMock.mockReturnValue(null);
    loadKnownPortfoliosMock.mockReturnValue([{ id: "p1", name: "Portfolio 1" }]);
    loadPortfolioScopeMock.mockReturnValue({ mode: "all", selectedPortfolioIds: [] });
    resolvePortfolioScopeMock.mockReturnValue({
      scope: { mode: "all", selectedPortfolioIds: [] },
      selectedPortfolioIds: ["p1"],
      missingPortfolioIds: [],
      usedFallback: false,
      hasEmptyManualIntersection: false,
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => JSON.stringify({
        ok: true,
        activityItems: [{ id: "a1" }],
        activeAssets: [],
        closedAssets: [],
        freshness: { present: true },
      }),
    } as Response);

    await expect(ensureParqetLocalBootstrap()).resolves.toBe("bootstrapped");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/parqet/assets?portfolioId=p1");
  });

  it("falls back to a provider bootstrap when no local portfolios exist", async () => {
    loadDashboardCacheMock.mockReturnValue(null);
    loadKnownPortfoliosMock.mockReturnValue([]);
    loadPortfolioScopeMock.mockReturnValue({ mode: "all", selectedPortfolioIds: [] });
    resolvePortfolioScopeMock.mockReturnValue({
      scope: { mode: "all", selectedPortfolioIds: [] },
      selectedPortfolioIds: ["p9"],
      missingPortfolioIds: [],
      usedFallback: false,
      hasEmptyManualIntersection: false,
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({
          ok: true,
          portfolios: { items: [{ id: "p9", name: "Portfolio 9" }] },
        }),
      } as Response)
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({
          ok: true,
          activityItems: [{ id: "a9" }],
          activeAssets: [],
          closedAssets: [],
          freshness: { present: true },
        }),
      } as Response);

    await expect(ensureParqetLocalBootstrap()).resolves.toBe("bootstrapped");

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/parqet/portfolios");
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/parqet/assets?portfolioId=p9&refresh=1");
  });

  it("escalates from snapshot-only load to provider refresh when known portfolios exist but no snapshot is present", async () => {
    loadDashboardCacheMock.mockReturnValue(null);
    loadKnownPortfoliosMock.mockReturnValue([{ id: "p1", name: "Portfolio 1" }]);
    loadPortfolioScopeMock.mockReturnValue({ mode: "all", selectedPortfolioIds: [] });
    resolvePortfolioScopeMock.mockReturnValue({
      scope: { mode: "all", selectedPortfolioIds: [] },
      selectedPortfolioIds: ["p1"],
      missingPortfolioIds: [],
      usedFallback: false,
      hasEmptyManualIntersection: false,
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({
          ok: true,
          activityItems: [],
          activeAssets: [],
          closedAssets: [],
          freshness: { present: false },
        }),
      } as Response)
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({
          ok: true,
          activityItems: [{ id: "a1" }],
          activeAssets: [],
          closedAssets: [],
          freshness: { present: true },
        }),
      } as Response);

    await expect(ensureParqetLocalBootstrap()).resolves.toBe("bootstrapped");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/parqet/assets?portfolioId=p1");
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/parqet/assets?portfolioId=p1&refresh=1");
    expect(fetch).not.toHaveBeenCalledWith("/api/parqet/portfolios");
  });
});
