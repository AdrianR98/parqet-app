import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/market-data/db/admin-status", () => ({
    getAdminMarketDataStatus: vi.fn(),
}));

import { getAdminMarketDataStatus } from "../../src/lib/market-data/db/admin-status";
import { GET } from "../../src/app/api/admin/market-data/status/route";

describe("admin market data status route", () => {
    const originalAdminEnabled = process.env.ADMIN_ENABLED;

    afterEach(() => {
        process.env.ADMIN_ENABLED = originalAdminEnabled;
        vi.resetAllMocks();
    });

    it("denies status details when admin is disabled", async () => {
        process.env.ADMIN_ENABLED = "false";

        const response = await GET();
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(payload).toEqual({ error: "Unauthorized" });
        expect(getAdminMarketDataStatus).not.toHaveBeenCalled();
    });

    it("returns safe generic error when status loading fails", async () => {
        process.env.ADMIN_ENABLED = "true";
        vi.mocked(getAdminMarketDataStatus).mockRejectedValue(new Error("db down"));

        const response = await GET();
        const payload = await response.json();

        expect(response.status).toBe(500);
        expect(payload).toEqual({ error: "Market data status unavailable." });
    });
});
