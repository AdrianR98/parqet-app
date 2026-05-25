import { describe, expect, it } from "vitest";

import { buildStatusReportTriageSummary } from "../../src/lib/market-data/db/status-report-triage";

describe("market data status triage helper", () => {
    it("treats legacy/derivative/excluded as terminal and unknown as manual review", () => {
        const summary = buildStatusReportTriageSummary({
            instruments: [
                { isin: "AAA", name: "Actionable", marketDataStatus: "active" },
                { isin: "BBB", name: "Legacy", marketDataStatus: "legacy" },
                { isin: "CCC", name: "Derivative", marketDataStatus: "derivative" },
                { isin: "DDD", name: "Excluded", marketDataStatus: "excluded" },
                { isin: "EEE", name: "Unknown", marketDataStatus: "unknown" },
                { isin: "FFF", name: "Unset", marketDataStatus: null },
                { isin: "GGG", name: "Verified", marketDataStatus: "active" },
            ],
            verifiedIsins: new Set(["GGG"]),
        });

        expect(summary.rawWithoutVerifiedMapping.map((row) => row.isin)).toEqual(["AAA", "BBB", "CCC", "DDD", "EEE", "FFF"]);
        expect(summary.actionableWithoutVerifiedMapping.map((row) => row.isin)).toEqual(["AAA", "FFF"]);
        expect(summary.terminalWithoutVerifiedMapping.map((row) => row.isin)).toEqual(["BBB", "CCC", "DDD"]);
        expect(summary.manualReviewWithoutVerifiedMapping.map((row) => row.isin)).toEqual(["EEE"]);
        expect(summary.terminalBreakdown).toEqual({
            excluded: 1,
            legacy: 1,
            derivative: 1,
        });
    });

    it("returns empty actionable bucket when only terminal/manual rows are unverified", () => {
        const summary = buildStatusReportTriageSummary({
            instruments: [
                { isin: "BBB", name: "Legacy", marketDataStatus: "legacy" },
                { isin: "CCC", name: "Derivative", marketDataStatus: "derivative" },
                { isin: "DDD", name: "Unknown", marketDataStatus: "unknown" },
            ],
            verifiedIsins: new Set<string>(),
        });

        expect(summary.actionableWithoutVerifiedMapping).toEqual([]);
        expect(summary.terminalWithoutVerifiedMapping.map((row) => row.isin)).toEqual(["BBB", "CCC"]);
        expect(summary.manualReviewWithoutVerifiedMapping.map((row) => row.isin)).toEqual(["DDD"]);
    });
});
