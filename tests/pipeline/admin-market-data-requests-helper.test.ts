import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/market-data/db/repository", () => ({
    listMarketDataRequests: vi.fn(),
}));

import { listMarketDataRequests } from "../../src/lib/market-data/db/repository";
import {
    getAdminMarketDataRequests,
    sanitizeMarketDataRequestsFilters,
    sanitizeMarketDataRequestsLimit,
} from "../../src/lib/market-data/db/admin-requests";

describe("admin market data requests helper", () => {
    it("falls back to default limit when invalid", () => {
        expect(sanitizeMarketDataRequestsLimit("x")).toBe(50);
        expect(sanitizeMarketDataRequestsLimit("0")).toBe(50);
    });

    it("caps request limit", () => {
        expect(sanitizeMarketDataRequestsLimit("999")).toBe(200);
    });

    it("normalizes filters", () => {
        expect(sanitizeMarketDataRequestsFilters({ status: "PENDING", source: " Runtime_Asset_Discovery ", q: "  acme " })).toEqual({
            status: "pending",
            source: "runtime_asset_discovery",
            q: "acme",
        });
        expect(sanitizeMarketDataRequestsFilters({ status: "bad" })).toEqual({
            status: null,
            source: null,
            q: null,
        });
    });

    it("returns bounded payload", async () => {
        vi.mocked(listMarketDataRequests).mockResolvedValue({
            total: 1,
            items: [{
                id: "1",
                isin: "US0000000001",
                name: "Acme",
                displayName: "Acme Inc",
                assetType: "stock",
                currency: "USD",
                wkn: null,
                firstSeenAt: "2026-05-25T00:00:00.000Z",
                lastSeenAt: "2026-05-25T00:00:00.000Z",
                seenCount: 3,
                status: "pending",
                source: "runtime_asset_discovery",
                notes: null,
                createdAt: "2026-05-25T00:00:00.000Z",
                updatedAt: "2026-05-25T00:00:00.000Z",
            }],
        });

        const payload = await getAdminMarketDataRequests({ limit: "50", status: "pending", source: "runtime_asset_discovery", q: "acme" });

        expect(payload.total).toBe(1);
        expect(payload.shown).toBe(1);
        expect(payload.items[0]?.isin).toBe("US0000000001");
        expect(listMarketDataRequests).toHaveBeenCalledWith({
            limit: 50,
            status: "pending",
            source: "runtime_asset_discovery",
            q: "acme",
        });
    });
});
