import { describe, expect, it } from "vitest";

import {
    buildDeCandidateDiscoveryPlan,
    classifyDeCandidateValidation,
    decideDeCandidateWriteAction,
} from "../../src/lib/market-data/discover-de-candidates";
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
        expect(preferPlan.switchCandidates[0]?.newPrimarySymbol).toBe("BMW.DE");
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
});
