import { describe, expect, it } from "vitest";
import type { DbMarketInstrument } from "../../src/lib/market-data/db/types-core";
import {
    buildStatusUpdatePlan,
    parseStatusCliArgs,
} from "../../src/lib/market-data/cli/market-instrument-status-cli";

function makeInstrument(overrides: Partial<DbMarketInstrument> = {}): DbMarketInstrument {
    return {
        id: "1",
        isin: "US7495271071",
        name: "REV Group Inc",
        displayName: "REV Group Inc",
        assetType: "stock",
        currency: "USD",
        wkn: "A2H5A5",
        metadataSource: null,
        metadataUpdatedAt: null,
        nameSource: null,
        displayNameSource: null,
        displayMetadataUpdatedAt: null,
        marketDataStatus: "legacy",
        marketDataStatusReason: "legacy triage",
        marketDataSuccessorIsin: "US0000000001",
        marketDataSuccessorSymbol: "OLD",
        marketDataStatusUpdatedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

describe("market instrument status CLI helpers", () => {
    it("rejects invalid status", () => {
        expect(() => parseStatusCliArgs(["--isin", "US7495271071", "--status", "bad"])).toThrow(
            "Missing or invalid required --status.",
        );
    });

    it("rejects invalid isin", () => {
        expect(() => parseStatusCliArgs(["--isin", "US123", "--status", "active"])).toThrow(
            "Missing or invalid required --isin.",
        );
    });

    it("is dry-run by default", () => {
        const options = parseStatusCliArgs(["--isin", "US7495271071", "--status", "active"]);
        expect(options.write).toBe(false);
    });

    it("returns no changes when requested state is unchanged", () => {
        const before = makeInstrument({
            marketDataStatus: "legacy",
            marketDataStatusReason: "legacy triage",
            marketDataSuccessorIsin: "US0000000001",
            marketDataSuccessorSymbol: "OLD",
        });
        const options = parseStatusCliArgs([
            "--isin",
            "US7495271071",
            "--status",
            "legacy",
            "--reason",
            "legacy triage",
            "--successor-isin",
            "US0000000001",
            "--successor-symbol",
            "OLD",
        ]);

        const plan = buildStatusUpdatePlan(before, options);
        expect(plan.changes).toHaveLength(0);
    });

    it("plans status update from legacy to active", () => {
        const before = makeInstrument();
        const options = parseStatusCliArgs(["--isin", "US7495271071", "--status", "active"]);

        const plan = buildStatusUpdatePlan(before, options);

        expect(plan.next.status).toBe("active");
        expect(plan.changes.some((c) => c.field === "market_data_status")).toBe(true);
    });

    it("preserves reason and successor values when omitted for non-active status", () => {
        const before = makeInstrument({
            marketDataStatus: "legacy",
            marketDataStatusReason: "keep me",
            marketDataSuccessorIsin: "US0000000001",
            marketDataSuccessorSymbol: "KEEP",
        });
        const options = parseStatusCliArgs(["--isin", "US7495271071", "--status", "excluded"]);

        const plan = buildStatusUpdatePlan(before, options);

        expect(plan.next.reason).toBe("keep me");
        expect(plan.next.successorIsin).toBe("US0000000001");
        expect(plan.next.successorSymbol).toBe("KEEP");
    });
});
