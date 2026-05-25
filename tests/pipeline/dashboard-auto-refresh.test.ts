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
            hasPendingPortfolioSelection: false,
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
            hasPendingPortfolioSelection: false,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision).toEqual({
            shouldRefresh: true,
            reason: "missing_cache",
            executionKey: "missing_cache:p1",
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
            hasPendingPortfolioSelection: false,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision.reason).toBe("stale_cache");
        expect(decision.shouldRefresh).toBe(true);
    });

    it("returns true when portfolio scope changed", () => {
        const decision = shouldAutoRefreshDashboardData({
            loadingPortfolios: false,
            loadingAssets: false,
            refreshingAssets: false,
            hasPortfolios: true,
            selectedPortfolioIds: ["p2", "p1"],
            hasCachedData: true,
            isCacheStale: false,
            hasPendingPortfolioSelection: true,
            alreadyExecutedKeys: new Set<string>(),
        });

        expect(decision).toEqual({
            shouldRefresh: true,
            reason: "portfolio_scope_changed",
            executionKey: "portfolio_scope_changed:p1|p2",
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
            hasPendingPortfolioSelection: false,
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
            hasPendingPortfolioSelection: false,
            alreadyExecutedKeys: executedKeys,
        });

        expect(decision.shouldRefresh).toBe(false);
    });
});
