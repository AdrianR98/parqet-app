import { describe, expect, it } from "vitest";

import {
  buildActivityItemsCompatibilityComparisonSummary,
  buildActivitiesTimelineComparisonEvidence,
  buildActivitiesTimelineShadowDiagnosticHarness,
  buildActivitiesTimelineShadowComparison,
  buildLegacyActivitiesTimelineComparisonSummary,
  mapActivityItemsToLegacyComparisonInput,
  projectGlobalAssetsProductReadModel,
  projectActivitiesTimelineProductReadModel,
  selectActivitiesTimelinePrmFeatureFlagSource,
} from "../../src/lib/parqet/global-assets/product-read-model";
import { createSyntheticActivity, runGlobalAssetPipeline } from "./global-assets-test-helpers";

const freshOverlayTimestamp = new Date().toISOString();
const freshOverlayDate = freshOverlayTimestamp.slice(0, 10);

describe("global asset product read-model projection (activities/timeline)", () => {
  it("projects a safe synthetic timeline with source/freshness/scope/confidence metadata", () => {
    const { aggregation } = runGlobalAssetPipeline(
      [
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
      ],
      {
        marketPriceOverlaysByIsin: {
          DEMO00000001: {
            priceAmount: 12,
            currency: "EUR",
            priceDate: freshOverlayDate,
            priceTimestamp: freshOverlayTimestamp,
            priceSource: "market_data_db",
          },
        },
      },
    );

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

  it("builds a matching shadow comparison with zero deltas", () => {
    const { aggregation } = runGlobalAssetPipeline(
      [
        createSyntheticActivity({
          activityId: "activity_demo_401",
          type: "buy",
          datetime: "2026-01-01T10:00:00.000Z",
          isin: "DEMO00000004",
          shares: 2,
          currency: "EUR",
        }),
        createSyntheticActivity({
          activityId: "activity_demo_402",
          type: "sell",
          datetime: "2026-01-02T10:00:00.000Z",
          isin: "DEMO00000004",
          shares: 1,
          currency: "EUR",
        }),
      ],
      {
        marketPriceOverlaysByIsin: {
          DEMO00000004: {
            priceAmount: 15,
            currency: "EUR",
            priceDate: freshOverlayDate,
            priceTimestamp: freshOverlayTimestamp,
            priceSource: "market_data_db",
          },
        },
      },
    );

    const projected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const shadow = buildActivitiesTimelineShadowComparison({
      currentItems: [
        { type: "buy", warningMessages: [] },
        { type: "sell", warningMessages: [] },
      ],
      projected,
    });

    expect(shadow.status).toBe("available");
    expect(shadow.delta.itemCount).toBe(0);
    expect(shadow.delta.warningItemCount).toBe(0);
    expect(shadow.delta.blockedIndicatorOrMetricItemCount).toBe(0);
    expect(shadow.delta.byType?.buy).toBe(0);
    expect(shadow.delta.byType?.sell).toBe(0);
  });

  it("builds a mismatch shadow comparison with count/type/warning/blocked deltas", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_501",
        type: "dividend",
        datetime: "2026-02-01T10:00:00.000Z",
        isin: "DEMO00000005",
        amountNet: 10,
        currency: "EUR",
      }),
      createSyntheticActivity({
        activityId: "activity_demo_502",
        type: "dividend",
        datetime: "2026-02-02T10:00:00.000Z",
        isin: "DEMO00000005",
        amountNet: 12,
        currency: "USD",
      }),
    ]);

    const projected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const shadow = buildActivitiesTimelineShadowComparison({
      currentItems: [{ type: "buy", warningMessages: [], blockedMetrics: [] }],
      projected,
    });

    expect(shadow.status).toBe("available");
    expect(shadow.delta.itemCount).toBe(1);
    expect(shadow.delta.warningItemCount).toBe(2);
    expect(shadow.delta.blockedIndicatorOrMetricItemCount).toBe(2);
    expect(shadow.delta.byType?.buy).toBe(-1);
    expect(shadow.delta.byType?.dividend).toBe(2);
  });

  it("returns safe shadow statuses for missing, stale and scope-mismatch projected evidence", () => {
    const currentItems = [{ type: "buy", warningMessages: [] }];
    const missing = buildActivitiesTimelineShadowComparison({
      currentItems,
      projected: null,
    });

    expect(missing.status).toBe("missing");
    expect(missing.projected).toBeNull();
    expect(missing.delta.itemCount).toBeNull();
    expect(missing.delta.byType).toBeNull();

    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_601",
        type: "buy",
        datetime: "2026-03-01T10:00:00.000Z",
        isin: "DEMO00000006",
        shares: 1,
        currency: "EUR",
      }),
    ]);

    const staleProjected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "stale",
      scopeState: "scope_match",
    });
    const stale = buildActivitiesTimelineShadowComparison({
      currentItems,
      projected: staleProjected,
    });
    expect(stale.status).toBe("stale");

    const scopeMismatchProjected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_missing",
    });
    const scopeMismatch = buildActivitiesTimelineShadowComparison({
      currentItems,
      projected: scopeMismatchProjected,
    });
    expect(scopeMismatch.status).toBe("scope_mismatch");
  });

  it("builds diagnostic harness evidence for a matching ready case", () => {
    const { aggregation } = runGlobalAssetPipeline(
      [
        createSyntheticActivity({
          activityId: "activity_demo_701",
          type: "buy",
          datetime: "2026-04-01T10:00:00.000Z",
          isin: "DEMO00000007",
          shares: 2,
          currency: "EUR",
        }),
        createSyntheticActivity({
          activityId: "activity_demo_702",
          type: "sell",
          datetime: "2026-04-02T10:00:00.000Z",
          isin: "DEMO00000007",
          shares: 1,
          currency: "EUR",
        }),
      ],
      {
        marketPriceOverlaysByIsin: {
          DEMO00000007: {
            priceAmount: 15,
            currency: "EUR",
            priceDate: freshOverlayDate,
            priceTimestamp: freshOverlayTimestamp,
            priceSource: "market_data_db",
          },
        },
      },
    );

    const projected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });

    const diagnostic = buildActivitiesTimelineShadowDiagnosticHarness({
      currentItems: [
        { type: "buy", warningMessages: [] },
        { type: "sell", warningMessages: [] },
      ],
      projected,
    });

    expect(diagnostic.status).toBe("ready");
    expect(diagnostic.reviewReady).toBe(true);
    expect(diagnostic.summary.currentItemCount).toBe(2);
    expect(diagnostic.summary.projectedItemCount).toBe(2);
    expect(diagnostic.summary.itemDelta).toBe(0);
    expect(diagnostic.summary.warningDelta).toBe(0);
    expect(diagnostic.summary.blockedDelta).toBe(0);
    expect(diagnostic.summary.byTypeDelta?.buy).toBe(0);
    expect(diagnostic.summary.byTypeDelta?.sell).toBe(0);
  });

  it("builds diagnostic harness evidence for a mismatch case", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_801",
        type: "dividend",
        datetime: "2026-04-03T10:00:00.000Z",
        isin: "DEMO00000008",
        amountNet: 20,
        currency: "EUR",
      }),
      createSyntheticActivity({
        activityId: "activity_demo_802",
        type: "dividend",
        datetime: "2026-04-04T10:00:00.000Z",
        isin: "DEMO00000008",
        amountNet: 22,
        currency: "USD",
      }),
    ]);

    const projected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });

    const diagnostic = buildActivitiesTimelineShadowDiagnosticHarness({
      currentItems: [{ type: "buy", warningMessages: [] }],
      projected,
    });

    expect(diagnostic.status).toBe("ready");
    expect(diagnostic.reviewReady).toBe(true);
    expect(diagnostic.summary.currentItemCount).toBe(1);
    expect(diagnostic.summary.projectedItemCount).toBe(2);
    expect(diagnostic.summary.itemDelta).toBe(1);
    expect(diagnostic.summary.warningDelta).toBe(2);
    expect(diagnostic.summary.blockedDelta).toBe(2);
    expect(diagnostic.summary.byTypeDelta?.buy).toBe(-1);
    expect(diagnostic.summary.byTypeDelta?.dividend).toBe(2);
  });

  it("maps missing, stale, scope mismatch and unavailable projected evidence to diagnostic statuses", () => {
    const currentItems = [{ type: "buy", warningMessages: [] }];

    const missingDiagnostic = buildActivitiesTimelineShadowDiagnosticHarness({
      currentItems,
      projected: null,
    });
    expect(missingDiagnostic.status).toBe("missing");
    expect(missingDiagnostic.reviewReady).toBe(false);
    expect(missingDiagnostic.summary.projectedItemCount).toBeNull();
    expect(missingDiagnostic.summary.byTypeDelta).toBeNull();

    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_901",
        type: "buy",
        datetime: "2026-04-05T10:00:00.000Z",
        isin: "DEMO00000009",
        shares: 1,
        currency: "EUR",
      }),
    ]);

    const staleProjected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "stale",
      scopeState: "scope_match",
    });
    const staleDiagnostic = buildActivitiesTimelineShadowDiagnosticHarness({
      currentItems,
      projected: staleProjected,
    });
    expect(staleDiagnostic.status).toBe("stale");
    expect(staleDiagnostic.reviewReady).toBe(false);

    const scopeMismatchProjected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_missing",
    });
    const scopeMismatchDiagnostic = buildActivitiesTimelineShadowDiagnosticHarness({
      currentItems,
      projected: scopeMismatchProjected,
    });
    expect(scopeMismatchDiagnostic.status).toBe("scope_mismatch");
    expect(scopeMismatchDiagnostic.reviewReady).toBe(false);

    const unavailableDiagnostic = buildActivitiesTimelineShadowDiagnosticHarness({
      currentItems,
      projected: staleProjected,
      statusOverride: "unavailable",
    });
    expect(unavailableDiagnostic.status).toBe("unavailable");
    expect(unavailableDiagnostic.reviewReady).toBe(false);
    expect(unavailableDiagnostic.summary.itemDelta).toBeNull();
  });

  it("keeps activityItems as default source of truth when the PRM feature flag is disabled", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_1001",
        type: "buy",
        datetime: "2026-04-06T10:00:00.000Z",
        isin: "DEMO00000010",
        shares: 3,
        currency: "EUR",
      }),
    ]);

    const projected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });

    const selection = selectActivitiesTimelinePrmFeatureFlagSource({
      currentItems: [{ type: "buy", warningMessages: [] }],
      projected,
      featureFlagEnabled: false,
    });

    expect(selection.selectedSource).toBe("activityItems");
    expect(selection.reason).toBe("feature_flag_disabled");
    expect(selection.selectedItemCount).toBe(1);
    expect(selection.diagnostic.status).toBe("ready");
    expect(selection.diagnostic.reviewReady).toBe(true);
  });

  it("selects PRM only when explicitly enabled and diagnostic evidence is ready", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_1101",
        type: "buy",
        datetime: "2026-04-07T10:00:00.000Z",
        isin: "DEMO00000011",
        shares: 2,
        currency: "EUR",
      }),
      createSyntheticActivity({
        activityId: "activity_demo_1102",
        type: "sell",
        datetime: "2026-04-08T10:00:00.000Z",
        isin: "DEMO00000011",
        shares: 1,
        currency: "EUR",
      }),
    ]);

    const projected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });

    const selection = selectActivitiesTimelinePrmFeatureFlagSource({
      currentItems: [
        { type: "buy", warningMessages: [] },
        { type: "sell", warningMessages: [] },
      ],
      projected,
      featureFlagEnabled: true,
    });

    expect(selection.selectedSource).toBe("productReadModel");
    expect(selection.reason).toBe("diagnostic_ready");
    expect(selection.selectedItemCount).toBe(projected.summary.itemCount);
    expect(selection.diagnostic.status).toBe("ready");
    expect(selection.diagnostic.reviewReady).toBe(true);
  });

  it("falls back to activityItems for missing, stale, scope mismatch and unavailable PRM evidence", () => {
    const currentItems = [{ type: "buy", warningMessages: [] }];
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_1201",
        type: "buy",
        datetime: "2026-04-09T10:00:00.000Z",
        isin: "DEMO00000012",
        shares: 1,
        currency: "EUR",
      }),
    ]);

    const staleProjected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "stale",
      scopeState: "scope_match",
    });
    const scopeMismatchProjected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_missing",
    });

    const selections = [
      selectActivitiesTimelinePrmFeatureFlagSource({
        currentItems,
        projected: null,
        featureFlagEnabled: true,
      }),
      selectActivitiesTimelinePrmFeatureFlagSource({
        currentItems,
        projected: staleProjected,
        featureFlagEnabled: true,
      }),
      selectActivitiesTimelinePrmFeatureFlagSource({
        currentItems,
        projected: scopeMismatchProjected,
        featureFlagEnabled: true,
      }),
      selectActivitiesTimelinePrmFeatureFlagSource({
        currentItems,
        projected: staleProjected,
        featureFlagEnabled: true,
        statusOverride: "unavailable",
      }),
    ];

    expect(selections[0]?.selectedSource).toBe("activityItems");
    expect(selections[0]?.reason).toBe("diagnostic_missing");
    expect(selections[0]?.diagnostic.status).toBe("missing");

    expect(selections[1]?.selectedSource).toBe("activityItems");
    expect(selections[1]?.reason).toBe("diagnostic_stale");
    expect(selections[1]?.diagnostic.status).toBe("stale");

    expect(selections[2]?.selectedSource).toBe("activityItems");
    expect(selections[2]?.reason).toBe("diagnostic_scope_mismatch");
    expect(selections[2]?.diagnostic.status).toBe("scope_mismatch");

    expect(selections[3]?.selectedSource).toBe("activityItems");
    expect(selections[3]?.reason).toBe("diagnostic_unavailable");
    expect(selections[3]?.diagnostic.status).toBe("unavailable");

    for (const selection of selections) {
      expect(selection?.selectedItemCount).toBe(1);
      expect(selection?.diagnostic.reviewReady).toBe(false);
    }
  });
});

