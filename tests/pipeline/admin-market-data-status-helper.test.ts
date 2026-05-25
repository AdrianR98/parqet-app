import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/market-data/db/repository", () => ({
    getMarketDataStatusSummary: vi.fn(),
    listMarketInstrumentStatusSummary: vi.fn(),
    listReferenceSourceCounts: vi.fn(),
}));

import {
    getMarketDataStatusSummary,
    listMarketInstrumentStatusSummary,
    listReferenceSourceCounts,
} from "../../src/lib/market-data/db/repository";
import { getAdminMarketDataStatus } from "../../src/lib/market-data/db/admin-status";

describe("admin market data status helper", () => {
    it("returns compact status payload with mapped fields", async () => {
        vi.mocked(getMarketDataStatusSummary).mockResolvedValue({
            instrumentsTotal: 10,
            mappingsTotal: 20,
            yfinanceMappingsTotal: 15,
            verifiedYfinanceMappings: 11,
            primaryYfinanceMappings: 9,
            instrumentsWithVerifiedYfinance: 8,
            instrumentsWithoutAnyMapping: 2,
            instrumentsWithMappingButNoVerifiedYfinance: 3,
            instrumentsWithPrimaryYfinance: 7,
            instrumentsWithoutPrimaryYfinance: 3,
            instrumentsWithDailyPrices: 6,
            instrumentsWithActions: 5,
            instrumentsWithPrimaryButNoPrices: 1,
            failedValidationCandidates: 4,
            instrumentsStatusExcluded: 1,
            instrumentsStatusLegacy: 1,
            instrumentsStatusDerivative: 0,
            instrumentsStatusUnknown: 2,
        });
        vi.mocked(listMarketInstrumentStatusSummary).mockResolvedValue([
            { status: "active", count: 6 },
            { status: "excluded", count: 1 },
            { status: null, count: 3 },
        ]);
        vi.mocked(listReferenceSourceCounts).mockResolvedValue([{ sourceKey: "xetra", rowCount: 123 }]);

        const payload = await getAdminMarketDataStatus();

        expect(payload).toMatchObject({
            instrumentsTotal: 10,
            mappingsTotal: 20,
            yfinanceMappingsTotal: 15,
            verifiedYfinanceMappings: 11,
            primaryYfinanceMappings: 9,
            instrumentsWithVerifiedYfinanceMapping: 8,
            instrumentsWithoutAnyMapping: 2,
            instrumentsWithMappingButNoVerifiedMapping: 3,
            instrumentsWithoutPrimaryMapping: 3,
            instrumentsWithDailyPriceData: 6,
            instrumentsWithMarketActions: 5,
            instrumentsWithPrimaryMappingButNoPriceData: 1,
            failedValidationCandidates: 4,
            marketDataStatusCounts: {
                active: 6,
                excluded: 1,
                unset: 3,
            },
            referenceSourceCounts: [{ sourceKey: "xetra", rowCount: 123 }],
        });
    });
});
