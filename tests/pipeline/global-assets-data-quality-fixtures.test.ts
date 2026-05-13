import { describe, expect, it } from "vitest";

import { createSyntheticActivity, runGlobalAssetPipeline, warningCodes } from "./global-assets-test-helpers";

describe("global asset data-quality fixtures", () => {
  it("missing_asset_identity: activity remains unassigned and blocked", () => {
    const { normalization, aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_60",
        type: "buy",
        datetime: "2025-07-01T10:00:00.000Z",
        isin: null,
        shares: 2,
      }),
    ]);

    expect(warningCodes(normalization.warnings)).toContain("MISSING_ISIN");
    expect(warningCodes(normalization.warnings)).toContain("MISSING_ASSET_KEY");
    expect(aggregation.summary.assetCount).toBe(0);
    expect(aggregation.summary.unassignedActivityCount).toBe(1);
    expect(warningCodes(aggregation.warnings)).toContain("UNASSIGNED_ACTIVITY");
  });

  it("invalid_date: keeps activity but records INVALID_DATETIME warning", () => {
    const { normalization, aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_61",
        type: "buy",
        datetime: "07-31-2025",
        isin: "DEMO00000001",
        shares: 2,
      }),
    ]);

    expect(warningCodes(normalization.warnings)).toContain("INVALID_DATETIME");
    expect(normalization.activities[0]?.date).toBeNull();
    expect(aggregation.summary.assetCount).toBe(1);
  });

  it("numeric_parse_failed: invalid numeric fields are nulled and warned", () => {
    const { normalization } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_62",
        type: "buy",
        datetime: "2025-07-02T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: "not-a-number",
        price: "invalid-price",
        amountNet: "bad-amount",
        currency: "EUR",
      }),
    ]);

    const codes = warningCodes(normalization.warnings);

    expect(codes.filter((code) => code === "NUMERIC_PARSE_FAILED").length).toBeGreaterThanOrEqual(3);
    expect(normalization.activities[0]?.quantity).toBeNull();
    expect(normalization.activities[0]?.pricePerShare).toBeNull();
    expect(normalization.activities[0]?.amounts.amountNet).toBeNull();
  });
});