describe("global asset product read-model valuation invariants", () => {
  it("keeps market-data-backed asset rows aligned with quantity * marketPrice", () => {
    const { aggregation } = runGlobalAssetPipeline(
      [
        createSyntheticActivity({
          activityId: "activity_prm_invariant_1",
          type: "buy",
          datetime: "2026-04-10T10:00:00.000Z",
          isin: "IE00B8GKDB10",
          shares: 33.142924,
          price: 69.83,
          currency: "EUR",
          amount: 2314.42,
          amountNet: 2314.42,
        }),
      ],
      {
        marketPriceOverlaysByIsin: {
          IE00B8GKDB10: {
            priceAmount: 77.95,
            currency: "EUR",
            priceDate: "2026-04-10",
            priceTimestamp: "2026-04-10T17:00:00.000Z",
            priceSource: "market_data_db",
          },
        },
      },
    );

    const projected = projectGlobalAssetsProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });
    const row = projected.assets[0];

    expect(row?.valuation.sourceKind).toBe("market_data_db");
    expect(row?.valuation.marketPrice.amount).toBe(77.95);
    expect(row?.quantity).toBe(33.142924);
    expect(row?.marketValue.amount).toBeCloseTo(2583.49, 2);
    expect(row?.unrealizedPnL.amount).toBeCloseTo(269.07, 2);
    expect(row?.marketValue.amount).toBeCloseTo(
      (row?.quantity ?? 0) * (row?.valuation.marketPrice.amount ?? 0),
      6,
    );
  });
});
