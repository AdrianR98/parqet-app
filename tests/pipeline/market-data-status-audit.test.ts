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
        distinctHistoricalCurrencies: ["GBP"],
        priceCurrencyBreakdown: { GBP: 100 },
        nonEurPriceRowCount: 100,
        ...overrides,
    };
}

describe("market data status audit", () => {
    it("parses audit flags", () => {
        const options = parseStatusArgs(["--audit-quality", "--all", "--isin", "gb0000000001", "--symbol", "r6c0.de", "--currency", "gbp"]);

        expect(options).toMatchObject({
            auditQuality: true,
            all: true,
            isin: "GB0000000001",
            symbol: "R6C0.DE",
            currency: "GBP",
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
                    distinctHistoricalCurrencies: ["GBp"],
                    priceCurrencyBreakdown: { GBp: 100 },
                    nonEurPriceRowCount: 100,
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
                distinctHistoricalCurrencies: ["GBp"],
                reasonNotSwitchable: "unknown",
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

    it("separates latest currency from historical currencies for consistency reporting", () => {
        const report = buildAuditReport({
            instruments: [instrument({ isin: "US0000000004", displayName: "Mixed History" })],
            mappings: [mapping({ isin: "US0000000004", symbol: "ABC.DE", exchange: "XETRA", currency: "EUR" })],
            primaryPriceQuality: [
                quality({
                    isin: "US0000000004",
                    primarySymbol: "ABC.DE",
                    primaryCurrency: "EUR",
                    latestCurrency: "EUR",
                    distinctHistoricalCurrencies: ["EUR", "USD"],
                    priceCurrencyBreakdown: { EUR: 90, USD: 10 },
                    nonEurPriceRowCount: 10,
                }),
            ],
            dePlan: { switchCandidates: [] },
            now: new Date("2026-06-08T00:00:00.000Z"),
        });

        expect(report.historicalCurrencyConsistency).toEqual([
            expect.objectContaining({
                primaryCurrency: "EUR",
                latestCurrency: "EUR",
                historicalCurrencies: ["EUR", "USD"],
            }),
        ]);
    });

    it("flags switched .DE assets with historical USD rows", () => {
        const report = buildAuditReport({
            instruments: [instrument({ isin: "US0000000005", displayName: "Switched Asset" })],
            mappings: [
                mapping({ isin: "US0000000005", symbol: "ABC.DE", exchange: "XETRA", currency: "EUR", isPrimary: true, mappingId: "primary-de" }),
                mapping({ isin: "US0000000005", symbol: "ABC", exchange: "NYQ", currency: "USD", isPrimary: false, mappingId: "legacy-us", verifiedAt: "2026-06-01T00:00:00.000Z" }),
            ],
            primaryPriceQuality: [
                quality({
                    isin: "US0000000005",
                    primarySymbol: "ABC.DE",
                    primaryExchange: "XETRA",
                    primaryCurrency: "EUR",
                    latestCurrency: "EUR",
                    distinctHistoricalCurrencies: ["EUR", "USD"],
                    priceCurrencyBreakdown: { EUR: 200, USD: 20 },
                    nonEurPriceRowCount: 20,
                }),
            ],
            dePlan: { switchCandidates: [] },
            now: new Date("2026-06-08T00:00:00.000Z"),
        });

        expect(report.switchedDeIntegrity).toEqual([
            expect.objectContaining({
                isin: "US0000000005",
                hasNonEurHistoricalRows: true,
                latestPriceNonEur: false,
            }),
        ]);
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

    it("reports terminal non-EUR assets separately from actionable unknown assets in row audit", () => {
        const report = buildAuditReport({
            instruments: [
                instrument({ isin: "GB0000000010", displayName: "Legacy Asset", marketDataStatus: "legacy" }),
                instrument({ isin: "GB0000000011", id: "asset-2", displayName: "Actionable Asset", marketDataStatus: "active" }),
            ],
            mappings: [
                mapping({ isin: "GB0000000010", displayName: "Legacy Asset", marketDataStatus: "legacy", symbol: "LEG.L", currency: "GBP" }),
                mapping({ assetId: "asset-2", isin: "GB0000000011", displayName: "Actionable Asset", marketDataStatus: "active", symbol: "ACT", currency: "USD" }),
            ],
            primaryPriceQuality: [
                quality({ isin: "GB0000000010", displayName: "Legacy Asset", marketDataStatus: "legacy", primarySymbol: "LEG.L", distinctHistoricalCurrencies: ["GBP"], priceCurrencyBreakdown: { GBP: 100 }, nonEurPriceRowCount: 100 }),
                quality({ assetId: "asset-2", isin: "GB0000000011", displayName: "Actionable Asset", marketDataStatus: "active", primarySymbol: "ACT", primaryCurrency: "USD", latestCurrency: "USD", distinctHistoricalCurrencies: ["USD"], priceCurrencyBreakdown: { USD: 100 }, nonEurPriceRowCount: 100 }),
            ],
            dePlan: { switchCandidates: [] },
            now: new Date("2026-06-08T00:00:00.000Z"),
        });

        expect(report.nonEurPriceRowsAudit.topAssets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ isin: "GB0000000010", statusClass: "terminal" }),
                expect.objectContaining({ isin: "GB0000000011", statusClass: "actionable" }),
            ]),
        );
    });

    it("reports shell-like ownership and shell-specific rows", () => {
        const report = buildAuditReport({
            instruments: [
                instrument({ id: "owner-asset", isin: "GB00B03MM408", displayName: "Royal Dutch Shell B (alt)", marketDataStatus: "legacy" }),
                instrument({ id: "active-asset", isin: "GB00BP6MXD84", displayName: "Shell", marketDataStatus: "unknown" }),
            ],
            mappings: [
                mapping({ assetId: "owner-asset", isin: "GB00B03MM408", displayName: "Royal Dutch Shell B (alt)", marketDataStatus: "legacy", symbol: "R6C0.DE", exchange: "XETRA", currency: "EUR", isPrimary: true }),
                mapping({ assetId: "active-asset", isin: "GB00BP6MXD84", displayName: "Shell", marketDataStatus: "unknown", symbol: "SHEL.L", exchange: "LSE", currency: "GBp", isPrimary: true }),
            ],
            referenceCandidates: [
                {
                    instrumentId: "active-asset",
                    isin: "GB00BP6MXD84",
                    name: "Shell",
                    candidateSymbol: "R6C0.DE",
                    mnemonic: "R6C0",
                    currency: "EUR",
                    instrumentType: "stock",
                    marketSegment: "Prime Standard",
                    micCode: "XETR",
                    primaryMarketMicCode: "XETR",
                    hasVerifiedPrimary: false,
                    hasVerifiedYfinance: false,
                    hasAnyPrimary: true,
                    hasExistingCandidate: false,
                },
            ],
            primaryPriceQuality: [
                quality({ assetId: "owner-asset", isin: "GB00B03MM408", displayName: "Royal Dutch Shell B (alt)", marketDataStatus: "legacy", primarySymbol: "R6C0.DE", primaryExchange: "XETRA", primaryCurrency: "EUR", latestCurrency: "EUR", distinctHistoricalCurrencies: ["EUR"], priceCurrencyBreakdown: { EUR: 100 }, nonEurPriceRowCount: 0 }),
                quality({ assetId: "active-asset", isin: "GB00BP6MXD84", displayName: "Shell", marketDataStatus: "unknown", primarySymbol: "SHEL.L", primaryExchange: "LSE", primaryCurrency: "GBp", latestCurrency: "GBp", distinctHistoricalCurrencies: ["GBp"], priceCurrencyBreakdown: { GBp: 100 }, nonEurPriceRowCount: 100 }),
            ],
            dePlan: { switchCandidates: [] },
            now: new Date("2026-06-08T00:00:00.000Z"),
        });

        expect(report.shellAudit.shellRows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ isin: "GB00BP6MXD84", primarySymbol: "SHEL.L" }),
            ]),
        );
        expect(report.shellAudit.symbolOwnership).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ symbol: "R6C0.DE", ownerIsin: "GB00B03MM408" }),
            ]),
        );
    });
});
