import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/market-data/db/admin-instruments", () => ({
    getAdminMarketInstruments: vi.fn(),
}));

import { getAdminMarketInstruments } from "../../src/lib/market-data/db/admin-instruments";
import { GET } from "../../src/app/api/admin/market-data/instruments/route";

describe("admin market instruments route", () => {
    const originalAdminEnabled = process.env.ADMIN_ENABLED;

    afterEach(() => {
        process.env.ADMIN_ENABLED = originalAdminEnabled;
        vi.resetAllMocks();
    });

    it("denies details when admin is disabled", async () => {
        process.env.ADMIN_ENABLED = "false";

        const response = await GET(new Request("http://localhost/api/admin/market-data/instruments"));
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload).toEqual({ error: "Unauthorized" });
        expect(getAdminMarketInstruments).not.toHaveBeenCalled();
    });

    it("returns bounded payload when enabled", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminMarketInstruments).mockResolvedValue({
            total: 1,
            shown: 1,
            limit: 50,
            filters: { q: null, status: null, assetType: null, hasPrimary: null, hasPrices: null },
            items: [],
        });

        const response = await GET(new Request("http://localhost/api/admin/market-data/instruments?limit=50"));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload.shown).toBe(1);
        expect(getAdminMarketInstruments).toHaveBeenCalledWith({
            limit: "50",
            q: null,
            status: null,
            assetType: null,
            hasPrimary: null,
            hasPrices: null,
        });
    });

    it("returns generic error on helper failure", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminMarketInstruments).mockRejectedValue(new Error("db down"));

        const response = await GET(new Request("http://localhost/api/admin/market-data/instruments"));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload).toEqual({ error: "Market instruments overview unavailable." });
    });
});
