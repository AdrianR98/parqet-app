import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/market-data/db/admin-runs", () => ({
    getAdminMarketDataRuns: vi.fn(),
}));

import { getAdminMarketDataRuns } from "../../src/lib/market-data/db/admin-runs";
import { GET } from "../../src/app/api/admin/market-data/runs/route";

describe("admin market runs route", () => {
    const originalAdminEnabled = process.env.ADMIN_ENABLED;

    afterEach(() => {
        process.env.ADMIN_ENABLED = originalAdminEnabled;
        vi.resetAllMocks();
    });

    it("denies details when admin is disabled", async () => {
        process.env.ADMIN_ENABLED = "false";

        const response = await GET(new Request("http://localhost/api/admin/market-data/runs"));
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload).toEqual({ error: "Unauthorized" });
        expect(getAdminMarketDataRuns).not.toHaveBeenCalled();
    });

    it("returns bounded payload when enabled", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminMarketDataRuns).mockResolvedValue({
            total: 1,
            shown: 1,
            limit: 25,
            filters: { status: null, runType: null, provider: null },
            items: [],
        });

        const response = await GET(new Request("http://localhost/api/admin/market-data/runs?limit=25"));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload.shown).toBe(1);
        expect(getAdminMarketDataRuns).toHaveBeenCalledWith({
            limit: "25",
            status: null,
            runType: null,
            provider: null,
        });
    });

    it("returns generic error on helper failure", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminMarketDataRuns).mockRejectedValue(new Error("db down"));

        const response = await GET(new Request("http://localhost/api/admin/market-data/runs"));
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(payload).toEqual({ error: "Market data runs overview unavailable." });
    });
});
