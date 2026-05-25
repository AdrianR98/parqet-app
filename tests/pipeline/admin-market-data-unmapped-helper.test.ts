import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/market-data/db/repository", () => ({
    listAdminOpenUnmappedMarketDataRows: vi.fn(),
}));

import { listAdminOpenUnmappedMarketDataRows } from "../../src/lib/market-data/db/repository";
import {
    getAdminUnmappedMarketData,
    sanitizeUnmappedFilters,
    sanitizeUnmappedLimit,
} from "../../src/lib/market-data/db/admin-unmapped";

describe("admin unmapped market data helper", () => {
    it("falls back to default limit when limit is invalid", () => {
        expect(sanitizeUnmappedLimit("abc")).toBe(50);
        expect(sanitizeUnmappedLimit("0")).toBe(50);
    });

    it("caps limit to max", () => {
        expect(sanitizeUnmappedLimit("999")).toBe(200);
    });

    it("maps rows into safe payload", async () => {
        vi.mocked(listAdminOpenUnmappedMarketDataRows).mockResolvedValue([
            {
                isin: "US0000000001",
                displayName: "Sample Corp",
                assetType: "stock",
                currency: "USD",
                wkn: "123456",
                marketDataStatus: null,
                marketDataStatusReason: null,
                hasAnyMapping: true,
                hasPrimaryMapping: true,
                hasVerifiedMapping: false,
                hasVerifiedPrimary: false,
                hasFailedValidation: false,
                hasPriceData: false,
                hasMarketActions: true,
                primarySymbol: "SMP",
                candidateSymbols: ["SMP", "SMP.DE"],
            },
        ]);

        const payload = await getAdminUnmappedMarketData({ limit: "10" });

        expect(payload.totalOpen).toBe(1);
        expect(payload.shown).toBe(1);
        expect(payload.limit).toBe(10);
        expect(payload.items[0]).toMatchObject({
            isin: "US0000000001",
            mappingStatus: "primary_without_prices",
            category: "primary_without_prices",
            suggestedAction: "validate_existing_candidate",
            hasPriceData: false,
            hasMarketActions: true,
        });
    });

    it("applies supported filters", async () => {
        vi.mocked(listAdminOpenUnmappedMarketDataRows).mockResolvedValue([
            {
                isin: "US0000000001",
                displayName: "Status Legacy",
                assetType: null,
                currency: null,
                wkn: null,
                marketDataStatus: "legacy",
                marketDataStatusReason: "old",
                hasAnyMapping: true,
                hasPrimaryMapping: true,
                hasVerifiedMapping: false,
                hasVerifiedPrimary: false,
                hasFailedValidation: false,
                hasPriceData: true,
                hasMarketActions: false,
                primarySymbol: "LEG",
                candidateSymbols: [],
            },
            {
                isin: "US0000000002",
                displayName: "Needs Mapping",
                assetType: null,
                currency: null,
                wkn: null,
                marketDataStatus: "active",
                marketDataStatusReason: null,
                hasAnyMapping: false,
                hasPrimaryMapping: false,
                hasVerifiedMapping: false,
                hasVerifiedPrimary: false,
                hasFailedValidation: false,
                hasPriceData: false,
                hasMarketActions: false,
                primarySymbol: null,
                candidateSymbols: [],
            },
        ]);

        const payload = await getAdminUnmappedMarketData({ status: "legacy" });

        expect(payload.totalOpen).toBe(1);
        expect(payload.items).toHaveLength(1);
        expect(payload.items[0].isin).toBe("US0000000001");
    });

    it("drops unsupported filters", () => {
        expect(sanitizeUnmappedFilters({ category: "bad", action: "bad", status: "bad" })).toEqual({
            category: null,
            action: null,
            status: null,
        });
    });
});
