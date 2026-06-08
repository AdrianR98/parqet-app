import { describe, expect, it } from "vitest";

import {
    buildZeroPlanWarning,
    classifyBackfillOutcome,
    parseArgs as parseBackfillArgs,
} from "../../scripts/backfill-primary-market-data.mjs";
import {
    buildProposalRows,
    getWriteModeGuardError,
    needsVerifiedPrimaryPromotion,
    parseArgs as parseResolveArgs,
} from "../../scripts/market-data-resolve-primary.mjs";
import { parseArgs as parseRebuildArgs } from "../../scripts/market-data-rebuild-prices.mjs";
import { buildEurPrimaryResolutionPlan } from "../../src/lib/market-data/resolve-eur-primary";

describe("market data operator commands", () => {
    it("parses resolve-primary validate mode", () => {
        const options = parseResolveArgs(["--validate", "--write", "--continue-on-error", "--isin", "GB00BP6MXD84"]);

        expect(options).toMatchObject({
            validate: true,
            write: true,
            continueOnError: true,
            help: false,
            isin: "GB00BP6MXD84",
        });
        expect(options.passthrough).toEqual(["--validate", "--write", "--continue-on-error", "--isin", "GB00BP6MXD84"]);
    });

    it("rejects resolve-primary write mode without explicit validation", () => {
        const dryWrite = parseResolveArgs(["--write"]);
        const validatedWrite = parseResolveArgs(["--validate", "--write"]);

        expect(getWriteModeGuardError(dryWrite)).toBe("db:market:resolve-primary refuses --write without --validate.");
        expect(getWriteModeGuardError(validatedWrite)).toBeNull();
    });

    it("parses rebuild-prices reset guard flags", () => {
        const options = parseRebuildArgs(["--write", "--reset-yfinance-prices", "--compact", "--continue-on-error"]);

        expect(options).toMatchObject({
            write: true,
            resetYfinancePrices: true,
            compact: true,
            continueOnError: true,
        });
        expect(options.passthrough).toEqual(["--write", "--compact", "--continue-on-error"]);
    });

    it("parses rebuild-prices filters for delegated dry-run", () => {
        const options = parseRebuildArgs(["--isin", "GB00BP6MXD84", "--exclude-isin", "US00206R1023", "--limit", "5"]);

        expect(options.isin).toBe("GB00BP6MXD84");
        expect(options.excludeIsins.has("US00206R1023")).toBe(true);
        expect(options.limit).toBe("5");
        expect(options.write).toBe(false);
    });

    it("parses backfill filters for resolve-primary style ownership", () => {
        const options = parseBackfillArgs(["--isin", "GB00B10RZP78", "--force"]);

        expect(options.isin).toBe("GB00B10RZP78");
        expect(options.force).toBe(true);
        expect(options.skipExisting).toBe(false);
    });

    it("reports a zero-plan warning for requested ISINs without a visible primary mapping", () => {
        expect(
            buildZeroPlanWarning({
                requestedIsin: "GB00B10RZP78",
                scannedPrimaryMappings: 0,
                provider: "yfinance",
            }),
        ).toEqual([
            "Warning:",
            "- requested ISIN: GB00B10RZP78",
            "- no verified active primary yfinance mapping found",
            "- possible asset_id/instrument_id ownership issue or missing verified primary",
        ]);

        expect(
            buildZeroPlanWarning({
                requestedIsin: "GB00B10RZP78",
                scannedPrimaryMappings: 1,
                provider: "yfinance",
            }),
        ).toBeNull();
    });

    it("reports a visible but unverified primary as wrong-owner-or-unverified", () => {
        expect(
            buildZeroPlanWarning({
                requestedIsin: "GB00B10RZP78",
                scannedPrimaryMappings: 0,
                provider: "yfinance",
                visiblePrimarySymbol: "UNA.AS",
            }),
        ).toEqual([
            "Warning:",
            "- requested ISIN: GB00B10RZP78",
            "- no verified active primary yfinance mapping found",
            "- primary_mapping_unverified_or_wrong_owner: visible_primary=UNA.AS",
        ]);
    });

    it("requires validated resolve-primary candidates to be stored as verified before switching", () => {
        expect(needsVerifiedPrimaryPromotion({ verified: false, mappingId: "existing-unverified" })).toBe(true);
        expect(needsVerifiedPrimaryPromotion({ verified: false, mappingId: null })).toBe(true);
        expect(needsVerifiedPrimaryPromotion({ verified: true, mappingId: "verified-row" })).toBe(false);
    });

    it("includes current unverified EUR primaries in validation proposal rows", () => {
        const plan = buildEurPrimaryResolutionPlan({
            instruments: [{
                id: "asset-unilever",
                isin: "GB00B10RZP78",
                name: "Unilever",
                displayName: "Unilever",
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
            }],
            mappings: [
                {
                    assetId: "asset-unilever",
                    isin: "GB00B10RZP78",
                    displayName: "Unilever",
                    marketDataStatus: "active",
                    mappingId: "una-primary-unverified",
                    provider: "yfinance",
                    symbol: "UNA.AS",
                    exchange: "Amsterdam",
                    currency: "EUR",
                    isPrimary: true,
                    isActive: true,
                    verifiedAt: null,
                    notes: null,
                    providerPriceRowCount: 0,
                    providerLatestPriceDate: null,
                },
            ],
        });

        expect(buildProposalRows(plan)).toEqual([
            expect.objectContaining({
                isin: "GB00B10RZP78",
                symbol: "UNA.AS",
                tier: "other_eur_fallback",
            }),
        ]);
    });

    it("includes manual EUR candidates in validation proposal rows for former no-candidate cases", () => {
        const plan = buildEurPrimaryResolutionPlan({
            instruments: [{
                id: "asset-bitfarms",
                isin: "CA09173B1076",
                name: "Bitfarms",
                displayName: "Bitfarms",
                assetType: "stock",
                currency: "CAD",
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
            }],
            mappings: [
                {
                    assetId: "asset-bitfarms",
                    isin: "CA09173B1076",
                    displayName: "Bitfarms",
                    marketDataStatus: "active",
                    mappingId: "bitfarms-primary",
                    provider: "yfinance",
                    symbol: "BITF",
                    exchange: "NASDAQ",
                    currency: "USD",
                    isPrimary: true,
                    isActive: true,
                    verifiedAt: "2026-06-04T00:00:00.000Z",
                    notes: null,
                    providerPriceRowCount: 0,
                    providerLatestPriceDate: null,
                },
            ],
            manualCandidatesByIsin: new Map([
                ["CA09173B1076", {
                    name: "Bitfarms",
                    candidates: ["1B2.F", "1B2.DU", "1B2.HM", "1B2.MU"],
                }],
            ]),
        });

        expect(buildProposalRows(plan)).toEqual([
            expect.objectContaining({
                isin: "CA09173B1076",
                symbol: "1B2.DU",
                sourceType: "manual_eur_candidate",
            }),
            expect.objectContaining({
                isin: "CA09173B1076",
                symbol: "1B2.F",
                sourceType: "manual_eur_candidate",
            }),
            expect.objectContaining({
                isin: "CA09173B1076",
                symbol: "1B2.HM",
                sourceType: "manual_eur_candidate",
            }),
            expect.objectContaining({
                isin: "CA09173B1076",
                symbol: "1B2.MU",
                sourceType: "manual_eur_candidate",
            }),
        ]);
    });

    it("skips validation proposal rows for manual-review-only blocked curated candidates", () => {
        const plan = buildEurPrimaryResolutionPlan({
            instruments: [{
                id: "asset-shell",
                isin: "GB00BP6MXD84",
                name: "Shell plc",
                displayName: "Shell plc",
                assetType: "stock",
                currency: "GBP",
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
            }, {
                id: "asset-owner",
                isin: "GB00B03MLX29",
                name: "Legacy Shell",
                displayName: "Legacy Shell",
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
            }],
            mappings: [
                {
                    assetId: "asset-shell",
                    isin: "GB00BP6MXD84",
                    displayName: "Shell plc",
                    marketDataStatus: "active",
                    mappingId: "shell-primary",
                    provider: "yfinance",
                    symbol: "SHEL.L",
                    exchange: "LSE",
                    currency: "GBp",
                    isPrimary: true,
                    isActive: true,
                    verifiedAt: "2026-06-04T00:00:00.000Z",
                    notes: null,
                    providerPriceRowCount: 0,
                    providerLatestPriceDate: null,
                },
                {
                    assetId: "asset-owner",
                    isin: "GB00B03MLX29",
                    displayName: "Legacy Shell",
                    marketDataStatus: "active",
                    mappingId: "owner-primary",
                    provider: "yfinance",
                    symbol: "R6C0.DE",
                    exchange: "XETRA",
                    currency: "EUR",
                    isPrimary: true,
                    isActive: true,
                    verifiedAt: "2026-06-04T00:00:00.000Z",
                    notes: null,
                    providerPriceRowCount: 0,
                    providerLatestPriceDate: null,
                },
            ],
            manualCandidatesByIsin: new Map([
                ["GB00BP6MXD84", {
                    name: "Shell",
                    manualReview: true,
                    manualReviewReason: "R6C0.DE ownership conflict with GB00B03MLX29",
                    candidates: ["SHELL.AS", "R6C0.DE", "R6C0.F", "R6C0.DU", "R6C0.HM", "R6C0.MU", "R6C0.SW"],
                }],
            ]),
        });

        expect(plan.items[0]?.validationBlocked).toBe(true);
        expect(buildProposalRows(plan)).toEqual([]);
    });

    it("reports partial backfill success when prices succeed but actions fail", () => {
        const outcome = classifyBackfillOutcome({
            row: { isin: "GB00B10RZP78", symbol: "UNA.AS" },
            pricesResult: { upserted: 1409 },
            actionsResult: { upserted: 0 },
            actionsError: new Error("action failed"),
            priceError: null,
        });

        expect(outcome).toMatchObject({
            priceSuccessCount: 1,
            priceFailedCount: 0,
            actionSuccessCount: 0,
            actionFailedCount: 1,
        });
        expect(outcome.message).toContain("Backfill teilweise erfolgreich");
        expect(outcome.message).toContain("prices=1409");
        expect(outcome.message).toContain("actions_failed=1");
    });

    it("reports full backfill success when prices and actions succeed", () => {
        const outcome = classifyBackfillOutcome({
            row: { isin: "GB00B10RZP78", symbol: "UNA.AS" },
            pricesResult: { upserted: 1409 },
            actionsResult: { upserted: 2 },
            actionsError: null,
            priceError: null,
        });

        expect(outcome).toMatchObject({
            priceSuccessCount: 1,
            priceFailedCount: 0,
            actionSuccessCount: 1,
            actionFailedCount: 0,
        });
        expect(outcome.message).toContain("Backfill erfolgreich");
        expect(outcome.message).toContain("actions=2");
    });

    it("reports price failures as failed backfills", () => {
        const outcome = classifyBackfillOutcome({
            row: { isin: "GB00B10RZP78", symbol: "UNA.AS" },
            pricesResult: null,
            actionsResult: null,
            actionsError: null,
            priceError: new Error("price failed"),
        });

        expect(outcome).toMatchObject({
            priceSuccessCount: 0,
            priceFailedCount: 1,
            actionSuccessCount: 0,
            actionFailedCount: 0,
        });
        expect(outcome.message).toContain("Backfill fehlgeschlagen");
    });
});
