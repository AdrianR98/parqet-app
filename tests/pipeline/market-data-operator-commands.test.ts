import { describe, expect, it } from "vitest";

import { buildZeroPlanWarning, parseArgs as parseBackfillArgs } from "../../scripts/backfill-primary-market-data.mjs";
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
});
