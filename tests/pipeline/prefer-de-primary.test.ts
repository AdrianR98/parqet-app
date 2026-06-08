import { describe, expect, it } from "vitest";

import { parseArgs } from "../../scripts/prefer-de-yfinance-primary-mappings.mjs";
import {
    buildDePrimaryPreferencePlan,
    buildDePrimaryPreferenceSelection,
} from "../../src/lib/market-data/prefer-de-primary";
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
    it("accepts the --currency-fixes-only CLI flag", () => {
        const options = parseArgs(["--currency-fixes-only"]);

        expect(options.currencyFixesOnly).toBe(true);
        expect(options.write).toBe(false);
        expect(options.replaceHistory).toBe(false);
    });

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

    it("keeps all switch candidates selected in the default dry-run selection", () => {
        const plan = buildDePrimaryPreferencePlan({
            instruments: [
                instrument({ isin: "US0000000012", id: "asset-12", marketDataStatus: "active" }),
                instrument({ isin: "GB0000000013", id: "asset-13", marketDataStatus: "active" }),
            ],
            mappings: [
                mapping({
                    assetId: "asset-12",
                    isin: "US0000000012",
                    mappingId: "old-primary-usd",
                    symbol: "IMBBF",
                    exchange: "PNK",
                    currency: "USD",
                    isPrimary: true,
                    providerPriceRowCount: 123,
                }),
                mapping({
                    assetId: "asset-12",
                    isin: "US0000000012",
                    mappingId: "new-primary-usd-de",
                    symbol: "BMW.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                }),
                mapping({
                    assetId: "asset-13",
                    isin: "GB0000000013",
                    mappingId: "old-primary-eur-2",
                    symbol: "L3H.F",
                    exchange: "FRA",
                    currency: "EUR",
                    isPrimary: true,
                    providerPriceRowCount: 42,
                }),
                mapping({
                    assetId: "asset-13",
                    isin: "GB0000000013",
                    mappingId: "new-primary-eur-de-2",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                }),
            ],
        });

        const selection = buildDePrimaryPreferenceSelection({ plan });

        expect(selection.totalSwitchCandidates).toBe(2);
        expect(selection.selectedCandidates).toHaveLength(2);
        expect(selection.selectedHistoryReplacementCount).toBe(2);
        expect(selection.selectedDeletionRowCount).toBe(165);
        expect(selection.candidates.map((candidate) => candidate.selectionStatus)).toEqual([
            "selected",
            "selected",
        ]);
    });

    it("selects only currency-fix candidates under --currency-fixes-only", () => {
        const plan = buildDePrimaryPreferencePlan({
            instruments: [
                instrument({ isin: "US0000000014", id: "asset-14", marketDataStatus: "active" }),
                instrument({ isin: "GB0000000015", id: "asset-15", marketDataStatus: "active" }),
            ],
            mappings: [
                mapping({
                    assetId: "asset-14",
                    isin: "US0000000014",
                    mappingId: "old-primary-usd-2",
                    symbol: "IMBBF",
                    exchange: "PNK",
                    currency: "USD",
                    isPrimary: true,
                    providerPriceRowCount: 123,
                }),
                mapping({
                    assetId: "asset-14",
                    isin: "US0000000014",
                    mappingId: "new-primary-usd-de-2",
                    symbol: "BMW.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                }),
                mapping({
                    assetId: "asset-15",
                    isin: "GB0000000015",
                    mappingId: "old-primary-eur-3",
                    symbol: "L3H.F",
                    exchange: "FRA",
                    currency: "EUR",
                    isPrimary: true,
                    providerPriceRowCount: 42,
                }),
                mapping({
                    assetId: "asset-15",
                    isin: "GB0000000015",
                    mappingId: "new-primary-eur-de-3",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                }),
            ],
        });

        const selection = buildDePrimaryPreferenceSelection({
            plan,
            currencyFixesOnly: true,
        });

        expect(selection.totalSwitchCandidates).toBe(2);
        expect(selection.currencyFixSwitchCandidates).toBe(1);
        expect(selection.venueOnlySwitchCandidates).toBe(1);
        expect(selection.selectedCandidates).toHaveLength(1);
        expect(selection.selectedCandidates[0]).toMatchObject({
            isin: "US0000000014",
            selectionStatus: "selected",
            isCurrencyFix: true,
        });
        expect(selection.selectedHistoryReplacementCount).toBe(1);
        expect(selection.selectedDeletionRowCount).toBe(123);
        expect(selection.candidates).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    isin: "GB0000000015",
                    selectionStatus: "skipped_by_currency_fixes_only",
                    isCurrencyFix: false,
                    isVenueOnlySwitch: true,
                }),
            ]),
        );
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
