import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { queryMock, withClientMock } = vi.hoisted(() => ({
    queryMock: vi.fn(),
    withClientMock: vi.fn(),
}));

vi.mock("../../src/lib/db/postgres-core", () => ({
    PostgresConfigError: class PostgresConfigError extends Error {},
    queryPostgres: queryMock,
    withPostgresClient: withClientMock,
}));

import {
    buildDeCandidateDiscoveryPlan,
    classifyDeCandidateReportStatus,
    classifyDeCandidateValidation,
    decideDeCandidateWriteAction,
} from "../../src/lib/market-data/discover-de-candidates";
import { storeVerifiedSymbolMappingCandidate } from "../../src/lib/market-data/db/repository";
import { buildDePrimaryPreferencePlan } from "../../src/lib/market-data/prefer-de-primary";
import type {
    DbMarketInstrument,
    DbMarketReferenceInstrument,
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
        verifiedAt: null,
        notes: null,
        providerPriceRowCount: 0,
        providerLatestPriceDate: null,
        ...overrides,
    };
}

function reference(overrides: Partial<DbMarketReferenceInstrument>): DbMarketReferenceInstrument {
    return {
        id: "ref-1",
        sourceKey: "xetra_all_tradable_instruments",
        isin: "DE0000000001",
        wkn: "WKN123",
        name: "Demo Asset",
        symbol: null,
        mnemonic: "DEMO",
        exchange: "XETRA",
        micCode: null,
        primaryMarketMicCode: null,
        currency: "EUR",
        instrumentType: "stock",
        productCategory: null,
        marketSegment: null,
        rawPayload: null,
        importedAt: "2026-06-04T00:00:00.000Z",
        ...overrides,
    };
}

