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
        expect(payload.actionableTotal).toBe(1);
        expect(payload.classifiedTotal).toBe(0);
        expect(payload.limit).toBe(10);
        expect(payload.actionableItems[0]).toMatchObject({
            isin: "US0000000001",
            mappingStatus: "unverified_mapping",
            category: "unverified_mapping",
            suggestedAction: "validate_candidates",
            triageHint: "Candidate mapping exists but is not verified yet.",
            triageReason: "mapping exists but not verified",
            hasPriceData: false,
            hasMarketActions: true,
        });
    });

    it("classifies derivative/warrant rows", async () => {
        vi.mocked(listAdminOpenUnmappedMarketDataRows).mockResolvedValue([
            {
                isin: "DE000MJ53FH4",
                displayName: "Discount Warrant XYZ",
                assetType: "warrant",
                currency: "EUR",
                wkn: null,
                marketDataStatus: null,
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
        const payload = await getAdminUnmappedMarketData({});
        expect(payload.totalOpen).toBe(0);
        expect(payload.classifiedTotal).toBe(1);
        expect(payload.classifiedItems[0]).toMatchObject({
            category: "derivative_or_warrant",
            suggestedAction: "review_derivative_or_exclude",
            triageReason: "name or assetType matched derivative/warrant pattern",
        });
    });

    it("classifies explicit legacy status rows and exposes DB status reason", async () => {
        vi.mocked(listAdminOpenUnmappedMarketDataRows).mockResolvedValue([
            {
                isin: "GB00B03MM408",
                displayName: "Royal Dutch Shell B",
                assetType: "stock",
                currency: "GBP",
                wkn: null,
                marketDataStatus: "legacy",
                marketDataStatusReason: "status set by curation",
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
        const payload = await getAdminUnmappedMarketData({});
        expect(payload.totalOpen).toBe(0);
        expect(payload.classifiedItems[0]).toMatchObject({
            category: "legacy_or_corporate_action",
            suggestedAction: "review_legacy_or_successor",
            triageHint: "Instrument is marked legacy in DB; inspect status or successor mapping.",
            triageReason: "market_data_status=legacy",
        });
    });

    it("classifies legacy/corporate action heuristic rows for old ISIN naming", async () => {
        vi.mocked(listAdminOpenUnmappedMarketDataRows).mockResolvedValue([
            {
                isin: "GB00B03MM408",
                displayName: "Royal Dutch Shell B old ISIN",
                assetType: "stock",
                currency: "GBP",
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
        const payload = await getAdminUnmappedMarketData({});
        expect(payload.totalOpen).toBe(0);
        expect(payload.classifiedItems[0]).toMatchObject({
            category: "legacy_or_corporate_action",
            suggestedAction: "review_legacy_or_successor",
            triageReason: "name/status reason matched legacy/corporate-action pattern",
        });
    });

    it("classifies no mapping plausible equity as mapping candidate needed", async () => {
        vi.mocked(listAdminOpenUnmappedMarketDataRows).mockResolvedValue([
            {
                isin: "US7495271071",
                displayName: "REV Group Inc",
                assetType: "stock",
                currency: "USD",
                wkn: "A2H5A5",
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
        const payload = await getAdminUnmappedMarketData({});
        expect(payload.totalOpen).toBe(1);
        expect(payload.actionableItems[0]).toMatchObject({
            category: "mapping_candidate_needed",
            suggestedAction: "add_candidates",
            triageHint: "No mapping exists yet; add or import candidate symbols.",
            triageReason: "no yfinance mapping",
        });
    });

    it("classifies failed validation cases", async () => {
        vi.mocked(listAdminOpenUnmappedMarketDataRows).mockResolvedValue([
            {
                isin: "US0000000003",
                displayName: "Validation Failed Co",
                assetType: "stock",
                currency: "USD",
                wkn: null,
                marketDataStatus: "active",
                marketDataStatusReason: "validation failed",
                hasAnyMapping: true,
                hasPrimaryMapping: true,
                hasVerifiedMapping: false,
                hasVerifiedPrimary: false,
                hasFailedValidation: true,
                hasPriceData: false,
                hasMarketActions: false,
                primarySymbol: "FAIL",
                candidateSymbols: ["FAIL"],
            },
        ]);
        const payload = await getAdminUnmappedMarketData({});
        expect(payload.totalOpen).toBe(0);
        expect(payload.classifiedItems[0]).toMatchObject({
            category: "failed_or_excluded",
            suggestedAction: "review_failed_validation",
            triageReason: "has failed validation candidate",
        });
    });

    it("classifies unknown metadata as manual review", async () => {
        vi.mocked(listAdminOpenUnmappedMarketDataRows).mockResolvedValue([
            {
                isin: "US3682872078",
                displayName: null,
                assetType: null,
                currency: null,
                wkn: null,
                marketDataStatus: "unknown",
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
        const payload = await getAdminUnmappedMarketData({});
        expect(payload.totalOpen).toBe(0);
        expect(payload.classifiedItems[0]).toMatchObject({
            category: "manual_review",
            suggestedAction: "inspect_instrument",
        });
    });

    it("drops ready rows from open list", async () => {
        vi.mocked(listAdminOpenUnmappedMarketDataRows).mockResolvedValue([
            {
                isin: "NL0015002MS2",
                displayName: "Magnum Ice Cream Company",
                assetType: "stock",
                currency: "EUR",
                wkn: null,
                marketDataStatus: "active",
                marketDataStatusReason: null,
                hasAnyMapping: true,
                hasPrimaryMapping: true,
                hasVerifiedMapping: true,
                hasVerifiedPrimary: true,
                hasFailedValidation: false,
                hasPriceData: true,
                hasMarketActions: true,
                primarySymbol: "MICC.AS",
                candidateSymbols: ["MICC.AS"],
            },
        ]);
        const payload = await getAdminUnmappedMarketData({});
        expect(payload.totalOpen).toBe(0);
        expect(payload.items).toHaveLength(0);
        expect(payload.classifiedItems).toHaveLength(0);
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

        expect(payload.totalOpen).toBe(0);
        expect(payload.items).toHaveLength(0);
        expect(payload.classifiedTotal).toBe(1);
        expect(payload.classifiedItems[0].isin).toBe("US0000000001");
    });

    it("drops unsupported filters", () => {
        expect(sanitizeUnmappedFilters({ category: "bad", action: "bad", status: "bad" })).toEqual({
            category: null,
            action: null,
            status: null,
        });
    });
});
