import { describe, expect, it } from "vitest";

import {
    canConsumeQuota,
    consumeQuota,
    DAILY_PROVIDER_LIMIT,
    getCacheKey,
    getQuotaInfo,
    resetMarketDataInMemoryStateForTests,
} from "../../src/lib/market-data/cache";
import { classifyAlphaVantagePayload, parseDailySeries } from "../../src/lib/market-data/alpha-vantage-parser";
import { buildCacheMissResponse } from "../../src/lib/market-data/service-core";
import { normalizeIsin } from "../../src/lib/market-data/symbol-mapping";

describe("market-data symbol mapping", () => {
    it("normalizes isin to uppercase without spaces", () => {
        expect(normalizeIsin(" ie00 b8gk db10 ")).toBe("IE00B8GKDB10");
    });
});

describe("market-data quota guard", () => {
    it("limits provider requests to safety daily limit", () => {
        resetMarketDataInMemoryStateForTests();

        const key = getCacheKey({ provider: "alphavantage", isin: "IE00B8GKDB10", symbol: "VHYL.LON" });
        expect(key).toBe("alphavantage:VHYL.LON:IE00B8GKDB10");

        for (let index = 0; index < DAILY_PROVIDER_LIMIT; index += 1) {
            expect(canConsumeQuota("alphavantage")).toBe(true);
            consumeQuota("alphavantage");
        }

        expect(canConsumeQuota("alphavantage")).toBe(false);

        const quota = getQuotaInfo("alphavantage");
        expect(quota.dailyLimit).toBe(DAILY_PROVIDER_LIMIT);
        expect(quota.usedToday).toBe(DAILY_PROVIDER_LIMIT);
        expect(quota.remainingToday).toBe(0);
    });
});

describe("alpha-vantage parser fixtures", () => {
    it("parses TIME_SERIES_DAILY with 2 rows", () => {
        const fixture = {
            "Time Series (Daily)": {
                "2026-05-22": {
                    "1. open": "100.00",
                    "2. high": "105.00",
                    "3. low": "99.00",
                    "4. close": "103.50",
                    "5. volume": "1200000",
                },
                "2026-05-21": {
                    "1. open": "98.00",
                    "2. high": "101.00",
                    "3. low": "97.00",
                    "4. close": "100.10",
                    "5. volume": "900000",
                },
            },
        };

        const result = parseDailySeries(fixture);
        expect(result.shape).toBe("daily");
        expect(result.points).toHaveLength(2);
        expect(result.points[0].date).toBe("2026-05-21");
        expect(result.points[1].date).toBe("2026-05-22");
    });

    it("parses TIME_SERIES_DAILY_ADJUSTED with 2 rows", () => {
        const fixture = {
            "Time Series (Daily Adjusted)": {
                "2026-05-22": {
                    "1. open": "200.00",
                    "2. high": "205.00",
                    "3. low": "199.00",
                    "4. close": "203.50",
                    "6. volume": "500000",
                },
                "2026-05-21": {
                    "1. open": "198.00",
                    "2. high": "201.00",
                    "3. low": "197.00",
                    "4. close": "200.10",
                    "6. volume": "450000",
                },
            },
        };

        const result = parseDailySeries(fixture);
        expect(result.shape).toBe("daily_adjusted");
        expect(result.points).toHaveLength(2);
        expect(result.points[0].date).toBe("2026-05-21");
        expect(result.points[1].date).toBe("2026-05-22");
    });

    it("maps Note response to rate_limited", () => {
        const result = classifyAlphaVantagePayload({ Note: "Thank you for using Alpha Vantage! Our standard API call frequency is 25 calls per day." }, "AAPL");
        expect(result?.ok).toBe(false);
        if (!result || result.ok) throw new Error("Expected provider error result");
        expect(result.status).toBe("rate_limited");
        expect(result.diagnostics.detectedResponseShape).toBe("note");
    });

    it("maps Information limit response to rate_limited", () => {
        const result = classifyAlphaVantagePayload({ Information: "API call frequency limit reached." }, "AAPL");
        expect(result?.ok).toBe(false);
        if (!result || result.ok) throw new Error("Expected provider error result");
        expect(result.status).toBe("rate_limited");
        expect(result.diagnostics.detectedResponseShape).toBe("information");
    });

    it("maps Error Message invalid symbol to not_found", () => {
        const result = classifyAlphaVantagePayload({ "Error Message": "Invalid API call. Please retry or visit the documentation for SYMBOL." }, "AAPLX");
        expect(result?.ok).toBe(false);
        if (!result || result.ok) throw new Error("Expected provider error result");
        expect(result.status).toBe("not_found");
        expect(result.diagnostics.detectedResponseShape).toBe("error_message");
    });
});

describe("market-data service cache-miss semantics", () => {
    it("returns cache_miss without quota consumption when refresh is disabled", () => {
        resetMarketDataInMemoryStateForTests();

        const before = getQuotaInfo("alphavantage").usedToday;
        const result = buildCacheMissResponse({ provider: "alphavantage", symbol: "AAPL" });
        const after = getQuotaInfo("alphavantage").usedToday;

        expect(result.ok).toBe(false);
        expect(result.status).toBe("cache_miss");
        expect(result.diagnostics?.providerStatusCategory).toBe("not_requested");
        expect(result.diagnostics?.detectedResponseShape).toBe("none");
        expect(after).toBe(before);
    });
});