describe("discover .DE candidates", () => {
    beforeEach(() => {
        queryMock.mockReset();
        withClientMock.mockReset();
    });

    it("reports assets without verified .DE as missing candidate", () => {
        const plan = buildDeCandidateDiscoveryPlan([
            {
                assetId: "asset-1",
                isin: "US0000000001",
                wkn: "A1",
                displayName: "Demo Asset",
                marketDataStatus: "active",
                currentPrimarySymbol: "IMBBF",
                currentPrimaryExchange: "PNK",
                currentPrimaryCurrency: "USD",
                existingYfinanceMappings: [
                    mapping({
                        assetId: "asset-1",
                        isin: "US0000000001",
                        mappingId: "old-primary",
                        symbol: "IMBBF",
                        exchange: "PNK",
                        currency: "USD",
                        isPrimary: true,
                    }),
                ],
                referenceCandidates: [],
            },
        ]);

        expect(plan.assetsMissingDe).toBe(1);
        expect(plan.candidateProposalsFromReferenceData).toBe(0);
    });

    it("keeps reference-derived .DE proposals unverified until validation", () => {
        const plan = buildDeCandidateDiscoveryPlan([
            {
                assetId: "asset-1",
                isin: "US0000000002",
                wkn: "A2",
                displayName: "Demo Asset",
                marketDataStatus: "unknown",
                currentPrimarySymbol: "RYDAF",
                currentPrimaryExchange: "PNK",
                currentPrimaryCurrency: "USD",
                existingYfinanceMappings: [
                    mapping({
                        assetId: "asset-1",
                        isin: "US0000000002",
                        mappingId: "old-primary",
                        symbol: "RYDAF",
                        exchange: "PNK",
                        currency: "USD",
                        isPrimary: true,
                    }),
                ],
                referenceCandidates: [
                    reference({
                        isin: "US0000000002",
                        mnemonic: "BMW",
                        currency: "EUR",
                    }),
                ],
            },
        ]);

        expect(plan.actionableUnknownInspected).toBe(1);
        expect(plan.candidateProposalsFromReferenceData).toBe(1);
        expect(plan.items[0]?.proposals[0]).toMatchObject({
            symbol: "BMW.DE",
            verified: false,
        });
    });

    it("does not create verified mappings on write without validation", () => {
        const decision = decideDeCandidateWriteAction({
            write: true,
            validate: false,
        });

        expect(decision).toEqual({
            action: "store_unverified",
            reason: "write_without_validation",
        });
    });

    it("validated .DE candidates can be picked up by the prefer-de planner after storage", () => {
        const validationDecision = classifyDeCandidateValidation(
            {
                isin: "US0000000003",
                symbol: "BMW.DE",
                hasHistory: true,
                pointCount: 200,
                lastDate: "2026-06-03",
                latestClose: 100,
                currency: "EUR",
                error: null,
            },
            new Date("2026-06-04T00:00:00.000Z"),
        );
        expect(validationDecision.status).toBe("verified");

        const preferPlan = buildDePrimaryPreferencePlan({
            instruments: [instrument({ isin: "US0000000003", id: "asset-3", marketDataStatus: "unknown" })],
            mappings: [
                mapping({
                    assetId: "asset-3",
                    isin: "US0000000003",
                    mappingId: "old-primary",
                    symbol: "IMBBF",
                    exchange: "PNK",
                    currency: "USD",
                    isPrimary: true,
                    providerPriceRowCount: 30,
                }),
                mapping({
                    assetId: "asset-3",
                    isin: "US0000000003",
                    mappingId: "verified-de",
                    symbol: "BMW.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                    verifiedAt: "2026-06-04T00:00:00.000Z",
                }),
            ],
        });

        expect(preferPlan.switchCandidates).toHaveLength(1);
        expect(preferPlan.switchCandidates[0]).toMatchObject({
            newPrimarySymbol: "BMW.DE",
            isCurrencyFix: true,
            isVenueOnlySwitch: false,
        });
    });

    it("rejected or ambiguous validations are not promoted", () => {
        const rejected = classifyDeCandidateValidation(
            {
                isin: "US0000000004",
                symbol: "BMW.DE",
                hasHistory: false,
                pointCount: 0,
                lastDate: null,
                latestClose: null,
                currency: null,
                error: "no history",
            },
            new Date("2026-06-04T00:00:00.000Z"),
        );
        const ambiguous = classifyDeCandidateValidation(
            {
                isin: "US0000000004",
                symbol: "BMW.DE",
                hasHistory: true,
                pointCount: 30,
                lastDate: "2026-05-01",
                latestClose: 50,
                currency: null,
                error: null,
            },
            new Date("2026-06-04T00:00:00.000Z"),
        );

        expect(decideDeCandidateWriteAction({ write: true, validate: true, validationDecision: rejected }).action).toBe("none");
        expect(decideDeCandidateWriteAction({ write: true, validate: true, validationDecision: ambiguous }).action).toBe("none");
    });

    it("classifies verified candidate write results and same-symbol conflicts distinctly", () => {
        expect(
            classifyDeCandidateReportStatus({
                storeStatus: "written_verified",
            }),
        ).toBe("written_verified");

        expect(
            classifyDeCandidateReportStatus({
                storeStatus: "skipped_existing_other_asset",
            }),
        ).toBe("skipped_existing_other_asset");
    });

    it("reports rejected and ambiguous candidates separately when they are not written", () => {
        const rejected = classifyDeCandidateValidation(
            {
                isin: "US0000000005",
                symbol: "R6C0.DE",
                hasHistory: false,
                pointCount: 0,
                lastDate: null,
                latestClose: null,
                currency: "EUR",
                error: "missing history",
            },
            new Date("2026-06-04T00:00:00.000Z"),
        );
        const ambiguous = classifyDeCandidateValidation(
            {
                isin: "US0000000006",
                symbol: "R6C0.DE",
                hasHistory: true,
                pointCount: 20,
                lastDate: "2026-05-01",
                latestClose: 65,
                currency: "EUR",
                error: null,
            },
            new Date("2026-06-04T00:00:00.000Z"),
        );

        expect(classifyDeCandidateReportStatus({ validationDecision: rejected })).toBe("rejected");
        expect(classifyDeCandidateReportStatus({ validationDecision: ambiguous })).toBe("ambiguous");
    });

    it("writes a validated .DE candidate as verified for the same asset", async () => {
        queryMock
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({
                rows: [{
                    id: "mapping-written",
                    instrument_id: "asset-validated",
                    provider: "yfinance",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                    is_primary: false,
                    is_active: true,
                    verified_at: "2026-06-04T10:00:00.000Z",
                    notes: "validated",
                    created_at: "2026-06-04T10:00:00.000Z",
                    updated_at: "2026-06-04T10:00:00.000Z",
                }],
            });

        const result = await storeVerifiedSymbolMappingCandidate({
            instrumentId: "asset-validated",
            provider: "yfinance",
            symbol: "R6C0.DE",
            exchange: "XETRA",
            currency: "EUR",
            notes: "validated",
        });

        expect(result).toMatchObject({
            status: "written_verified",
            reason: "inserted_verified_mapping",
            mappingId: "mapping-written",
        });

        const insertSql = queryMock.mock.calls[1]?.[0] as string;
        const insertParams = queryMock.mock.calls[1]?.[1] as unknown[];
        expect(insertSql).toContain("(asset_id, instrument_id, provider, provider_symbol, symbol");
        expect(insertParams[0]).toBe("asset-validated");
        expect(insertParams[2]).toBe("R6C0.DE");
    });

    it("reports symbol conflicts with another asset and does not write them", async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                id: "mapping-conflict",
                owner_asset_id: "asset-other",
                owner_isin: "GB00B03MLX29",
                owner_display_name: "Other Asset",
                verified_at: "2026-06-04T09:00:00.000Z",
                notes: "existing owner",
            }],
        });

        const result = await storeVerifiedSymbolMappingCandidate({
            instrumentId: "asset-shell",
            provider: "yfinance",
            symbol: "R6C0.DE",
            exchange: "XETRA",
            currency: "EUR",
            notes: "validated",
        });

        expect(result).toEqual({
            status: "skipped_existing_other_asset",
            reason: "symbol_conflict_other_asset",
            mappingId: null,
            verifiedAt: null,
            conflictAssetId: "asset-other",
            conflictIsin: "GB00B03MLX29",
            conflictDisplayName: "Other Asset",
        });
        expect(queryMock).toHaveBeenCalledTimes(1);
    });
});
