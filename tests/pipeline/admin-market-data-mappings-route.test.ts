import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/market-data/db/admin-mappings", () => ({
    getAdminMarketSymbolMappings: vi.fn(),
}));

import { getAdminMarketSymbolMappings } from "../../src/lib/market-data/db/admin-mappings";
import { GET } from "../../src/app/api/admin/market-data/mappings/route";

describe("admin market mappings route", () => {
    const originalAdminEnabled = process.env.ADMIN_ENABLED;

    afterEach(() => {
        process.env.ADMIN_ENABLED = originalAdminEnabled;
        vi.resetAllMocks();
    });

    it("denies details when admin is disabled", async () => {
        process.env.ADMIN_ENABLED = "false";
        const response = await GET(new Request("http://localhost/api/admin/market-data/mappings"));
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload).toEqual({ error: "Unauthorized" });
        expect(getAdminMarketSymbolMappings).not.toHaveBeenCalled();
    });

    it("returns bounded payload when enabled", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminMarketSymbolMappings).mockResolvedValue({
            total: 1,
            shown: 1,
            limit: 50,
            filters: { q: null, provider: null, verified: null, primary: null, active: null, hasPrices: null },
            items: [],
        });

        const response = await GET(new Request("http://localhost/api/admin/market-data/mappings?limit=50"));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload.shown).toBe(1);
        expect(getAdminMarketSymbolMappings).toHaveBeenCalledWith({
            limit: "50",
            q: null,
            provider: null,
            verified: null,
            primary: null,
            active: null,
            hasPrices: null,
        });
    });

    it("returns generic error on helper failure", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminMarketSymbolMappings).mockRejectedValue(new Error("db down"));

        const response = await GET(new Request("http://localhost/api/admin/market-data/mappings"));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload).toEqual({ error: "Market symbol mappings overview unavailable." });
    });
});
