import { describe, expect, it } from "vitest";

import {
  buildActivityItemsCompatibilityComparisonSummary,
  buildActivitiesTimelineComparisonEvidence,
  buildLegacyActivitiesTimelineComparisonSummary,
  mapActivityItemsToLegacyComparisonInput,
  projectActivitiesTimelineProductReadModel,
} from "../../src/lib/parqet/global-assets/product-read-model";
import { createSyntheticActivity, runGlobalAssetPipeline } from "./global-assets-test-helpers";

describe("global asset product read-model projection (activities/timeline)", () => {
  it("projects a safe synthetic timeline with source/freshness/scope/confidence metadata", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_101",
        type: "buy",
        datetime: "2025-09-01T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 5,
        price: 10,
        currency: "EUR",
      }),
      createSyntheticActivity({
        activityId: "activity_demo_102",
        type: "sell",
        datetime: "2025-09-02T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 2,
        price: 11,
        currency: "EUR",
      }),
    ]);

    const projected = projectActivitiesTimelineProductReadModel({
      aggregation,
      readModelId: "rm-demo-safe",
      snapshotId: "snapshot-demo-1",
      generatedAt: "2026-05-13T12:00:00.000Z",
      sourceType: "local_snapshot",
      sourceScope: "selected_portfolios",
      freshnessAt: "2026-05-13T11:00:00.000Z",
      freshnessState: "fresh",
      scopeState: "scope_match",
      selectedPortfolioIds: ["portfolio_demo_1"],
      providerRequestCount: 0,
    });

    expect(projected.metadata.readModelId).toBe("rm-demo-safe");
    expect(projected.metadata.sourceType).toBe("local_snapshot");
    expect(projected.metadata.freshnessState).toBe("fresh");
    expect(projected.metadata.scopeState).toBe("scope_match");
    expect(projected.metadata.providerRequestCount).toBe(0);
    expect(projected.metadata.confidence).toBe("high");
    expect(projected.metadata.valueClassification).toBe("app_calculated");
    expect(projected.summary.itemCount).toBe(2);
    expect(projected.summary.warningItemCount).toBe(0);
    expect(projected.items.every((item) => item.valueClassification === "app_calculated")).toBe(true);
  });

  it("keeps warning/blocked/preliminary signals in a mixed-currency synthetic case", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_201",
        type: "dividend",
        datetime: "2025-10-01T10:00:00.000Z",
        isin: "DEMO00000002",
        amountNet: 25,
        currency: "EUR",
      }),
      createSyntheticActivity({
        activityId: "activity_demo_202",
        type: "dividend",
        datetime: "2025-10-02T10:00:00.000Z",
        isin: "DEMO00000002",
        amountNet: 30,
        currency: "USD",
      }),
    ]);

    const projected = projectActivitiesTimelineProductReadModel({
      aggregation,
      generatedAt: "2026-05-13T12:00:00.000Z",
      sourceType: "app_calculated",
      sourceScope: "selected_portfolios",
      freshnessState: "stale",
      scopeState: "scope_subset",
    });

    expect(projected.summary.warningItemCount).toBeGreaterThan(0);
    expect(projected.summary.blockedMetricItemCount).toBeGreaterThan(0);
    expect(projected.items.some((item) => item.blockedMetrics.includes("dividends"))).toBe(true);
    expect(projected.items.some((item) => item.valueClassification === "blocked")).toBe(true);
  });

  it("builds count-safe comparison evidence without exposing row-level payloads", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_301",
        type: "buy",
        datetime: "2025-11-01T10:00:00.000Z",
        isin: "DEMO00000003",
        shares: 1,
        price: 100,
        currency: "EUR",
      }),
    ]);

    const projected = projectActivitiesTimelineProductReadModel({
      aggregation,
      generatedAt: "2026-05-13T12:00:00.000Z",
    });
    const evidence = buildActivitiesTimelineComparisonEvidence({
      currentItems: [
        { type: "buy", warningMessages: [] },
        {
          type: "dividend",
          warningMessages: ["synthetic warning"],
          hasOverrides: true,
          blockedMetrics: ["dividends"],
        },
        {
          type: null,
          warningMessages: [],
          isBlocked: true,
        },
      ],
      projected,
    });

    expect(evidence.current.itemCount).toBe(3);
    expect(evidence.current.warningItemCount).toBe(1);
    expect(evidence.current.overrideItemCount).toBe(1);
    expect(evidence.current.unknownTypeItemCount).toBe(1);
    expect(evidence.current.blockedIndicatorItemCount).toBe(2);
    expect(evidence.projected.itemCount).toBe(projected.summary.itemCount);
    expect(evidence.current.byType.buy).toBe(1);
    expect(evidence.projected.byType.buy).toBe(1);
    expect(evidence.current).not.toHaveProperty("items");
    expect(evidence.projected).not.toHaveProperty("items");
  });

  it("normalizes legacy activity indicators into a count-safe summary", () => {
    const summary = buildLegacyActivitiesTimelineComparisonSummary([
      { type: " buy ", warningMessages: [] },
      { type: "unknown", warningMessages: ["synthetic warning"], overrideCount: 1 },
      { type: "", warningMessages: [], blockedMetrics: ["performance"] },
    ]);

    expect(summary.itemCount).toBe(3);
    expect(summary.warningItemCount).toBe(1);
    expect(summary.overrideItemCount).toBe(1);
    expect(summary.unknownTypeItemCount).toBe(2);
    expect(summary.blockedIndicatorItemCount).toBe(1);
    expect(summary.byType.buy).toBe(1);
    expect(summary.byType.unknown).toBe(2);
  });

  it("bridges activityItems-like input into count-safe legacy comparison evidence", () => {
    const activityItemsLike = [
      {
        type: "buy",
        warningMessages: ["synthetic warning"],
        hasOverrides: false,
      },
      {
        type: " transfer_in ",
        warningMessages: [],
        overrideFlags: { quantity: true },
      },
      {
        type: null,
        warningMessages: [],
        blockedMetrics: ["performance"],
        isBlocked: true,
      },
    ];

    const mapped = mapActivityItemsToLegacyComparisonInput(activityItemsLike);
    const summary = buildActivityItemsCompatibilityComparisonSummary(activityItemsLike);

    expect(mapped).toHaveLength(3);
    expect(mapped[1]?.overrideCount).toBe(1);
    expect(mapped[2]?.isBlocked).toBe(true);
    expect(summary.itemCount).toBe(3);
    expect(summary.warningItemCount).toBe(1);
    expect(summary.overrideItemCount).toBe(1);
    expect(summary.unknownTypeItemCount).toBe(1);
    expect(summary.blockedIndicatorItemCount).toBe(1);
    expect(summary.byType.buy).toBe(1);
    expect(summary.byType.transfer_in).toBe(1);
    expect(summary.byType.unknown).toBe(1);
  });
});
