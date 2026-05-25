import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/market-data/db/repository", () => ({
    listAdminMarketInstrumentOverviewRows: vi.fn(),
}));

import { listAdminMarketInstrumentOverviewRows } from "../../src/lib/market-data/db/repository";
import {
    getAdminMarketInstruments,
    sanitizeInstrumentsFilters,
    sanitizeInstrumentsLimit,
} from "../../src/lib/market-data/db/admin-instruments";

describe("admin market instruments helper", () => {
    it("falls back to default limit when invalid", () => {
        expect(sanitizeInstrumentsLimit("bad")).toBe(50);
        expect(sanitizeInstrumentsLimit("0")).toBe(50);
    });

    it("caps limit", () => {
        expect(sanitizeInstrumentsLimit("500")).toBe(200);
    });

    it("maps rows to safe payload", async () => {
        vi.mocked(listAdminMarketInstrumentOverviewRows).mockResolvedValue([
            {
                isin: "US0000000001",
                displayName: "Sample",
                name: "Sample Inc",
                assetType: "stock",
                currency: "USD",
                wkn: "123456",
                metadataSource: "trading_universe",
                marketDataStatus: "active",
                marketDataStatusReason: null,
                primarySymbol: "SMP",
                primaryExchange: "XNYS",
                primaryCurrency: "USD",
                verifiedMappingCount: 1,
                candidateMappingCount: 2,
                hasPrimaryMapping: true,
                hasPriceData: true,
                hasMarketActions: false,
                firstPriceDate: "2024-01-01",
                lastPriceDate: "2024-12-31",
                latestClose: 99.5,
            },
        ]);

        const payload = await getAdminMarketInstruments({ limit: "10" });

        expect(payload.total).toBe(1);
        expect(payload.shown).toBe(1);
        expect(payload.limit).toBe(10);
        expect(payload.items[0]).toMatchObject({
            isin: "US0000000001",
            metadataStatus: "trading_universe",
            verifiedMappingCount: 1,
            hasPriceData: true,
            latestClose: 99.5,
        });
    });

    it("applies cheap filters", async () => {
        vi.mocked(listAdminMarketInstrumentOverviewRows).mockResolvedValue([
            {
                isin: "US0000000001",
                displayName: "Alpha",
                name: null,
                assetType: "stock",
                currency: "USD",
                wkn: null,
                metadataSource: null,
                marketDataStatus: "active",
                marketDataStatusReason: null,
                primarySymbol: "ALP",
                primaryExchange: null,
                primaryCurrency: null,
                verifiedMappingCount: 1,
                candidateMappingCount: 0,
                hasPrimaryMapping: true,
                hasPriceData: true,
                hasMarketActions: false,
                firstPriceDate: null,
                lastPriceDate: null,
                latestClose: null,
            },
            {
                isin: "US0000000002",
                displayName: "Beta",
                name: null,
                assetType: "etf",
                currency: "USD",
                wkn: null,
                metadataSource: null,
                marketDataStatus: "legacy",
                marketDataStatusReason: "old",
                primarySymbol: null,
                primaryExchange: null,
                primaryCurrency: null,
                verifiedMappingCount: 0,
                candidateMappingCount: 1,
                hasPrimaryMapping: false,
                hasPriceData: false,
                hasMarketActions: false,
                firstPriceDate: null,
                lastPriceDate: null,
                latestClose: null,
            },
        ]);

        const payload = await getAdminMarketInstruments({ status: "legacy", hasPrimary: "false" });

        expect(payload.total).toBe(1);
        expect(payload.items).toHaveLength(1);
        expect(payload.items[0].isin).toBe("US0000000002");
    });

    it("normalizes unsupported filters", () => {
        expect(
            sanitizeInstrumentsFilters({
                status: "invalid",
                hasPrimary: "invalid",
                hasPrices: "invalid",
                q: "   ",
                assetType: "   ",
            }),
        ).toEqual({
            q: null,
            status: null,
            assetType: null,
            hasPrimary: null,
            hasPrices: null,
        });
    });
});
