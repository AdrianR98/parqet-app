import { describe, expect, it } from "vitest";

import { createSyntheticActivity, runGlobalAssetPipeline, warningCodes } from "./global-assets-test-helpers";

describe("global asset transfer fixtures (current conservative behavior)", () => {
  it("transfer_pair_clean: transfer activities remain visible without pairing metadata", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_40",
        type: "transfer_in",
        datetime: "2025-06-01T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
        portfolioId: "portfolio_demo_1",
      }),
      createSyntheticActivity({
        activityId: "activity_demo_41",
        type: "transfer_out",
        datetime: "2025-06-02T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
        portfolioId: "portfolio_demo_2",
        portfolioName: "Portfolio Demo 2",
      }),
    ]);

    expect(aggregation.assets[0]?.totals.quantity).toBe(0);
    expect(aggregation.assets[0]?.status).toBe("active");
    expect(aggregation.assets[0]?.timeline.map((entry) => entry.displayType)).toEqual([
      "possible_transfer",
      "possible_transfer",
    ]);
    expect(aggregation.assets[0]?.timeline.every((entry) => entry.transferGroupId === null)).toBe(true);
    expect(aggregation.summary.negativeQuantityAssetCount).toBe(1);
  });

  it("transfer_unmatched_in: transfer_in contributes positive quantity", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_42",
        type: "transfer_in",
        datetime: "2025-06-03T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
      }),
    ]);

    expect(aggregation.assets[0]?.totals.quantity).toBe(5);
    expect(aggregation.assets[0]?.status).toBe("active");
    expect(aggregation.summary.negativeQuantityAssetCount).toBe(0);
  });

  it("transfer_unmatched_out: transfer_out without inbound side is treated as negative position", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_43",
        type: "transfer_out",
        datetime: "2025-06-04T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
      }),
    ]);

    expect(aggregation.assets[0]?.totals.quantity).toBe(-5);
    expect(aggregation.assets[0]?.status).toBe("unknown");
    expect(aggregation.summary.negativeQuantityAssetCount).toBe(1);
    expect(aggregation.unresolvedDecisionCandidates?.[0]?.cause).toBe("missing_inbound_activity");
  });

  it("transfer_ambiguous_multiple_candidates: multiple transfer_out entries stay conservative and unresolved", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_44",
        type: "transfer_in",
        datetime: "2025-06-05T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
      }),
      createSyntheticActivity({
        activityId: "activity_demo_45",
        type: "transfer_out",
        datetime: "2025-06-06T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
      }),
      createSyntheticActivity({
        activityId: "activity_demo_46",
        type: "transfer_out",
        datetime: "2025-06-07T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
      }),
    ]);

    expect(aggregation.assets[0]?.totals.quantity).toBe(-5);
    expect(aggregation.assets[0]?.status).toBe("unknown");
    expect(aggregation.summary.negativeQuantityAssetCount).toBe(1);
    expect(aggregation.unresolvedDecisionCandidates?.[0]?.cause).toBe("sell_exceeds_known_position");
  });

  it("transfer_partial: unmatched remainder remains as open quantity", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_47",
        type: "transfer_in",
        datetime: "2025-06-08T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 10,
      }),
      createSyntheticActivity({
        activityId: "activity_demo_48",
        type: "transfer_out",
        datetime: "2025-06-09T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 4,
      }),
    ]);

    expect(aggregation.assets[0]?.totals.quantity).toBe(6);
    expect(aggregation.assets[0]?.status).toBe("active");
  });

  it("transfer_cross_currency_unsupported: cross-currency transfer activity stays blocked via mixed-currency warnings", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_49",
        type: "transfer_in",
        datetime: "2025-06-10T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
        currency: "EUR",
      }),
      createSyntheticActivity({
        activityId: "activity_demo_50",
        type: "transfer_out",
        datetime: "2025-06-11T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
        currency: "USD",
      }),
    ]);

    expect(warningCodes(aggregation.assets[0]?.warnings ?? [])).toContain("MIXED_CURRENCIES");
    expect(warningCodes(aggregation.assets[0]?.warnings ?? [])).toContain("TOTALS_BLOCKED_BY_MIXED_CURRENCIES");
    expect(aggregation.summary.mixedCurrencyAssetCount).toBe(1);
  });
});
