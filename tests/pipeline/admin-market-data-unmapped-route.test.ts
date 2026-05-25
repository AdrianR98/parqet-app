import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/market-data/db/admin-unmapped", () => ({
    getAdminUnmappedMarketData: vi.fn(),
}));

import { getAdminUnmappedMarketData } from "../../src/lib/market-data/db/admin-unmapped";
import { GET } from "../../src/app/api/admin/market-data/unmapped/route";

describe("admin market data unmapped route", () => {
    const originalAdminEnabled = process.env.ADMIN_ENABLED;

    afterEach(() => {
        process.env.ADMIN_ENABLED = originalAdminEnabled;
        vi.resetAllMocks();
    });

    it("denies details when admin is disabled", async () => {
        process.env.ADMIN_ENABLED = "false";

        const response = await GET(new Request("http://localhost/api/admin/market-data/unmapped"));
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload).toEqual({ error: "Unauthorized" });
        expect(getAdminUnmappedMarketData).not.toHaveBeenCalled();
    });

    it("returns bounded payload when admin is enabled", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminUnmappedMarketData).mockResolvedValue({
            totalOpen: 1,
            shown: 1,
            actionableTotal: 1,
            actionableShown: 1,
            classifiedTotal: 0,
            classifiedShown: 0,
            limit: 50,
            filters: { category: null, action: null, status: null },
            items: [
                {
                    priority: 10,
                    isin: "US0000000001",
                    displayName: "Sample",
                    assetType: "stock",
                    currency: "USD",
                    wkn: null,
                    marketDataStatus: null,
                    mappingStatus: "no_mapping",
                    primarySymbol: null,
                    candidateSymbols: [],
                    category: "mapping_candidate_needed",
                    suggestedAction: "add_candidates",
                    statusReason: null,
                    triageHint: "No mapping exists yet; add or import candidate symbols.",
                    triageReason: "no yfinance mapping",
                    hasPriceData: false,
                    hasMarketActions: false,
                },
            ],
            actionableItems: [
                {
                    priority: 10,
                    isin: "US0000000001",
                    displayName: "Sample",
                    assetType: "stock",
                    currency: "USD",
                    wkn: null,
                    marketDataStatus: null,
                    mappingStatus: "no_mapping",
                    primarySymbol: null,
                    candidateSymbols: [],
                    category: "mapping_candidate_needed",
                    suggestedAction: "add_candidates",
                    statusReason: null,
                    triageHint: "No mapping exists yet; add or import candidate symbols.",
                    triageReason: "no yfinance mapping",
                    hasPriceData: false,
                    hasMarketActions: false,
                },
            ],
            classifiedItems: [],
        });

        const response = await GET(new Request("http://localhost/api/admin/market-data/unmapped?limit=50"));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload.shown).toBe(1);
        expect(payload.actionableTotal).toBe(1);
        expect(payload.classifiedTotal).toBe(0);
        expect(getAdminUnmappedMarketData).toHaveBeenCalledWith({
            limit: "50",
            category: null,
            action: null,
            status: null,
        });
    });

    it("returns safe generic error on helper failure", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminUnmappedMarketData).mockRejectedValue(new Error("db down"));

        const response = await GET(new Request("http://localhost/api/admin/market-data/unmapped"));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload).toEqual({ error: "Market data unmapped list unavailable." });
    });
});
