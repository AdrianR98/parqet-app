import { describe, expect, it } from "vitest";

import { createSyntheticActivity, runGlobalAssetPipeline } from "./global-assets-test-helpers";

describe("global asset snapshot/read-model readiness fixtures", () => {
  it("provider_reference_only: keeps provider-reference fields without promoting them to app totals", () => {
    const { normalization, aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_70",
        type: "buy",
        datetime: "2025-08-01T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 2,
        buyAmountNet: 100,
        currency: "EUR",
        rawOverrides: {
          realizedGains: 15,
          realizedGainsNet: 10,
        },
      }),
    ]);

    expect(normalization.activities[0]?.parqetReference?.buyAmountNet).toEqual({ amount: 100, currency: "EUR" });
    expect(normalization.activities[0]?.parqetReference?.realizedGains).toEqual({ amount: 15, currency: "EUR" });
    expect(normalization.activities[0]?.parqetReference?.realizedGainsNet).toEqual({ amount: 10, currency: "EUR" });
    expect(aggregation.assets[0]?.totals.marketValue).toBeNull();
    expect(aggregation.assets[0]?.totals.costBasis).toBeNull();
    expect(aggregation.assets[0]?.totals.unrealizedPnL).toBeNull();
  });

  it("documents deferred readiness fixtures that are not currently exposed by pure pipeline functions", () => {
    const deferredReadinessFixtures: Record<string, string> = {
      stale_snapshot:
        "No pure function in normalize/aggregate derives freshness state from snapshot metadata yet.",
      scope_missing:
        "No pure function in normalize/aggregate computes scope coverage state for selected UI/report scope.",
      scope_unknown:
        "No pure function in normalize/aggregate computes unknown scope-state classification.",
      price_source_missing:
        "No source-type/value-classification model for price-source readiness exists in the current pure pipeline output.",
    };

    expect(Object.keys(deferredReadinessFixtures)).toEqual([
      "stale_snapshot",
      "scope_missing",
      "scope_unknown",
      "price_source_missing",
    ]);
    expect(Object.values(deferredReadinessFixtures).every((reason) => reason.length > 0)).toBe(true);
  });
});
