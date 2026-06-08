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
    listPrimaryMappingsForBackfill,
    MarketDataRepositoryError,
    replacePrimaryMappingPriceHistory,
    setPrimarySymbolMappingById,
    setPrimarySymbolMappingByIsin,
} from "../../src/lib/market-data/db/repository";

describe("replace primary mapping price history", () => {
    beforeEach(() => {
        queryMock.mockReset();
        withClientMock.mockReset();
    });

    it("rejects empty replacement history", async () => {
        await expect(
            replacePrimaryMappingPriceHistory({
                isin: "US0000000001",
                provider: "yfinance",
                targetMappingId: "mapping-1",
                replacementPoints: [],
            }),
        ).rejects.toBeInstanceOf(MarketDataRepositoryError);
    });

    it("deletes old asset_daily_prices rows before inserting replacement history", async () => {
        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                rows: [{
                    id: "mapping-1",
                    owner_asset_id: "instrument-1",
                    provider: "yfinance",
                    symbol: "BMW.DE",
                    currency: "EUR",
                    isin: "US0000000001",
                }],
            })
            .mockResolvedValueOnce({ rows: [{ id: "asset-1" }] })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ is_primary: true }] })
            .mockResolvedValueOnce({ rowCount: 8 })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rows: [{ inserted_count: 2 }] })
            .mockResolvedValueOnce({ rows: [{ latest_price_date: "2026-06-03" }] })
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementation(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        const result = await replacePrimaryMappingPriceHistory({
            isin: "US0000000001",
            provider: "yfinance",
            targetMappingId: "mapping-1",
            replacementCurrency: "EUR",
            replacementPoints: [
                { date: "2026-06-02", close: 101.5, currency: "EUR" },
                { date: "2026-06-03", close: 102.5, currency: "EUR" },
            ],
        });

        expect(result).toMatchObject({
            deletedPriceRows: 8,
            insertedPriceRows: 2,
            latestPriceDate: "2026-06-03",
        });

        expect(clientQuery.mock.calls[6]?.[0]).toContain("delete from asset_daily_prices");
        expect(clientQuery.mock.calls[7]?.[0]).toContain("insert into asset_daily_prices");
        expect(clientQuery.mock.calls[7]?.[0]).not.toContain("inactive");
        expect(clientQuery.mock.calls[7]?.[0]).not.toContain("soft");
    });

    it("uses instrument_id fallback when the target mapping has no asset_id", async () => {
        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                rows: [{
                    id: "mapping-1",
                    owner_asset_id: "instrument-1",
                    provider: "yfinance",
                    symbol: "BMW.DE",
                    currency: "EUR",
                    isin: "US0000000001",
                }],
            })
            .mockResolvedValueOnce({ rows: [{ id: "asset-1" }] })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ is_primary: true }] })
            .mockResolvedValueOnce({ rowCount: 8 })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rows: [{ inserted_count: 1 }] })
            .mockResolvedValueOnce({ rows: [{ latest_price_date: "2026-06-03" }] })
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementation(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        const result = await replacePrimaryMappingPriceHistory({
            isin: "US0000000001",
            provider: "yfinance",
            targetMappingId: "mapping-1",
            replacementCurrency: "EUR",
            replacementPoints: [
                { date: "2026-06-03", close: 102.5, currency: "EUR" },
            ],
        });

        expect(result).toMatchObject({
            deletedPriceRows: 8,
            insertedPriceRows: 1,
            latestPriceDate: "2026-06-03",
        });
        expect(clientQuery.mock.calls[1]?.[0]).toContain("coalesce(m.asset_id, m.instrument_id)");
        expect(clientQuery.mock.calls[2]?.[1]).toEqual(["US0000000001"]);
        expect(clientQuery.mock.calls[6]?.[1]).toEqual(["asset-1", "yfinance"]);
    });

    it("fails with a precise latest-price verification message", async () => {
        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                rows: [{
                    id: "mapping-1",
                    owner_asset_id: "instrument-1",
                    provider: "yfinance",
                    symbol: "BMW.DE",
                    currency: "EUR",
                    isin: "US0000000001",
                }],
            })
            .mockResolvedValueOnce({ rows: [{ id: "asset-1" }] })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ is_primary: true }] })
            .mockResolvedValueOnce({ rowCount: 8 })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rows: [{ inserted_count: 1 }] })
            .mockResolvedValueOnce({ rows: [{ latest_price_date: "2026-06-02" }] })
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementation(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        await expect(
            replacePrimaryMappingPriceHistory({
                isin: "US0000000001",
                provider: "yfinance",
                targetMappingId: "mapping-1",
                replacementCurrency: "EUR",
                replacementPoints: [
                    { date: "2026-06-03", close: 102.5, currency: "EUR" },
                ],
            }),
        ).rejects.toThrow(/Latest-Price-Verifikation fehlgeschlagen/);
    });

    it("normalizes DB date objects without timezone drift during latest-price verification", async () => {
        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                rows: [{
                    id: "mapping-1",
                    owner_asset_id: "instrument-1",
                    provider: "yfinance",
                    symbol: "BMW.DE",
                    currency: "EUR",
                    isin: "US0000000001",
                }],
            })
            .mockResolvedValueOnce({ rows: [{ id: "asset-1" }] })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ is_primary: true }] })
            .mockResolvedValueOnce({ rowCount: 8 })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rows: [{ inserted_count: 1 }] })
            .mockResolvedValueOnce({ rows: [{ latest_price_date: new Date(2026, 5, 8, 0, 0, 0) }] })
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementation(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        const result = await replacePrimaryMappingPriceHistory({
            isin: "US0000000001",
            provider: "yfinance",
            targetMappingId: "mapping-1",
            replacementCurrency: "EUR",
            replacementPoints: [
                { date: "2026-06-08T00:00:00+02:00", close: 102.5, currency: "EUR" },
            ],
        });

        expect(result.latestPriceDate).toBe("2026-06-08");
    });

    it("fails clearly when the target primary mapping cannot be set", async () => {
        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rowCount: 0 })
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementation(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        await expect(
            setPrimarySymbolMappingByIsin("US0000000001", "yfinance", "BMW.DE"),
        ).rejects.toBeInstanceOf(MarketDataRepositoryError);
    });

    it("sets the exact verified mapping id as primary", async () => {
        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                rows: [{
                    id: "mapping-verified",
                    owner_asset_id: "asset-1",
                    isin: "US0000000001",
                    provider: "yfinance",
                    is_active: true,
                    verified_at: "2026-06-08T10:00:00.000Z",
                }],
            })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ is_primary: true, verified_at: "2026-06-08T10:00:00.000Z" }] })
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementation(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        await setPrimarySymbolMappingById("mapping-verified", "yfinance", "US0000000001", "note");

        expect(clientQuery.mock.calls[1]?.[0]).toContain("where m.id = $1");
        expect(clientQuery.mock.calls[2]?.[1]).toEqual(["asset-1", "yfinance"]);
        expect(clientQuery.mock.calls[3]?.[1]).toEqual(["mapping-verified", "note"]);
    });

    it("rejects unverified target mappings for exact primary switching", async () => {
        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                rows: [{
                    id: "mapping-unverified",
                    owner_asset_id: "asset-1",
                    isin: "US0000000001",
                    provider: "yfinance",
                    is_active: true,
                    verified_at: null,
                }],
            })
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementation(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        await expect(
            setPrimarySymbolMappingById("mapping-unverified", "yfinance", "US0000000001"),
        ).rejects.toBeInstanceOf(MarketDataRepositoryError);
    });

    it("resolves symbol-based primary switching through an exact verified mapping row", async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{ id: "mapping-verified" }],
        });

        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                rows: [{
                    id: "mapping-verified",
                    owner_asset_id: "asset-1",
                    isin: "US0000000001",
                    provider: "yfinance",
                    is_active: true,
                    verified_at: "2026-06-08T10:00:00.000Z",
                }],
            })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ is_primary: true, verified_at: "2026-06-08T10:00:00.000Z" }] })
            .mockResolvedValueOnce(undefined);

        withClientMock.mockImplementation(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        await setPrimarySymbolMappingByIsin("US0000000001", "yfinance", "BMW.DE");

        expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("m.verified_at is not null"), ["US0000000001", "yfinance", "BMW.DE"]);
        expect(clientQuery.mock.calls[3]?.[1]).toEqual(["mapping-verified", null]);
    });

    it("lists backfill primaries through asset_id ownership", async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                isin: "GB00B10RZP78",
                name: "Unilever",
                provider: "yfinance",
                symbol: "UNA.AS",
                exchange: "AMS",
                currency: "EUR",
                has_prices: true,
                has_actions: false,
                verified_at: "2026-06-08T10:00:00.000Z",
            }],
        });

        const result = await listPrimaryMappingsForBackfill("yfinance", "GB00B10RZP78");

        expect(result).toEqual([
            expect.objectContaining({
                isin: "GB00B10RZP78",
                symbol: "UNA.AS",
                exchange: "AMS",
                currency: "EUR",
                hasPrices: true,
                hasActions: false,
            }),
        ]);
        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining("join assets i on i.id = coalesce(m.asset_id, m.instrument_id)"),
            ["yfinance", "GB00B10RZP78"],
        );
    });

    it("lists backfill primaries through instrument_id ownership", async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{
                isin: "US0000000001",
                name: "Demo Asset",
                provider: "yfinance",
                symbol: "BMW.DE",
                exchange: "XETRA",
                currency: "EUR",
                has_prices: false,
                has_actions: true,
                verified_at: "2026-06-08T10:00:00.000Z",
            }],
        });

        const result = await listPrimaryMappingsForBackfill("yfinance", "US0000000001");

        expect(result).toEqual([
            expect.objectContaining({
                isin: "US0000000001",
                symbol: "BMW.DE",
                hasPrices: false,
                hasActions: true,
            }),
        ]);
        expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["yfinance", "US0000000001"]);
    });
});
