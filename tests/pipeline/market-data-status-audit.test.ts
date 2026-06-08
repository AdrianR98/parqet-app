import { describe, expect, it } from "vitest";

import { buildAuditReport, parseStatusArgs } from "../../scripts/market-data-status.mjs";
import type {
    DbMarketInstrument,
    PrimaryMappingPriceQualityRow,
    SymbolMappingForPrimaryPreference,
} from "../../src/lib/market-data/db/types-core";

function instrument(overrides: Partial<DbMarketInstrument>): DbMarketInstrument {
    return {
        id: "asset-1",
        isin: "GB0000000001",
        name: "Demo Asset",
        displayName: "Demo Asset",
        assetType: "stock",
        currency: "EUR",
        wkn: null,
        metadataSource: null,
        metadataUpdatedAt: null,
        nameSource: null,
        displayNameSource: null,
        displayMetadataUpdatedAt: null,
        marketDataStatus: "active",
        marketDataStatusReason: null,
        marketDataSuccessorIsin: null,
        marketDataSuccessorSymbol: null,
        marketDataStatusUpdatedAt: null,
        createdAt: "2026-06-08T00:00:00.000Z",
        updatedAt: "2026-06-08T00:00:00.000Z",
        ...overrides,
    };
}

function mapping(overrides: Partial<SymbolMappingForPrimaryPreference>): SymbolMappingForPrimaryPreference {
    return {
        assetId: "asset-1",
        isin: "GB0000000001",
        displayName: "Demo Asset",
        marketDataStatus: "active",
        mappingId: "mapping-1",
        provider: "yfinance",
        symbol: "DEMO",
        exchange: "LSE",
        currency: "GBP",
        isPrimary: true,
        isActive: true,
        verifiedAt: "2026-06-08T00:00:00.000Z",
        notes: null,
        providerPriceRowCount: 100,
        providerLatestPriceDate: "2026-06-08",
        ...overrides,
    };
}

function quality(overrides: Partial<PrimaryMappingPriceQualityRow>): PrimaryMappingPriceQualityRow {
    return {
        assetId: "asset-1",
        isin: "GB0000000001",
        displayName: "Demo Asset",
        marketDataStatus: "active",
        provider: "yfinance",
        primarySymbol: "DEMO.L",
        primaryExchange: "LSE",
        primaryCurrency: "GBP",
        priceRowCount: 100,
        minPriceDate: "2024-01-01",
        latestPriceDate: "2026-06-08",
        latestCurrency: "GBP",
        longestGapDays: 3,
        ...overrides,
    };
}

