import { describe, expect, it } from "vitest";

import {
    buildEurPrimaryResolutionPlan,
    classifyEurCandidateTier,
} from "../../src/lib/market-data/resolve-eur-primary";
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
        exchange: "LSE",
        currency: "GBp",
        isPrimary: false,
        isActive: true,
        verifiedAt: "2026-06-04T00:00:00.000Z",
        notes: null,
        providerPriceRowCount: 0,
        providerLatestPriceDate: null,
        ...overrides,
    };
}

function reference(overrides: Partial<DbMarketReferenceInstrument>): DbMarketReferenceInstrument {
    return {
        id: "ref-1",
        sourceKey: "openfigi",
        isin: "DE0000000001",
        wkn: null,
        name: "Demo Asset",
        symbol: "DEMO.F",
        mnemonic: null,
        exchange: "FRA",
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

describe("resolve EUR primary plan", () => {
    it("keeps verified EUR primaries as already complete", () => {
        const plan = buildEurPrimaryResolutionPlan({
            instruments: [instrument({ isin: "NL0000000001", id: "asset-eur-verified" })],
            mappings: [
                mapping({
                    assetId: "asset-eur-verified",
                    isin: "NL0000000001",
                    mappingId: "eur-primary-verified",
                    symbol: "UNA.AS",
                    exchange: "Amsterdam",
                    currency: "EUR",
                    isPrimary: true,
                    verifiedAt: "2026-06-08T10:00:00.000Z",
                }),
            ],
        });

        expect(plan.items[0]).toMatchObject({
            status: "already_eur_primary",
            reason: "already_eur_primary",
        });
    });

    it("treats unverified EUR primaries as repair candidates instead of already complete", () => {
        const plan = buildEurPrimaryResolutionPlan({
            instruments: [instrument({ isin: "GB00B10RZP78", id: "asset-unilever", displayName: "Unilever" })],
            mappings: [
                mapping({
                    assetId: "asset-unilever",
                    isin: "GB00B10RZP78",
                    mappingId: "una-primary-unverified",
                    symbol: "UNA.AS",
                    exchange: "Amsterdam",
                    currency: "EUR",
                    isPrimary: true,
                    verifiedAt: null,
                }),
                mapping({
                    assetId: "asset-unilever",
                    isin: "GB00B10RZP78",
                    mappingId: "ulvr-l-verified",
                    symbol: "ULVR.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: false,
                    verifiedAt: "2026-06-08T10:00:00.000Z",
                }),
            ],
        });

        expect(plan.currentEurPrimaries).toBe(0);
        expect(plan.currentNonEurPrimaries).toBe(0);
        expect(plan.items[0]).toMatchObject({
            status: "manual_review",
            reason: "unverified_eur_primary",
            selectedCandidate: expect.objectContaining({
                symbol: "UNA.AS",
                mappingId: "una-primary-unverified",
                verified: false,
            }),
            candidateTier: "other_eur_fallback",
        });
        expect(plan.items[0]?.proposalCandidates).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    symbol: "UNA.AS",
                    mappingId: "una-primary-unverified",
                }),
            ]),
        );
    });

    it("prefers verified .DE candidates over German fallback candidates", () => {
        const plan = buildEurPrimaryResolutionPlan({
            instruments: [instrument({ isin: "GB0000000001", id: "asset-1" })],
            mappings: [
                mapping({
                    assetId: "asset-1",
                    isin: "GB0000000001",
                    mappingId: "old-primary",
                    symbol: "IMB.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: true,
                }),
                mapping({
                    assetId: "asset-1",
                    isin: "GB0000000001",
                    mappingId: "fallback-f",
                    symbol: "IMB.F",
                    exchange: "FRA",
                    currency: "EUR",
                }),
                mapping({
                    assetId: "asset-1",
                    isin: "GB0000000001",
                    mappingId: "preferred-de",
                    symbol: "ITB.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                }),
            ],
        });

        expect(plan.autoResolvableCandidates).toBe(1);
        expect(plan.deCandidates).toBe(1);
        expect(plan.items.find((item) => item.isin === "GB0000000001")).toMatchObject({
            status: "auto_resolvable",
            candidateTier: "de",
            selectedCandidate: expect.objectContaining({ symbol: "ITB.DE" }),
        });
    });

    it("selects German EUR fallback when no .DE candidate exists", () => {
        const plan = buildEurPrimaryResolutionPlan({
            instruments: [instrument({ isin: "GB0000000002", id: "asset-2" })],
            mappings: [
                mapping({
                    assetId: "asset-2",
                    isin: "GB0000000002",
                    mappingId: "old-primary",
                    symbol: "FOO.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: true,
                }),
                mapping({
                    assetId: "asset-2",
                    isin: "GB0000000002",
                    mappingId: "fallback-f",
                    symbol: "FOO.F",
                    exchange: "FRA",
                    currency: "EUR",
                }),
                mapping({
                    assetId: "asset-2",
                    isin: "GB0000000002",
                    mappingId: "fallback-eu",
                    symbol: "FOO.AS",
                    exchange: "AEX",
                    currency: "EUR",
                }),
            ],
        });

        expect(plan.germanEurFallbackCandidates).toBe(1);
        expect(plan.items.find((item) => item.isin === "GB0000000002")?.selectedCandidate?.symbol).toBe("FOO.F");
    });

    it("selects other EUR fallback only when no German EUR fallback exists", () => {
        const plan = buildEurPrimaryResolutionPlan({
            instruments: [instrument({ isin: "GB0000000003", id: "asset-3" })],
            mappings: [
                mapping({
                    assetId: "asset-3",
                    isin: "GB0000000003",
                    mappingId: "old-primary",
                    symbol: "BAR.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: true,
                }),
                mapping({
                    assetId: "asset-3",
                    isin: "GB0000000003",
                    mappingId: "fallback-eu",
                    symbol: "BAR.AS",
                    exchange: "AEX",
                    currency: "EUR",
                }),
            ],
        });

        expect(plan.otherEurFallbackCandidates).toBe(1);
        expect(plan.items.find((item) => item.isin === "GB0000000003")).toMatchObject({
            candidateTier: "other_eur_fallback",
            selectedCandidate: expect.objectContaining({ symbol: "BAR.AS" }),
        });
    });

    it("does not select non-EUR proposals from reference data", () => {
        const references = new Map<string, DbMarketReferenceInstrument[]>();
        references.set("GB0000000004", [
            reference({
                isin: "GB0000000004",
                symbol: "BAZ.L",
                exchange: "LSE",
                currency: "GBp",
            }),
        ]);

        const plan = buildEurPrimaryResolutionPlan({
            instruments: [instrument({ isin: "GB0000000004", id: "asset-4" })],
            mappings: [
                mapping({
                    assetId: "asset-4",
                    isin: "GB0000000004",
                    mappingId: "old-primary",
                    symbol: "BAZ.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: true,
                }),
            ],
            referenceCandidatesByIsin: references,
        });

        expect(plan.manualReviewCases).toBe(1);
        expect(plan.items.find((item) => item.isin === "GB0000000004")).toMatchObject({
            status: "manual_review",
            reason: "no_candidate",
        });
    });

    it("classifies Shell-like ownership conflicts as manual review", () => {
        const plan = buildEurPrimaryResolutionPlan({
            instruments: [
                instrument({ isin: "GB00BP6MXD84", id: "asset-shell", displayName: "Shell plc" }),
                instrument({ isin: "GB00B03MLX29", id: "asset-owner", displayName: "Legacy Shell" }),
            ],
            mappings: [
                mapping({
                    assetId: "asset-shell",
                    isin: "GB00BP6MXD84",
                    mappingId: "shell-primary",
                    symbol: "SHEL.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: true,
                }),
                mapping({
                    assetId: "asset-owner",
                    isin: "GB00B03MLX29",
                    mappingId: "owner-primary",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                    isPrimary: true,
                }),
                mapping({
                    assetId: "asset-shell",
                    isin: "GB00BP6MXD84",
                    mappingId: "shell-secondary-conflict",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                    isPrimary: false,
                }),
            ],
        });

        expect(plan.items.find((item) => item.isin === "GB00BP6MXD84")).toMatchObject({
            status: "manual_review",
            reason: "symbol_owned_by_other_asset",
            selectedCandidate: expect.objectContaining({
                symbol: "R6C0.DE",
                ownerIsin: "GB00B03MLX29",
                hasOwnershipConflict: true,
            }),
        });
    });

    it("classifies conflicting reference-only proposals as manual review", () => {
        const references = new Map<string, DbMarketReferenceInstrument[]>();
        references.set("GB00BP6MXD84", [
            reference({
                isin: "GB00BP6MXD84",
                sourceKey: "openfigi",
                symbol: "R6C0.DE",
                exchange: "XETRA",
                currency: "EUR",
            }),
        ]);

        const plan = buildEurPrimaryResolutionPlan({
            instruments: [
                instrument({ isin: "GB00BP6MXD84", id: "asset-shell", displayName: "Shell plc" }),
                instrument({ isin: "GB00B03MLX29", id: "asset-owner", displayName: "Legacy Shell" }),
            ],
            mappings: [
                mapping({
                    assetId: "asset-shell",
                    isin: "GB00BP6MXD84",
                    mappingId: "shell-primary",
                    symbol: "SHEL.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: true,
                }),
                mapping({
                    assetId: "asset-owner",
                    isin: "GB00B03MLX29",
                    mappingId: "owner-primary",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                    isPrimary: true,
                }),
            ],
            referenceCandidatesByIsin: references,
        });

        expect(plan.items.find((item) => item.isin === "GB00BP6MXD84")).toMatchObject({
            status: "manual_review",
            reason: "symbol_owned_by_other_asset",
            selectedCandidate: expect.objectContaining({
                symbol: "R6C0.DE",
                ownerIsin: "GB00B03MLX29",
            }),
        });
    });

    it("counts existing EUR primaries separately from remaining non-EUR primaries", () => {
        const plan = buildEurPrimaryResolutionPlan({
            instruments: [
                instrument({ isin: "DE0000000005", id: "asset-eur" }),
                instrument({ isin: "GB0000000005", id: "asset-gbp" }),
            ],
            mappings: [
                mapping({
                    assetId: "asset-eur",
                    isin: "DE0000000005",
                    mappingId: "eur-primary",
                    symbol: "AAA.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                    isPrimary: true,
                }),
                mapping({
                    assetId: "asset-gbp",
                    isin: "GB0000000005",
                    mappingId: "gbp-primary",
                    symbol: "AAA.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: true,
                }),
                mapping({
                    assetId: "asset-gbp",
                    isin: "GB0000000005",
                    mappingId: "gbp-fallback",
                    symbol: "AAA.F",
                    exchange: "FRA",
                    currency: "EUR",
                }),
            ],
        });

        expect(plan.totalPrimaryMappingsInspected).toBe(2);
        expect(plan.currentEurPrimaries).toBe(1);
        expect(plan.currentNonEurPrimaries).toBe(1);
    });

    it("classifies common German market suffixes", () => {
        expect(classifyEurCandidateTier("AAA.DE", "XETRA")).toBe("de");
        expect(classifyEurCandidateTier("AAA.F", "FRA")).toBe("german_eur_fallback");
        expect(classifyEurCandidateTier("AAA.AS", "AEX")).toBe("other_eur_fallback");
    });
});
