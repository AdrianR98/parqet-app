import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/market-data/db/admin-requests", () => ({
    getAdminMarketDataRequests: vi.fn(),
}));

import { getAdminMarketDataRequests } from "../../src/lib/market-data/db/admin-requests";
import { GET } from "../../src/app/api/admin/market-data/requests/route";

describe("admin market data requests route", () => {
    const originalAdminEnabled = process.env.ADMIN_ENABLED;

    afterEach(() => {
        process.env.ADMIN_ENABLED = originalAdminEnabled;
        vi.resetAllMocks();
    });

    it("denies details when admin is disabled", async () => {
        process.env.ADMIN_ENABLED = "false";

        const response = await GET(new Request("http://localhost/api/admin/market-data/requests"));
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload).toEqual({ error: "Unauthorized" });
        expect(getAdminMarketDataRequests).not.toHaveBeenCalled();
    });

    it("returns bounded payload when admin is enabled", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminMarketDataRequests).mockResolvedValue({
            total: 1,
            shown: 1,
            limit: 50,
            filters: { status: null, source: null, q: null },
            items: [{
                isin: "US0000000001",
                displayName: "Acme Inc",
                name: "Acme",
                assetType: "stock",
                currency: "USD",
                wkn: null,
                status: "pending",
                source: "runtime_asset_discovery",
                firstSeenAt: "2026-05-25T00:00:00.000Z",
                lastSeenAt: "2026-05-25T00:00:00.000Z",
                seenCount: 1,
                notes: null,
            }],
        });

        const response = await GET(new Request("http://localhost/api/admin/market-data/requests?limit=50"));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload.shown).toBe(1);
        expect(getAdminMarketDataRequests).toHaveBeenCalledWith({
            limit: "50",
            status: null,
            source: null,
            q: null,
        });
    });

    it("returns generic error on helper failure", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminMarketDataRequests).mockRejectedValue(new Error("db"));

        const response = await GET(new Request("http://localhost/api/admin/market-data/requests"));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload).toEqual({ error: "Market data requests unavailable." });
    });
});
