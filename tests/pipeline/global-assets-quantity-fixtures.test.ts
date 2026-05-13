import { describe, expect, it } from "vitest";

import { createSyntheticActivity, runGlobalAssetPipeline, warningCodes } from "./global-assets-test-helpers";

describe("global asset quantity and sell edge fixtures", () => {
  it("partial_sell: keeps remaining quantity active", () => {
    const { normalization, aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_10",
        type: "buy",
        datetime: "2025-04-01T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 10,
      }),
      createSyntheticActivity({
        activityId: "activity_demo_11",
        type: "sell",
        datetime: "2025-04-02T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 4,
      }),
    ]);

    expect(normalization.summary.normalizedCount).toBe(2);
    expect(aggregation.summary.assetCount).toBe(1);
    expect(aggregation.assets[0]?.totals.quantity).toBe(6);
    expect(aggregation.assets[0]?.status).toBe("active");
    expect(aggregation.summary.negativeQuantityAssetCount).toBe(0);
  });

  it("sell_without_buy: negative quantity is flagged as unresolved", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_12",
        type: "sell",
        datetime: "2025-04-03T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 3,
      }),
    ]);

    expect(aggregation.assets[0]?.totals.quantity).toBe(-3);
    expect(aggregation.assets[0]?.status).toBe("unknown");
    expect(aggregation.summary.negativeQuantityAssetCount).toBe(1);
    expect(warningCodes(aggregation.warnings)).toContain("NEGATIVE_POSITION_QUANTITY");
    expect(aggregation.unresolvedDecisionCandidates?.[0]?.cause).toBe("missing_inbound_activity");
  });

  it("negative_quantity: outbound exceeds inbound and keeps current warning cause", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_13",
        type: "buy",
        datetime: "2025-04-04T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 2,
      }),
      createSyntheticActivity({
        activityId: "activity_demo_14",
        type: "sell",
        datetime: "2025-04-05T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
      }),
    ]);

    expect(aggregation.assets[0]?.totals.quantity).toBe(-3);
    expect(aggregation.assets[0]?.status).toBe("unknown");
    expect(aggregation.summary.negativeQuantityAssetCount).toBe(1);
    expect(aggregation.unresolvedDecisionCandidates?.[0]?.cause).toBe("sell_exceeds_known_position");
  });

  it("duplicate_sell_candidate: repeated sell quantities surface duplicate candidate cause", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_15",
        type: "buy",
        datetime: "2025-04-06T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
      }),
      createSyntheticActivity({
        activityId: "activity_demo_16",
        type: "sell",
        datetime: "2025-04-07T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 4,
      }),
      createSyntheticActivity({
        activityId: "activity_demo_17",
        type: "sell",
        datetime: "2025-04-08T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 4,
      }),
    ]);

    expect(aggregation.assets[0]?.totals.quantity).toBe(-3);
    expect(aggregation.summary.negativeQuantityAssetCount).toBe(1);
    expect(aggregation.unresolvedDecisionCandidates?.[0]?.cause).toBe("duplicate_sell_candidate");
  });
});
