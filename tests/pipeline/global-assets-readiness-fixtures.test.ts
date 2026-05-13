import { describe, expect, it } from "vitest";

import {
  classifyPriceSourceReadiness,
  classifyScopeReadiness,
  classifySnapshotFreshness,
} from "../../src/lib/parqet/global-assets/readiness";
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

  it("stale_snapshot: classifies stale, missing and unknown freshness from pure inputs", () => {
    const now = "2026-01-10T12:00:00.000Z";

    expect(
      classifySnapshotFreshness({
        snapshotAt: "2026-01-10T11:59:00.000Z",
        now,
        staleAfterMs: 120_000,
      })
    ).toBe("fresh");

    expect(
      classifySnapshotFreshness({
        snapshotAt: "2026-01-10T11:00:00.000Z",
        now,
        staleAfterMs: 120_000,
      })
    ).toBe("stale");

    expect(
      classifySnapshotFreshness({
        snapshotAt: null,
        now,
        staleAfterMs: 120_000,
      })
    ).toBe("missing");

    expect(
      classifySnapshotFreshness({
        snapshotAt: "not-a-timestamp",
        now,
        staleAfterMs: 120_000,
      })
    ).toBe("unknown");
  });

  it("scope_missing: selected scope is known but snapshot scope is missing or not covering selection", () => {
    expect(
      classifyScopeReadiness({
        selectedPortfolioIds: ["portfolio_demo_1"],
        snapshotPortfolioIds: [],
      })
    ).toBe("missing");

    expect(
      classifyScopeReadiness({
        selectedPortfolioIds: ["portfolio_demo_1", "portfolio_demo_2"],
        snapshotPortfolioIds: ["portfolio_demo_1"],
      })
    ).toBe("missing");
  });

  it("scope_unknown: selected or snapshot scope cannot be determined", () => {
    expect(
      classifyScopeReadiness({
        selectedPortfolioIds: null,
        snapshotPortfolioIds: ["portfolio_demo_1"],
      })
    ).toBe("unknown");

    expect(
      classifyScopeReadiness({
        selectedPortfolioIds: ["portfolio_demo_1"],
        snapshotPortfolioIds: null,
      })
    ).toBe("unknown");
  });

  it("price_source_missing: classifies missing and available price-source readiness", () => {
    expect(
      classifyPriceSourceReadiness({
        priceSource: undefined,
        valueClassification: undefined,
      })
    ).toBe("missing");

    expect(
      classifyPriceSourceReadiness({
        priceSource: "none",
      })
    ).toBe("missing");

    expect(
      classifyPriceSourceReadiness({
        valueClassification: "provider_reference",
      })
    ).toBe("provider_reference");

    expect(
      classifyPriceSourceReadiness({
        priceSource: "provider_price",
      })
    ).toBe("available");
  });
});
