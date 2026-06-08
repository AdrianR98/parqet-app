import { describe, expect, it } from "vitest";
import { shouldAutoRefreshDashboardData } from "../../src/lib/dashboard-auto-refresh";
import {
  buildDashboardAssetRequestKey,
  buildDashboardAssetsUrl,
  getOrCreateSharedDashboardRequest,
  resolveDashboardBootPolicy,
} from "../../src/hooks/use-dashboard-data";

describe("shouldAutoRefreshDashboardData", () => {
    it("returns false while portfolios are loading", () => {
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: true,
            loadingAssets: false,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: ["p1"],
            hasCachedData: false,
            isCacheStale: false,
            hasPortfoliosMissingFromCache: false,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision.shouldRefresh).toBe(false);
    });

    it("returns true for missing cache after portfolio load", () => {
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: false,
            loadingAssets: false,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: ["p1"],
            hasCachedData: false,
            isCacheStale: false,
            hasPortfoliosMissingFromCache: false,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision).toEqual({
            shouldRefresh: true,
            reason: "missing_cache",
            executionKey: "missing_cache:p1",
        });
    });

    it("defers refresh when selected portfolio ids are not resolved yet", () => {
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: false,
            loadingAssets: false,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: [],
            hasCachedData: false,
            isCacheStale: false,
            hasPortfoliosMissingFromCache: false,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision).toEqual({
            shouldRefresh: false,
            reason: null,
            executionKey: null,
        });
    });

    it("allows refresh when selected ids become available after defer", () => {
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: false,
            loadingAssets: false,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: ["p42"],
            hasCachedData: false,
            isCacheStale: false,
            hasPortfoliosMissingFromCache: false,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision).toEqual({
            shouldRefresh: true,
            reason: "missing_cache",
            executionKey: "missing_cache:p42",
        });
    });

    it("returns true for stale cache", () => {
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: false,
            loadingAssets: false,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: ["p2"],
            hasCachedData: true,
            isCacheStale: true,
            hasPortfoliosMissingFromCache: false,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision.reason).toBe("stale_cache");
        expect(decision.shouldRefresh).toBe(true);
    });

    it("returns true only when selected portfolios are missing from cache", () => {
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: false,
            loadingAssets: false,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: ["p2", "p1"],
            hasCachedData: true,
            isCacheStale: false,
            hasPortfoliosMissingFromCache: true,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision).toEqual({
            shouldRefresh: true,
            reason: "portfolios_missing_from_cache",
            executionKey: "portfolios_missing_from_cache:p1|p2",
        });
    });

    it("does not refresh when portfolio selection changes within loaded cache scope", () => {
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: false,
            loadingAssets: false,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: ["p2", "p1"],
            hasCachedData: true,
            isCacheStale: false,
            hasPortfoliosMissingFromCache: false,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision).toEqual({
            shouldRefresh: true,
            reason: "cached_revalidate",
            executionKey: "cached_revalidate:p1|p2",
        });
    });

    it("returns false when a request is already in flight", () => {
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: false,
            loadingAssets: true,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: ["p1"],
            hasCachedData: false,
            isCacheStale: false,
            hasPortfoliosMissingFromCache: false,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision.shouldRefresh).toBe(false);
    });

    it("returns false for already executed refresh key", () => {
        const executedKeys = new Set<string>(["missing_cache:p1"]);
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: false,
            loadingAssets: false,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: ["p1"],
            hasCachedData: false,
            isCacheStale: false,
            hasPortfoliosMissingFromCache: false,
            alreadyExecutedKeys: executedKeys,
        });

        expect(decision.shouldRefresh).toBe(false);
    });

    it("revalidates cached data once per reload even when the cache is not stale", () => {
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: false,
            loadingAssets: false,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: ["p7"],
            hasCachedData: true,
            isCacheStale: false,
            hasPortfoliosMissingFromCache: false,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision).toEqual({
            shouldRefresh: true,
            reason: "cached_revalidate",
            executionKey: "cached_revalidate:p7",
        });
    });

    it("builds one shared request key for the same portfolio scope", () => {
        expect(buildDashboardAssetRequestKey(["p2", "p1"])).toBe("assets:p1|p2");
        expect(buildDashboardAssetRequestKey(["p1", "p2"], true)).toBe("assets:refresh:p1|p2");
    });

    it("builds the internal assets url without refresh=1 during normal reloads", () => {
        expect(buildDashboardAssetsUrl(["p2", "p1"])).toBe("/api/parqet/assets?portfolioId=p2&portfolioId=p1");
        expect(buildDashboardAssetsUrl(["p2", "p1"], true)).toBe("/api/parqet/assets?portfolioId=p2&portfolioId=p1&refresh=1");
    });

    it("keeps provider portfolio fetch disabled when known local portfolios exist", () => {
        expect(resolveDashboardBootPolicy({
            knownPortfolios: [{ id: "p1", name: "Portfolio 1" }],
            cachedSelectedPortfolioIds: ["p1"],
            hasCachedDashboardData: true,
        })).toEqual({
            bootPolicy: "local_known_portfolios",
            shouldFetchProviderPortfolios: false,
        });
    });

    it("keeps provider portfolio fetch disabled when only cached scope exists", () => {
        expect(resolveDashboardBootPolicy({
            knownPortfolios: [],
            cachedSelectedPortfolioIds: ["p1"],
            hasCachedDashboardData: true,
        })).toEqual({
            bootPolicy: "local_cache_only",
            shouldFetchProviderPortfolios: false,
        });
    });

    it("keeps provider portfolio fetch disabled when no local bootstrap exists", () => {
        expect(resolveDashboardBootPolicy({
            knownPortfolios: [],
            cachedSelectedPortfolioIds: [],
            hasCachedDashboardData: false,
        })).toEqual({
            bootPolicy: "no_local_bootstrap",
            shouldFetchProviderPortfolios: false,
        });
    });

    it("reuses the same in-flight request promise for duplicate scope loads", async () => {
        const registry = new Map<string, Promise<unknown>>();
        let createCount = 0;

        const first = getOrCreateSharedDashboardRequest(
            registry,
            "assets:p1",
            async () => {
                createCount += 1;
                return "done";
            },
        );
        const second = getOrCreateSharedDashboardRequest(
            registry,
            "assets:p1",
            async () => {
                createCount += 1;
                return "other";
            },
        );

        expect(first).toBe(second);
        await expect(first).resolves.toBe("done");
        expect(createCount).toBe(1);
        expect(registry.has("assets:p1")).toBe(false);
    });
});
