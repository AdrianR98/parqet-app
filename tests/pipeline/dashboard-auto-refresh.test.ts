import { describe, expect, it } from "vitest";
import { shouldAutoRefreshDashboardData } from "../../src/lib/dashboard-auto-refresh";

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
            shouldRefresh: false,
            reason: null,
            executionKey: null,
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
});
