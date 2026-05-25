import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/market-data/db/repository", () => ({
    listAdminMarketSymbolMappingsOverviewRows: vi.fn(),
}));

import { listAdminMarketSymbolMappingsOverviewRows } from "../../src/lib/market-data/db/repository";
import {
    getAdminMarketSymbolMappings,
    sanitizeMappingsFilters,
    sanitizeMappingsLimit,
} from "../../src/lib/market-data/db/admin-mappings";

describe("admin market mappings helper", () => {
    it("falls back to default limit when invalid", () => {
        expect(sanitizeMappingsLimit("bad")).toBe(50);
        expect(sanitizeMappingsLimit("0")).toBe(50);
    });

    it("caps limit", () => {
        expect(sanitizeMappingsLimit("500")).toBe(200);
    });

    it("maps rows to safe payload", async () => {
        vi.mocked(listAdminMarketSymbolMappingsOverviewRows).mockResolvedValue([
            {
                id: "m1",
                isin: "US0000000001",
                displayName: "Sample",
                provider: "yfinance",
                symbol: "SMP",
                exchange: "XNYS",
                currency: "USD",
                notes: "score=9; source=manual",
                isPrimary: true,
                isActive: true,
                verifiedAt: "2026-01-01T00:00:00.000Z",
                hasPriceData: true,
                latestPriceDate: "2026-01-01",
                latestClose: 100,
            },
        ]);

        const payload = await getAdminMarketSymbolMappings({ limit: "10" });

        expect(payload.total).toBe(1);
        expect(payload.shown).toBe(1);
        expect(payload.limit).toBe(10);
        expect(payload.items[0]).toMatchObject({
            id: "m1",
            source: "manual",
            score: 9,
            hasPriceData: true,
        });
    });

    it("applies filters", async () => {
        vi.mocked(listAdminMarketSymbolMappingsOverviewRows).mockResolvedValue([
            {
                id: "m1",
                isin: "US0000000001",
                displayName: "Sample",
                provider: "yfinance",
                symbol: "SMP",
                exchange: null,
                currency: null,
                notes: null,
                isPrimary: true,
                isActive: true,
                verifiedAt: "2026-01-01T00:00:00.000Z",
                hasPriceData: true,
                latestPriceDate: null,
                latestClose: null,
            },
            {
                id: "m2",
                isin: "US0000000002",
                displayName: "Other",
                provider: "yfinance",
                symbol: "OTH",
                exchange: null,
                currency: null,
                notes: null,
                isPrimary: false,
                isActive: true,
                verifiedAt: null,
                hasPriceData: false,
                latestPriceDate: null,
                latestClose: null,
            },
        ]);

        const payload = await getAdminMarketSymbolMappings({ verified: "false", primary: "false" });
        expect(payload.total).toBe(1);
        expect(payload.items[0].id).toBe("m2");
    });

    it("normalizes invalid filters", () => {
        expect(sanitizeMappingsFilters({ verified: "x", primary: "x", active: "x", hasPrices: "x", q: "  " })).toEqual({
            q: null,
            provider: null,
            verified: null,
            primary: null,
            active: null,
            hasPrices: null,
        });
    });
});
