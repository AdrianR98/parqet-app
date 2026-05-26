import { describe, expect, it } from "vitest";

import {
    canConsumeQuota,
    consumeQuota,
    DAILY_PROVIDER_LIMIT,
    getCacheKey,
    getQuotaInfo,
    resetMarketDataInMemoryStateForTests,
} from "../../src/lib/market-data/cache";
import { buildCacheMissResponse } from "../../src/lib/market-data/service-core";
import { downsampleHistoryPoints, isHistoryPeriod, isStrictIsoDate, resolveFromDateForPeriod } from "../../src/lib/market-data/history-utils";
import { normalizeIsin } from "../../src/lib/market-data/symbol-mapping";

describe("market-data symbol mapping", () => {
    it("normalizes isin to uppercase without spaces", () => {
        expect(normalizeIsin(" ie00 b8gk db10 ")).toBe("IE00B8GKDB10");
    });
});

describe("market-data quota guard", () => {
    it("limits provider requests to safety daily limit", () => {
        resetMarketDataInMemoryStateForTests();

        const key = getCacheKey({ provider: "yfinance", isin: "IE00B8GKDB10", symbol: "VHYL.LON" });
        expect(key).toBe("yfinance:VHYL.LON:IE00B8GKDB10");

        for (let index = 0; index < DAILY_PROVIDER_LIMIT; index += 1) {
            expect(canConsumeQuota("yfinance")).toBe(true);
            consumeQuota("yfinance");
        }

        expect(canConsumeQuota("yfinance")).toBe(false);

        const quota = getQuotaInfo("yfinance");
        expect(quota.dailyLimit).toBe(DAILY_PROVIDER_LIMIT);
        expect(quota.usedToday).toBe(DAILY_PROVIDER_LIMIT);
        expect(quota.remainingToday).toBe(0);
    });
});

describe("market-data service cache-miss semantics", () => {
    it("returns cache_miss without quota consumption when refresh is disabled", () => {
        resetMarketDataInMemoryStateForTests();

        const before = getQuotaInfo("yfinance").usedToday;
        const result = buildCacheMissResponse({ provider: "yfinance", symbol: "AAPL" });
        const after = getQuotaInfo("yfinance").usedToday;

        expect(result.ok).toBe(false);
        expect(result.status).toBe("cache_miss");
        expect(result.diagnostics?.providerStatusCategory).toBe("not_requested");
        expect(result.diagnostics?.detectedResponseShape).toBe("none");
        expect(after).toBe(before);
    });
});

describe("market-data history helpers", () => {
    it("validates supported period values", () => {
        expect(isHistoryPeriod("1Y")).toBe(true);
        expect(isHistoryPeriod("MAX")).toBe(true);
        expect(isHistoryPeriod("BAD")).toBe(false);
    });

    it("validates strict YYYY-MM-DD dates", () => {
        expect(isStrictIsoDate("2026-05-25")).toBe(true);
        expect(isStrictIsoDate("2026-2-5")).toBe(false);
        expect(isStrictIsoDate("2026-02-30")).toBe(false);
    });

    it("computes period start from latest available db date", () => {
        expect(resolveFromDateForPeriod({ requestedPeriod: "1Y", latestPriceDate: "2026-05-25" })).toBe("2025-05-25");
        expect(resolveFromDateForPeriod({ requestedPeriod: "MAX", latestPriceDate: "2026-05-25" })).toBeNull();
    });

    it("downsamples deterministically and preserves boundaries", () => {
        const points = Array.from({ length: 2000 }, (_, idx) => ({
            provider: "yfinance",
            symbol: "AAPL",
            date: `2020-01-${String((idx % 28) + 1).padStart(2, "0")}`,
            open: null,
            high: null,
            low: null,
            close: idx + 1,
            adjClose: null,
            volume: null,
            currency: "USD",
            source: "postgres",
            importedAt: "2026-05-25T00:00:00.000Z",
        }));

        const result = downsampleHistoryPoints(points, 1200);
        expect(result.downsampled).toBe(true);
        expect(result.pointCountRaw).toBe(2000);
        expect(result.pointCountReturned).toBe(1200);
        expect(result.points[0]?.close).toBe(1);
        expect(result.points[result.points.length - 1]?.close).toBe(2000);
    });
});
