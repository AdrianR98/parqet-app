import { describe, expect, it, vi } from "vitest";

import {
    createConsoleProgressReporter,
    createProviderTimeoutError,
    executeSelectedCandidates,
    parseArgs,
    printCandidates,
    runCommand,
} from "../../scripts/prefer-de-yfinance-primary-mappings.mjs";
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

    it("accepts the --continue-on-error CLI flag", () => {
        const options = parseArgs(["--continue-on-error"]);

        expect(options.continueOnError).toBe(true);
    });

    it("accepts the compact and provider-timeout flags", () => {
        const options = parseArgs(["--compact", "--provider-timeout-seconds", "45"]);

        expect(options.compact).toBe(true);
        expect(options.providerTimeoutSeconds).toBe(45);
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

    it("stops after the first replacement failure in fail-fast mode", async () => {
        const candidateA = {
            assetId: "asset-a",
            isin: "US0000000100",
            displayName: "Candidate A",
            marketDataStatus: "active",
            oldPrimarySymbol: "OLDA",
            oldPrimaryMappingId: "old-a",
            oldPrimaryExchange: "NYSE",
            oldPrimaryCurrency: "USD",
            newPrimarySymbol: "NEWA.DE",
            newPrimaryMappingId: "new-a",
            newPrimaryExchange: "XETRA",
            newPrimaryCurrency: "EUR",
            oldPriceRowCountToDelete: 10,
            existingNewPriceRowCount: null,
            requiresFullHistoryReplacement: true,
            isCurrencyFix: true,
            isVenueOnlySwitch: false,
            selectionStatus: "selected",
        };
        const candidateB = { ...candidateA, isin: "US0000000101", displayName: "Candidate B", newPrimaryMappingId: "new-b", newPrimarySymbol: "NEWB.DE" };
        const replaceMock = async ({ targetMappingId }) => {
            if (targetMappingId === "new-a") {
                const error = new Error("first failure");
                error.code = "db_error";
                throw error;
            }
            return { deletedPriceRows: 5, insertedPriceRows: 2, latestPriceDate: "2026-06-08" };
        };

        await expect(
            executeSelectedCandidates({
                selectedCandidates: [candidateA, candidateB],
                continueOnError: false,
                prepareReplacementHistory: async (candidate) => ({
                    currency: "EUR",
                    points: [{ date: "2026-06-08", close: candidate.newPrimaryMappingId === "new-a" ? 1 : 2 }],
                }),
                replacePrimaryMappingPriceHistory: replaceMock,
                setPrimarySymbolMappingByIsin: async () => undefined,
                nowIso: "2026-06-08T00:00:00.000Z",
            }),
        ).rejects.toMatchObject({
            summary: expect.objectContaining({
                attemptedReplacements: 1,
                succeededReplacements: 0,
                failedReplacements: 1,
            }),
        });
    });

    it("continues after a replacement failure with --continue-on-error and records later successes", async () => {
        const candidateA = {
            assetId: "asset-a",
            isin: "US0000000200",
            displayName: "Candidate A",
            marketDataStatus: "active",
            oldPrimarySymbol: "OLDA",
            oldPrimaryMappingId: "old-a",
            oldPrimaryExchange: "NYSE",
            oldPrimaryCurrency: "USD",
            newPrimarySymbol: "NEWA.DE",
            newPrimaryMappingId: "new-a",
            newPrimaryExchange: "XETRA",
            newPrimaryCurrency: "EUR",
            oldPriceRowCountToDelete: 10,
            existingNewPriceRowCount: null,
            requiresFullHistoryReplacement: true,
            isCurrencyFix: true,
            isVenueOnlySwitch: false,
            selectionStatus: "selected",
        };
        const candidateB = { ...candidateA, isin: "US0000000201", displayName: "Candidate B", newPrimaryMappingId: "new-b", newPrimarySymbol: "NEWB.DE" };
        const replaceMock = async ({ targetMappingId }) => {
            if (targetMappingId === "new-a") {
                const error = new Error("first failure");
                error.code = "db_error";
                throw error;
            }
            return { deletedPriceRows: 5, insertedPriceRows: 2, latestPriceDate: "2026-06-08" };
        };

        const result = await executeSelectedCandidates({
            selectedCandidates: [candidateA, candidateB],
            continueOnError: true,
            prepareReplacementHistory: async (candidate) => ({
                currency: "EUR",
                points: [{ date: "2026-06-08", close: candidate.newPrimaryMappingId === "new-a" ? 1 : 2 }],
            }),
            replacePrimaryMappingPriceHistory: replaceMock,
            setPrimarySymbolMappingByIsin: async () => undefined,
            nowIso: "2026-06-08T00:00:00.000Z",
            skippedReplacements: 1,
        });

        expect(result.executionSummary).toMatchObject({
            selectedReplacements: 2,
            attemptedReplacements: 2,
            succeededReplacements: 1,
            failedReplacements: 1,
            skippedReplacements: 1,
            primaryMappingsSwitched: 1,
            oldPriceRowsDeleted: 5,
            newPriceRowsInserted: 2,
            latestPricesVerified: 1,
        });
        expect(result.failures).toEqual([
            expect.objectContaining({
                isin: "US0000000200",
                failureStage: "replace_history",
                failureCode: "db_error",
            }),
        ]);
    });

    it("aborts on the first preparation failure in fail-fast mode", async () => {
        const candidateA = {
            assetId: "asset-a",
            isin: "US0000000300",
            displayName: "Candidate A",
            marketDataStatus: "active",
            oldPrimarySymbol: "OLDA",
            oldPrimaryMappingId: "old-a",
            oldPrimaryExchange: "NYSE",
            oldPrimaryCurrency: "USD",
            newPrimarySymbol: "NEWA.DE",
            newPrimaryMappingId: "new-a",
            newPrimaryExchange: "XETRA",
            newPrimaryCurrency: "EUR",
            oldPriceRowCountToDelete: 10,
            existingNewPriceRowCount: null,
            requiresFullHistoryReplacement: true,
            isCurrencyFix: true,
            isVenueOnlySwitch: false,
            selectionStatus: "selected",
        };
        const candidateB = { ...candidateA, isin: "US0000000301", displayName: "Candidate B", newPrimaryMappingId: "new-b", newPrimarySymbol: "NEWB.DE" };
        const prepareMock = async (candidate) => {
            if (candidate.newPrimaryMappingId === "new-a") {
                const error = new Error("prep failed");
                error.code = "preparation_failed";
                throw error;
            }
            return { currency: "EUR", points: [{ date: "2026-06-08", close: 2 }] };
        };
        const replaceMock = async () => ({ deletedPriceRows: 5, insertedPriceRows: 2, latestPriceDate: "2026-06-08" });

        await expect(
            executeSelectedCandidates({
                selectedCandidates: [candidateA, candidateB],
                continueOnError: false,
                prepareReplacementHistory: prepareMock,
                replacePrimaryMappingPriceHistory: replaceMock,
                setPrimarySymbolMappingByIsin: async () => undefined,
                nowIso: "2026-06-08T00:00:00.000Z",
            }),
        ).rejects.toMatchObject({
            summary: expect.objectContaining({
                attemptedReplacements: 1,
                succeededReplacements: 0,
                failedReplacements: 1,
            }),
            failures: [
                expect.objectContaining({
                    isin: "US0000000300",
                    failureStage: "prepare_history",
                }),
            ],
        });
    });

    it("continues after a preparation failure with --continue-on-error and skips execution for that asset", async () => {
        const candidateA = {
            assetId: "asset-a",
            isin: "US0000000400",
            displayName: "Candidate A",
            marketDataStatus: "active",
            oldPrimarySymbol: "OLDA",
            oldPrimaryMappingId: "old-a",
            oldPrimaryExchange: "NYSE",
            oldPrimaryCurrency: "USD",
            newPrimarySymbol: "NEWA.DE",
            newPrimaryMappingId: "new-a",
            newPrimaryExchange: "XETRA",
            newPrimaryCurrency: "EUR",
            oldPriceRowCountToDelete: 10,
            existingNewPriceRowCount: null,
            requiresFullHistoryReplacement: true,
            isCurrencyFix: true,
            isVenueOnlySwitch: false,
            selectionStatus: "selected",
        };
        const candidateB = { ...candidateA, isin: "US0000000401", displayName: "Candidate B", newPrimaryMappingId: "new-b", newPrimarySymbol: "NEWB.DE" };
        const prepareMock = async (candidate) => {
            if (candidate.newPrimaryMappingId === "new-a") {
                const error = new Error("prep failed");
                error.code = "preparation_failed";
                throw error;
            }
            return { currency: "EUR", points: [{ date: "2026-06-08", close: 2 }] };
        };
        const replaceMock = vi.fn(async ({ targetMappingId }) => ({
            deletedPriceRows: targetMappingId === "new-b" ? 5 : 0,
            insertedPriceRows: targetMappingId === "new-b" ? 2 : 0,
            latestPriceDate: "2026-06-08",
        }));

        const result = await executeSelectedCandidates({
            selectedCandidates: [candidateA, candidateB],
            continueOnError: true,
            prepareReplacementHistory: prepareMock,
            replacePrimaryMappingPriceHistory: replaceMock,
            setPrimarySymbolMappingByIsin: async () => undefined,
            nowIso: "2026-06-08T00:00:00.000Z",
        });

        expect(replaceMock).toHaveBeenCalledTimes(1);
        expect(replaceMock.mock.calls[0][0].targetMappingId).toBe("new-b");
        expect(result.executionSummary).toMatchObject({
            attemptedReplacements: 2,
            succeededReplacements: 1,
            failedReplacements: 1,
            primaryMappingsSwitched: 1,
            oldPriceRowsDeleted: 5,
            newPriceRowsInserted: 2,
            latestPricesVerified: 1,
        });
        expect(result.failures).toEqual([
            expect.objectContaining({
                isin: "US0000000400",
                failureStage: "prepare_history",
                failureCode: "preparation_failed",
                failureReason: "prep failed",
            }),
        ]);
    });

    it("continues after a provider timeout with --continue-on-error", async () => {
        const candidateA = {
            assetId: "asset-a",
            isin: "US0000000500",
            displayName: "Candidate A",
            marketDataStatus: "active",
            oldPrimarySymbol: "OLDA",
            oldPrimaryMappingId: "old-a",
            oldPrimaryExchange: "NYSE",
            oldPrimaryCurrency: "USD",
            newPrimarySymbol: "NEWA.DE",
            newPrimaryMappingId: "new-a",
            newPrimaryExchange: "XETRA",
            newPrimaryCurrency: "EUR",
            oldPriceRowCountToDelete: 10,
            existingNewPriceRowCount: null,
            requiresFullHistoryReplacement: true,
            isCurrencyFix: true,
            isVenueOnlySwitch: false,
            selectionStatus: "selected",
        };
        const candidateB = { ...candidateA, isin: "US0000000501", displayName: "Candidate B", newPrimaryMappingId: "new-b", newPrimarySymbol: "NEWB.DE" };
        const prepareMock = async (candidate) => {
            if (candidate.newPrimaryMappingId === "new-a") {
                throw createProviderTimeoutError({ label: "yfinance export US0000000500/NEWA.DE", timeoutSeconds: 1 });
            }
            return { currency: "EUR", points: [{ date: "2026-06-08", close: 2 }] };
        };
        const replaceMock = vi.fn(async () => ({
            deletedPriceRows: 5,
            insertedPriceRows: 2,
            latestPriceDate: "2026-06-08",
        }));

        const result = await executeSelectedCandidates({
            selectedCandidates: [candidateA, candidateB],
            continueOnError: true,
            prepareReplacementHistory: prepareMock,
            replacePrimaryMappingPriceHistory: replaceMock,
            setPrimarySymbolMappingByIsin: async () => undefined,
            nowIso: "2026-06-08T00:00:00.000Z",
        });

        expect(replaceMock).toHaveBeenCalledTimes(1);
        expect(result.executionSummary).toMatchObject({
            attemptedReplacements: 2,
            succeededReplacements: 1,
            failedReplacements: 1,
        });
        expect(result.failures).toEqual([
            expect.objectContaining({
                isin: "US0000000500",
                failureStage: "prepare_history",
                failureCode: "provider_timeout",
            }),
        ]);
    });

    it("emits progress events for prepare and replace lifecycle transitions", async () => {
        const candidateA = {
            assetId: "asset-a",
            isin: "US0000000600",
            displayName: "Candidate A",
            marketDataStatus: "active",
            oldPrimarySymbol: "OLDA",
            oldPrimaryMappingId: "old-a",
            oldPrimaryExchange: "NYSE",
            oldPrimaryCurrency: "USD",
            newPrimarySymbol: "NEWA.DE",
            newPrimaryMappingId: "new-a",
            newPrimaryExchange: "XETRA",
            newPrimaryCurrency: "EUR",
            oldPriceRowCountToDelete: 10,
            existingNewPriceRowCount: null,
            requiresFullHistoryReplacement: true,
            isCurrencyFix: true,
            isVenueOnlySwitch: false,
            selectionStatus: "selected",
        };
        const candidateB = { ...candidateA, isin: "US0000000601", displayName: "Candidate B", newPrimaryMappingId: "new-b", newPrimarySymbol: "NEWB.DE" };
        const events = [];

        await executeSelectedCandidates({
            selectedCandidates: [candidateA, candidateB],
            continueOnError: true,
            prepareReplacementHistory: async (candidate) => {
                if (candidate.newPrimaryMappingId === "new-b") {
                    const error = new Error("timed out");
                    error.code = "provider_timeout";
                    throw error;
                }
                return { currency: "EUR", points: [{ date: "2026-06-08", close: 2 }] };
            },
            replacePrimaryMappingPriceHistory: async () => ({
                deletedPriceRows: 5,
                insertedPriceRows: 2,
                latestPriceDate: "2026-06-08",
            }),
            setPrimarySymbolMappingByIsin: async () => undefined,
            nowIso: "2026-06-08T00:00:00.000Z",
            progressReporter: {
                onPrepareStart: (event) => events.push(["prepare:start", event.index, event.candidate.isin]),
                onPrepareOk: (event) => events.push(["prepare:ok", event.index, event.payload.points.length]),
                onReplaceStart: (event) => events.push(["replace:start", event.index, event.candidate.isin]),
                onReplaceOk: (event) => events.push(["replace:ok", event.index, event.result.insertedPriceRows]),
                onFailure: (event) => events.push(["failed", event.index, event.failure.failureStage, event.failure.failureCode]),
            },
        });

        expect(events).toEqual([
            ["prepare:start", 1, "US0000000600"],
            ["prepare:ok", 1, 1],
            ["replace:start", 1, "US0000000600"],
            ["replace:ok", 1, 2],
            ["prepare:start", 2, "US0000000601"],
            ["failed", 2, "prepare_history", "provider_timeout"],
        ]);
    });

    it("compact mode suppresses full candidate blocks", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);

        printCandidates(
            [
                {
                    assetId: "asset-a",
                    isin: "US0000000700",
                    displayName: "Candidate A",
                    oldPrimarySymbol: "OLDA",
                    oldPrimaryMappingId: "old-a",
                    oldPrimaryExchange: "NYSE",
                    oldPrimaryCurrency: "USD",
                    newPrimarySymbol: "NEWA.DE",
                    newPrimaryMappingId: "new-a",
                    newPrimaryExchange: "XETRA",
                    newPrimaryCurrency: "EUR",
                    oldPriceRowCountToDelete: 10,
                    existingNewPriceRowCount: null,
                    requiresFullHistoryReplacement: true,
                    isCurrencyFix: true,
                    isVenueOnlySwitch: false,
                    selectionStatus: "selected",
                },
            ],
            { compact: true },
        );

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it("runCommand times out and returns a provider_timeout error", async () => {
        await expect(
            runCommand(
                process.execPath,
                ["-e", "setTimeout(() => process.exit(0), 200);"],
                "timeout-test",
                { timeoutSeconds: 0.05 },
            ),
        ).rejects.toMatchObject({
            code: "provider_timeout",
        });
    });

    it("console progress reporter renders compact progress lines", () => {
        const reporter = createConsoleProgressReporter();
        const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        const candidate = {
            isin: "GB0004544929",
            newPrimarySymbol: "ITB.DE",
        };

        reporter.onPrepareStart({ index: 1, total: 38, candidate });
        reporter.onPrepareOk({
            index: 1,
            total: 38,
            candidate,
            payload: {
                currency: "EUR",
                points: [{ date: "2026-06-08", close: 1 }],
            },
            elapsedMs: 1200,
        });
        reporter.onReplaceStart({ index: 1, total: 38, candidate });
        reporter.onReplaceOk({
            index: 1,
            total: 38,
            candidate,
            result: {
                deletedPriceRows: 10,
                insertedPriceRows: 20,
                latestPriceDate: "2026-06-08",
            },
            elapsedMs: 900,
        });
        reporter.onFailure({
            index: 1,
            total: 38,
            candidate,
            failure: {
                failureStage: "prepare_history",
                failureCode: "provider_timeout",
                failureReason: "timed out",
            },
            elapsedMs: 400,
        });

        expect(spy.mock.calls.map(([line]) => line)).toEqual([
            "[1/38] GB0004544929 ITB.DE prepare:start",
            "[1/38] GB0004544929 ITB.DE prepare:ok rows=1 currency=EUR latest=2026-06-08 elapsed=1.2s",
            "[1/38] GB0004544929 ITB.DE replace:start",
            "[1/38] GB0004544929 ITB.DE replace:ok deleted=10 inserted=20 latest=2026-06-08 elapsed=900ms",
            "[1/38] GB0004544929 ITB.DE failed stage=prepare_history code=provider_timeout reason=timed out elapsed=400ms",
        ]);
        spy.mockRestore();
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
