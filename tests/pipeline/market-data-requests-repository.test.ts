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

import { recordMarketDataRequest, listMarketDataRequests, MarketDataRepositoryError } from "../../src/lib/market-data/db/repository";

describe("market data request repository", () => {
    beforeEach(() => {
        queryMock.mockReset();
        withClientMock.mockReset();
    });

    it("ignores invalid isin safely", async () => {
        const result = await recordMarketDataRequest({ isin: "bad" });
        expect(result).toBeNull();
        expect(withClientMock).not.toHaveBeenCalled();
    });

    it("records request idempotently and keeps status stable", async () => {
        const clientQuery = vi
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({
                rows: [{
                    id: "1",
                    isin: "US0000000001",
                    name: "Acme",
                    display_name: "Acme Inc",
                    asset_type: "stock",
                    currency: "USD",
                    wkn: "A1B2C3",
                    first_seen_at: "2026-05-25T00:00:00.000Z",
                    last_seen_at: "2026-05-25T00:01:00.000Z",
                    seen_count: 2,
                    status: "imported",
                    source: "runtime_asset_discovery",
                    notes: null,
                    created_at: "2026-05-25T00:00:00.000Z",
                    updated_at: "2026-05-25T00:01:00.000Z",
                }],
            })
            .mockResolvedValueOnce(undefined);
        withClientMock.mockImplementation(async (fn: (client: { query: typeof clientQuery }) => Promise<unknown>) => fn({ query: clientQuery }));

        const row = await recordMarketDataRequest({
            isin: "us0000000001",
            name: "Acme",
            displayName: "Acme Inc",
            assetType: "stock",
            currency: "usd",
            wkn: "a1b2c3",
        });

        expect(row?.isin).toBe("US0000000001");
        expect(row?.seenCount).toBe(2);
        const sql = clientQuery.mock.calls[2]?.[0] as string;
        expect(sql).toContain("seen_count = reference_data_request_logs.seen_count + 1");
        expect(sql).toContain("coalesce(reference_data_request_logs.name, excluded.name)");
        expect(sql).toContain("status in ('imported', 'ignored')");
    });

    it("lists requests with normalized limit and filters", async () => {
        queryMock.mockResolvedValue({
            rows: [{
                total: 1,
                id: "1",
                isin: "US0000000001",
                name: null,
                display_name: "Acme Inc",
                asset_type: "stock",
                currency: "USD",
                wkn: null,
                first_seen_at: "2026-05-25T00:00:00.000Z",
                last_seen_at: "2026-05-25T00:00:00.000Z",
                seen_count: 1,
                status: "pending",
                source: "runtime_asset_discovery",
                notes: null,
                created_at: "2026-05-25T00:00:00.000Z",
                updated_at: "2026-05-25T00:00:00.000Z",
            }],
        });

        const result = await listMarketDataRequests({ limit: 500, status: "pending", source: "runtime_asset_discovery", q: "Acme" });

        expect(result.total).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["pending", "runtime_asset_discovery", "%acme%", 200]);
    });

    it("rejects invalid status filter", async () => {
        await expect(listMarketDataRequests({ status: "bad" })).rejects.toBeInstanceOf(MarketDataRepositoryError);
    });
});
