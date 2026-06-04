import { describe, expect, it } from "vitest";

import { buildDePrimaryPreferencePlan } from "../../src/lib/market-data/prefer-de-primary";
import type {
    DbMarketInstrument,
    SymbolMappingForPrimaryPreference,
} from "../../src/lib/market-data/db/types-core";

function instrument(overrides: Partial<DbMarketInstrument>): DbMarketInstrument {
    return {
        id: "asset-1",
        isin: "DE0000000001",
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
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
        ...overrides,
    };
}

function mapping(overrides: Partial<SymbolMappingForPrimaryPreference>): SymbolMappingForPrimaryPreference {
    return {
        assetId: "asset-1",
        isin: "DE0000000001",
        displayName: "Demo Asset",
        marketDataStatus: "active",
        mappingId: "mapping-1",
        provider: "yfinance",
        symbol: "DEMO",
        exchange: "PNK",
        currency: "USD",
        isPrimary: false,
        isActive: true,
        verifiedAt: "2026-06-04T00:00:00.000Z",
        notes: null,
        providerPriceRowCount: 0,
        providerLatestPriceDate: null,
        ...overrides,
    };
}

describe("prefer .DE primary plan", () => {
    it("prefers verified .DE mappings over non-DE primary mappings", () => {
        const plan = buildDePrimaryPreferencePlan({
            instruments: [instrument({ isin: "US0000000001", id: "asset-1" })],
            mappings: [
                mapping({
                    assetId: "asset-1",
                    isin: "US0000000001",
                    mappingId: "old-primary",
                    symbol: "IMBBF",
                    exchange: "PNK",
                    currency: "USD",
                    isPrimary: true,
                    providerPriceRowCount: 123,
                    providerLatestPriceDate: "2026-06-03",
                }),
                mapping({
                    assetId: "asset-1",
                    isin: "US0000000001",
                    mappingId: "new-de",
                    symbol: "BMW.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                }),
            ],
        });

        expect(plan.switchCandidates).toHaveLength(1);
        expect(plan.switchCandidates[0]).toMatchObject({
            oldPrimarySymbol: "IMBBF",
            newPrimarySymbol: "BMW.DE",
            requiresFullHistoryReplacement: true,
            oldPriceRowCountToDelete: 123,
            isCurrencyFix: true,
            isVenueOnlySwitch: false,
        });
    });

    it("keeps the current primary when no verified .DE mapping exists", () => {
        const plan = buildDePrimaryPreferencePlan({
            instruments: [instrument({ isin: "US0000000002", id: "asset-2" })],
            mappings: [
                mapping({
                    assetId: "asset-2",
                    isin: "US0000000002",
                    mappingId: "only-primary",
                    symbol: "RYDAF",
                    exchange: "PNK",
                    currency: "USD",
                    isPrimary: true,
                }),
            ],
        });

        expect(plan.switchCandidates).toHaveLength(0);
        expect(plan.noDeCandidate).toBe(1);
    });

    it("inspects unknown-status assets instead of skipping them", () => {
        const plan = buildDePrimaryPreferencePlan({
            instruments: [instrument({ isin: "US0000000009", id: "asset-9", marketDataStatus: "unknown" })],
            mappings: [
                mapping({
                    assetId: "asset-9",
                    isin: "US0000000009",
                    mappingId: "unknown-primary",
                    symbol: "RYDAF",
                    exchange: "PNK",
                    currency: "USD",
                    isPrimary: true,
                }),
            ],
        });

        expect(plan.skippedNonActionable).toBe(0);
        expect(plan.actionableUnknownInspected).toBe(1);
        expect(plan.noDeCandidate).toBe(1);
    });

    it("treats unknown-status assets with verified .DE candidates as switch candidates", () => {
        const plan = buildDePrimaryPreferencePlan({
            instruments: [instrument({ isin: "US0000000010", id: "asset-10", marketDataStatus: "unknown" })],
            mappings: [
                mapping({
                    assetId: "asset-10",
                    isin: "US0000000010",
                    mappingId: "unknown-old-primary",
                    symbol: "IMBBF",
                    exchange: "PNK",
                    currency: "USD",
                    isPrimary: true,
                    providerPriceRowCount: 12,
                }),
                mapping({
                    assetId: "asset-10",
                    isin: "US0000000010",
                    mappingId: "unknown-new-de",
                    symbol: "BMW.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                }),
            ],
        });

        expect(plan.actionableUnknownInspected).toBe(1);
        expect(plan.switchCandidates).toHaveLength(1);
        expect(plan.switchCandidates[0]).toMatchObject({
            marketDataStatus: "unknown",
            oldPrimarySymbol: "IMBBF",
            newPrimarySymbol: "BMW.DE",
            isCurrencyFix: true,
            isVenueOnlySwitch: false,
        });
    });

    it("marks EUR to EUR switches as venue-only instead of currency fixes", () => {
        const plan = buildDePrimaryPreferencePlan({
            instruments: [instrument({ isin: "GB0000000011", id: "asset-11", marketDataStatus: "active" })],
            mappings: [
                mapping({
                    assetId: "asset-11",
                    isin: "GB0000000011",
                    mappingId: "old-primary-eur",
                    symbol: "L3H.F",
                    exchange: "FRA",
                    currency: "EUR",
                    isPrimary: true,
                    providerPriceRowCount: 42,
                }),
                mapping({
                    assetId: "asset-11",
                    isin: "GB0000000011",
                    mappingId: "new-primary-de",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                }),
            ],
        });

        expect(plan.switchCandidates).toHaveLength(1);
        expect(plan.switchCandidates[0]).toMatchObject({
            oldPrimarySymbol: "L3H.F",
            newPrimarySymbol: "R6C0.DE",
            isCurrencyFix: false,
            isVenueOnlySwitch: true,
        });
    });

    it("skips terminal statuses", () => {
        const terminalStatuses = ["excluded", "legacy", "derivative"] as const;

        for (const status of terminalStatuses) {
            const plan = buildDePrimaryPreferencePlan({
                instruments: [instrument({ isin: `US000000000${terminalStatuses.indexOf(status) + 3}`, id: `asset-${status}`, marketDataStatus: status })],
                mappings: [
                    mapping({
                        assetId: `asset-${status}`,
                        isin: `US000000000${terminalStatuses.indexOf(status) + 3}`,
                        mappingId: `${status}-de`,
                        symbol: "TERMINAL.DE",
                        exchange: "XETRA",
                        currency: "EUR",
                        isPrimary: true,
                    }),
                ],
            });

            expect(plan.switchCandidates).toHaveLength(0);
            expect(plan.skippedNonActionable).toBe(1);
            expect(plan.actionableUnknownInspected).toBe(0);
        }
    });
});
