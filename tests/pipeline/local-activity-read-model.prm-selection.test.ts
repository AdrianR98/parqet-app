import { describe, expect, it } from "vitest";

import { selectLocalActivitiesTimelineSource } from "../../src/lib/local-activity-read-model";
import { projectActivitiesTimelineProductReadModel } from "../../src/lib/parqet/global-assets/product-read-model";
import { createSyntheticActivity, runGlobalAssetPipeline } from "./global-assets-test-helpers";
import type { ActivitiesAuditItem } from "../../src/lib/types";

function createCurrentActivityItem(partial?: Partial<ActivitiesAuditItem>): ActivitiesAuditItem {
  return {
    id: partial?.id ?? "current-activity-1",
    datetime: partial?.datetime ?? "2026-05-10T10:00:00.000Z",
    year: partial?.year ?? 2026,
    monthKey: partial?.monthKey ?? "2026-05",
    monthLabel: partial?.monthLabel ?? "Mai 2026",
    portfolioId: partial?.portfolioId ?? "portfolio_current_1",
    portfolioName: partial?.portfolioName ?? "Portfolio Current 1",
    isin: partial?.isin ?? "DEMO00000001",
    name: partial?.name ?? "Current Asset 1",
    symbol: partial?.symbol ?? "CUR1",
    wkn: partial?.wkn ?? "WKNCUR01",
    type: partial?.type ?? "buy",
    rawType: partial?.rawType ?? "buy",
    shares: partial?.shares ?? 1,
    price: partial?.price ?? 10,
    amount: partial?.amount ?? 10,
    amountNet: partial?.amountNet ?? 10,
    warningMessages: partial?.warningMessages ?? [],
    hasOverrides: partial?.hasOverrides ?? false,
    overrideCount: partial?.overrideCount ?? 0,
    overrideFlags: partial?.overrideFlags ?? {},
  };
}

describe("local activity read-model PRM selection bridge", () => {
  it("keeps activityItems as default source when the feature flag is off", () => {
    const currentItems = [createCurrentActivityItem()];
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "prm-1",
        type: "buy",
        datetime: "2026-05-10T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 1,
        currency: "EUR",
      }),
    ]);
    const projected = projectActivitiesTimelineProductReadModel({
      aggregation,
      freshnessState: "fresh",
      scopeState: "scope_match",
    });

    const result = selectLocalActivitiesTimelineSource({
      currentItems,
      projected,
      featureFlagEnabled: false,
    });

    expect(result.selection.selectedSource).toBe("activityItems");
    expect(result.selection.reason).toBe("feature_flag_disabled");
    expect(result.items).toEqual(currentItems);
  });

  it("selects PRM items only when enabled and projected evidence is ready", () => {
    const currentItems = [
      createCurrentActivityItem({ id: "current-1", type: "buy" }),
      createCurrentActivityItem({ id: "current-2", type: "sell", rawType: "sell" }),
    ];
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "prm-ready-1",
        type: "buy",
        datetime: "2026-05-11T10:00:00.000Z",
        isin: "DEMO00000011",
        shares: 2,
        currency: "EUR",
      }),
      createSyntheticActivity({
        activityId: "prm-ready-2",
        type: "sell",
        datetime: "2026-05-12T10:00:00.000Z",
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

    const result = selectLocalActivitiesTimelineSource({
      currentItems,
      projected,
      featureFlagEnabled: true,
    });

    expect(result.selection.selectedSource).toBe("productReadModel");
    expect(result.selection.reason).toBe("diagnostic_ready");
    expect(result.items).toHaveLength(projected.summary.itemCount);
    expect(result.items[0]?.id).toBe(projected.items[0]?.activityId);
  });

  it("falls back to activityItems for missing, stale, scope mismatch and unavailable evidence", () => {
    const currentItems = [createCurrentActivityItem()];
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "prm-fallback-1",
        type: "buy",
        datetime: "2026-05-13T10:00:00.000Z",
        isin: "DEMO00000013",
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
      selectLocalActivitiesTimelineSource({
        currentItems,
        projected: null,
        featureFlagEnabled: true,
      }),
      selectLocalActivitiesTimelineSource({
        currentItems,
        projected: staleProjected,
        featureFlagEnabled: true,
      }),
      selectLocalActivitiesTimelineSource({
        currentItems,
        projected: scopeMismatchProjected,
        featureFlagEnabled: true,
      }),
      selectLocalActivitiesTimelineSource({
        currentItems,
        projected: staleProjected,
        featureFlagEnabled: true,
        statusOverride: "unavailable",
      }),
    ];

    expect(selections[0]?.selection.reason).toBe("diagnostic_missing");
    expect(selections[1]?.selection.reason).toBe("diagnostic_stale");
    expect(selections[2]?.selection.reason).toBe("diagnostic_scope_mismatch");
    expect(selections[3]?.selection.reason).toBe("diagnostic_unavailable");

    for (const selection of selections) {
      expect(selection.selection.selectedSource).toBe("activityItems");
      expect(selection.items).toEqual(currentItems);
    }
  });
});
