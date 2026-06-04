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
    MarketDataRepositoryError,
    replacePrimaryMappingPriceHistory,
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
                    asset_id: "asset-1",
                    provider: "yfinance",
                    symbol: "BMW.DE",
                    currency: "EUR",
                    isin: "US0000000001",
                }],
            })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ rowCount: 8 })
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
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

        expect(clientQuery.mock.calls[4]?.[0]).toContain("delete from asset_daily_prices");
        expect(clientQuery.mock.calls[5]?.[0]).toContain("insert into asset_daily_prices");
        expect(clientQuery.mock.calls[5]?.[0]).not.toContain("inactive");
        expect(clientQuery.mock.calls[5]?.[0]).not.toContain("soft");
    });
});
