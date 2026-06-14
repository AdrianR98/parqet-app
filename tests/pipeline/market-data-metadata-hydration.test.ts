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
    enrichMarketInstrumentsFromReferences,
    enrichMarketInstrumentsFromTradingUniverse,
    prepareInstrumentMetadataUpsert,
} from "../../src/lib/market-data/db/repository";

describe("market metadata preservation and hydration", () => {
    beforeEach(() => {
        queryMock.mockReset();
        withClientMock.mockReset();
        queryMock.mockResolvedValue({ rows: [] });
    });

    it("preserves existing metadata during sparse price-backfill upserts", () => {
        const prepared = prepareInstrumentMetadataUpsert(
            {
                name: "Realty Income",
                displayName: "Realty Income Corp.",
                assetType: "reit",
                currency: "USD",
                wkn: "899744",
                metadataSource: "trading_universe",
                nameSource: "trading_universe",
                displayNameSource: "trading_universe",
            },
            {
                isin: "US7561091049",
                currency: "EUR",
            },
        );

        expect(prepared).toEqual({
            name: "Realty Income",
            displayName: "Realty Income Corp.",
            assetType: "reit",
            currency: "USD",
            wkn: "899744",
            metadataSource: "trading_universe",
            nameSource: "trading_universe",
            displayNameSource: "trading_universe",
        });
    });

    it("ignores null, blank, zero, and ticker-like fallback metadata", () => {
        const prepared = prepareInstrumentMetadataUpsert(
            {
                name: "Main Street Capital",
                displayName: "Main Street Capital",
                assetType: "stock",
                currency: "USD",
                wkn: "A0X8Y3",
                metadataSource: "trading_universe",
                nameSource: "trading_universe",
                displayNameSource: "trading_universe",
            },
            {
                isin: "US56035L1044",
                name: "13M.F",
                displayName: "0",
                assetType: "",
                currency: null,
                wkn: "0",
                metadataSource: "",
                nameSource: null,
                displayNameSource: "0",
            },
        );

        expect(prepared).toEqual({
            name: "Main Street Capital",
            displayName: "Main Street Capital",
            assetType: "stock",
            currency: "USD",
            wkn: "A0X8Y3",
            metadataSource: "trading_universe",
            nameSource: "trading_universe",
            displayNameSource: "trading_universe",
        });
    });

    it("fills missing WKN and metadata fields from reference candidates", async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                instrument_id: "asset-1",
                isin: "US7561091049",
                instrument_name: null,
                instrument_asset_type: null,
                instrument_currency: null,
                instrument_wkn: null,
                reference_name: "Realty Income Corp.",
                reference_type: "stock",
                reference_currency: "EUR",
                reference_wkn: "899744",
            }],
        });

        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementation(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        const result = await enrichMarketInstrumentsFromReferences({
            isin: "US7561091049",
        });

        expect(result).toMatchObject({
            matched: 1,
            updated: 1,
            nameUpdates: 1,
            wknUpdates: 1,
            currencyUpdates: 1,
            assetTypeUpdates: 1,
        });
        expect(clientQuery.mock.calls[1]?.[0]).toContain("update assets");
        expect(clientQuery.mock.calls[1]?.[0]).toContain("wkn = $1");
        expect(clientQuery.mock.calls[1]?.[0]).toContain("currency = $2");
        expect(clientQuery.mock.calls[1]?.[0]).toContain("asset_type = $3");
    });

    it("hydrates missing display_name from trading_universe and is idempotent when metadata is already good", async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                isin: "US56035L1044",
                current_name: "13M.F",
                current_display_name: null,
                reference_name: "Main Street Capital",
            }],
        });

        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementationOnce(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        const first = await enrichMarketInstrumentsFromTradingUniverse({
            isin: "US56035L1044",
            setDisplayName: true,
        });

        expect(first).toMatchObject({
            matched: 1,
            updated: 1,
            nameUpdates: 1,
            displayNameUpdates: 1,
        });

        queryMock.mockResolvedValueOnce({
            rows: [{
                isin: "US56035L1044",
                current_name: "Main Street Capital",
                current_display_name: "Main Street Capital",
                reference_name: "Main Street Capital",
            }],
        });

        const secondClientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementationOnce(async (fn: (client: { query: typeof secondClientQuery }) => Promise<unknown>) => fn({ query: secondClientQuery }));

        const second = await enrichMarketInstrumentsFromTradingUniverse({
            isin: "US56035L1044",
            setDisplayName: true,
        });

        expect(second).toMatchObject({
            matched: 1,
            updated: 0,
            nameUpdates: 0,
            displayNameUpdates: 0,
            skippedExistingBetter: 1,
        });
    });
});
