import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/market-data/db/repository", () => ({
    listAdminMarketDataRunOverviewRows: vi.fn(),
}));

import { listAdminMarketDataRunOverviewRows } from "../../src/lib/market-data/db/repository";
import {
    getAdminMarketDataRuns,
    sanitizeRunsFilters,
    sanitizeRunsLimit,
} from "../../src/lib/market-data/db/admin-runs";

describe("admin market runs helper", () => {
    it("falls back to default limit when invalid", () => {
        expect(sanitizeRunsLimit("bad")).toBe(25);
        expect(sanitizeRunsLimit("0")).toBe(25);
    });

    it("caps limit", () => {
        expect(sanitizeRunsLimit("500")).toBe(100);
    });

    it("maps rows to safe payload", async () => {
        vi.mocked(listAdminMarketDataRunOverviewRows).mockResolvedValue([
            {
                id: "r1",
                runType: "incremental",
                status: "completed",
                provider: "yfinance",
                startedAt: "2026-01-01T00:00:00.000Z",
                finishedAt: "2026-01-01T00:01:00.000Z",
                durationMs: 60000,
                totalItems: 2,
                succeededItems: 1,
                failedItems: 1,
                skippedItems: 0,
                errorCount: 1,
                latestErrorMessage: "db=postgres://secret@host/db timeout",
            },
        ]);

        const payload = await getAdminMarketDataRuns({ limit: "10" });

        expect(payload.total).toBe(1);
        expect(payload.shown).toBe(1);
        expect(payload.limit).toBe(10);
        expect(payload.items[0]).toMatchObject({
            id: "r1",
            requestedBy: null,
            errorCount: 1,
        });
        expect(payload.items[0].latestErrorMessage).not.toContain("postgres://");
    });

    it("applies filters", async () => {
        vi.mocked(listAdminMarketDataRunOverviewRows).mockResolvedValue([
            {
                id: "r1",
                runType: "incremental",
                status: "completed",
                provider: "yfinance",
                startedAt: null,
                finishedAt: null,
                durationMs: null,
                totalItems: 0,
                succeededItems: 0,
                failedItems: 0,
                skippedItems: 0,
                errorCount: 0,
                latestErrorMessage: null,
            },
            {
                id: "r2",
                runType: "backfill",
                status: "failed",
                provider: "other",
                startedAt: null,
                finishedAt: null,
                durationMs: null,
                totalItems: 0,
                succeededItems: 0,
                failedItems: 0,
                skippedItems: 0,
                errorCount: 0,
                latestErrorMessage: null,
            },
        ]);

        const payload = await getAdminMarketDataRuns({ status: "failed", runType: "backfill", provider: "other" });
        expect(payload.total).toBe(1);
        expect(payload.items[0].id).toBe("r2");
    });

    it("normalizes invalid filters", () => {
        expect(sanitizeRunsFilters({ status: "   ", runType: "", provider: "  " })).toEqual({
            status: null,
            runType: null,
            provider: null,
        });
    });
});