describe("market data status audit", () => {
    it("parses audit flags", () => {
        const options = parseStatusArgs(["--audit-quality", "--all", "--isin", "gb0000000001"]);

        expect(options).toMatchObject({
            auditQuality: true,
            all: true,
            isin: "GB0000000001",
        });
    });

    it("reports remaining non-DE mapping currency and verified .DE candidate state", () => {
        const report = buildAuditReport({
            instruments: [instrument({ isin: "GB0000000001", displayName: "Shell plc" })],
            mappings: [
                mapping({
                    assetId: "asset-1",
                    isin: "GB0000000001",
                    displayName: "Shell plc",
                    symbol: "SHEL.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: true,
                    mappingId: "primary-1",
                }),
                mapping({
                    assetId: "asset-1",
                    isin: "GB0000000001",
                    displayName: "Shell plc",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                    isPrimary: false,
                    mappingId: "candidate-1",
                }),
            ],
            primaryPriceQuality: [
                quality({
                    assetId: "asset-1",
                    isin: "GB0000000001",
                    displayName: "Shell plc",
                    primarySymbol: "SHEL.L",
                    primaryCurrency: "GBp",
                    latestCurrency: "GBp",
                }),
            ],
            dePlan: { switchCandidates: [] },
            now: new Date("2026-06-08T00:00:00.000Z"),
        });

        expect(report.remainingNonDeMappings).toEqual([
            expect.objectContaining({
                isin: "GB0000000001",
                primarySymbol: "SHEL.L",
                currency: "GBp",
                hasVerifiedDeCandidate: true,
                verifiedDeSymbol: "R6C0.DE",
                verifiedDeOwnershipStatus: "owned_by_same_asset",
                latestCurrency: "GBp",
            }),
        ]);
    });

    it("flags non-EUR latest price currencies", () => {
        const report = buildAuditReport({
            instruments: [instrument({ isin: "GB0000000001" }), instrument({ isin: "US0000000002", id: "asset-2" })],
            mappings: [
                mapping({ isin: "GB0000000001", symbol: "SHEL.L", currency: "GBp" }),
                mapping({ assetId: "asset-2", isin: "US0000000002", symbol: "IBM", currency: "USD" }),
            ],
            primaryPriceQuality: [
                quality({ isin: "GB0000000001", latestCurrency: "GBp", primarySymbol: "SHEL.L" }),
                quality({ assetId: "asset-2", isin: "US0000000002", latestCurrency: "USD", primarySymbol: "IBM", primaryCurrency: "USD" }),
            ],
            dePlan: { switchCandidates: [] },
            now: new Date("2026-06-08T00:00:00.000Z"),
        });

        expect(report.nonEurLatestPrices.map((row) => row.latestCurrency)).toEqual(["GBp", "USD"]);
    });

    it("reports duplicate .DE ownership conflicts without resolving them", () => {
        const report = buildAuditReport({
            instruments: [
                instrument({ id: "owner-asset", isin: "DE0000000001", displayName: "Legacy Shell" }),
                instrument({ id: "candidate-asset", isin: "GB0000000001", displayName: "Shell plc" }),
            ],
            mappings: [
                mapping({
                    assetId: "owner-asset",
                    isin: "DE0000000001",
                    displayName: "Legacy Shell",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                    isPrimary: true,
                    mappingId: "owner-de",
                }),
                mapping({
                    assetId: "candidate-asset",
                    isin: "GB0000000001",
                    displayName: "Shell plc",
                    symbol: "SHEL.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: true,
                    mappingId: "candidate-primary",
                }),
                mapping({
                    assetId: "candidate-asset",
                    isin: "GB0000000001",
                    displayName: "Shell plc",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                    isPrimary: false,
                    mappingId: "candidate-de",
                }),
            ],
            primaryPriceQuality: [
                quality({
                    assetId: "candidate-asset",
                    isin: "GB0000000001",
                    displayName: "Shell plc",
                    primarySymbol: "SHEL.L",
                    primaryCurrency: "GBp",
                    latestCurrency: "GBp",
                }),
            ],
            dePlan: {
                switchCandidates: [
                    {
                        assetId: "candidate-asset",
                        isin: "GB0000000001",
                        displayName: "Shell plc",
                        marketDataStatus: "active",
                        newPrimaryMappingId: "candidate-de",
                    },
                ],
            },
            now: new Date("2026-06-08T00:00:00.000Z"),
        });

        expect(report.ownershipConflicts).toEqual([
            expect.objectContaining({
                symbol: "R6C0.DE",
                ownerAssetId: "owner-asset",
                ownerIsin: "DE0000000001",
                competingIsin: "GB0000000001",
                reason: "symbol_owned_by_other_asset",
                blocksCurrentActiveOrUnknownAsset: true,
            }),
        ]);
    });

    it("computes min/max dates and longest gap for price-history quality", () => {
        const report = buildAuditReport({
            instruments: [instrument({ isin: "US0000000003", displayName: "Short History" })],
            mappings: [
                mapping({
                    isin: "US0000000003",
                    symbol: "ABC.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                }),
            ],
            primaryPriceQuality: [
                quality({
                    isin: "US0000000003",
                    displayName: "Short History",
                    primarySymbol: "ABC.DE",
                    primaryExchange: "XETRA",
                    primaryCurrency: "EUR",
                    priceRowCount: 50,
                    minPriceDate: "2026-04-01",
                    latestPriceDate: "2026-05-20",
                    latestCurrency: "EUR",
                    longestGapDays: 14,
                }),
            ],
            dePlan: { switchCandidates: [] },
            now: new Date("2026-06-08T00:00:00.000Z"),
        });

        expect(report.suspiciousHistory).toEqual([
            expect.objectContaining({
                isin: "US0000000003",
                minPriceDate: "2026-04-01",
                latestPriceDate: "2026-05-20",
                longestGapDays: 14,
                suspiciouslyShortHistory: true,
                staleLatestPrice: true,
                longGapFlag: true,
            }),
        ]);
    });

    it("separates terminal statuses from actionable unknown or active assets", () => {
        const report = buildAuditReport({
            instruments: [
                instrument({ isin: "GB0000000001", displayName: "Legacy Asset", marketDataStatus: "legacy" }),
                instrument({ isin: "GB0000000002", id: "asset-2", displayName: "Unknown Asset", marketDataStatus: "unknown" }),
            ],
            mappings: [
                mapping({ isin: "GB0000000001", displayName: "Legacy Asset", marketDataStatus: "legacy", symbol: "LEG.L", currency: "GBP" }),
                mapping({ assetId: "asset-2", isin: "GB0000000002", displayName: "Unknown Asset", marketDataStatus: "unknown", symbol: "UNK.L", currency: "GBP" }),
            ],
            primaryPriceQuality: [
                quality({ isin: "GB0000000001", displayName: "Legacy Asset", marketDataStatus: "legacy", primarySymbol: "LEG.L" }),
                quality({ assetId: "asset-2", isin: "GB0000000002", displayName: "Unknown Asset", marketDataStatus: "unknown", primarySymbol: "UNK.L" }),
            ],
            dePlan: { switchCandidates: [] },
            now: new Date("2026-06-08T00:00:00.000Z"),
        });

        expect(report.remainingNonDeMappings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ isin: "GB0000000001", statusClass: "terminal" }),
                expect.objectContaining({ isin: "GB0000000002", statusClass: "manual_review" }),
            ]),
        );
    });
});
