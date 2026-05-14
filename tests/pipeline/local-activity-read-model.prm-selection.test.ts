import { afterEach, describe, expect, it } from "vitest";

import {
  loadLocalActivityReadModel,
  selectLocalActivitiesTimelineSource,
} from "../../src/lib/local-activity-read-model";
import { projectActivitiesTimelineProductReadModel } from "../../src/lib/parqet/global-assets/product-read-model";
import { createSyntheticActivity, runGlobalAssetPipeline } from "./global-assets-test-helpers";
import type { ActivitiesAuditItem } from "../../src/lib/types";
import { DASHBOARD_CACHE_KEY } from "../../src/lib/dashboard-cache";
import { PORTFOLIO_SCOPE_STORAGE_KEY } from "../../src/lib/app-settings";

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

type LocalStorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function createLocalStorageMock(seed?: Record<string, string>): LocalStorageMock {
  const store = new Map<string, string>(Object.entries(seed ?? {}));

  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function installWindowWithLocalStorage(seed?: Record<string, string>): void {
  const localStorage = createLocalStorageMock(seed);

  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage,
    },
    configurable: true,
    writable: true,
  });
}

function buildDashboardCacheForLocalProjection(partial?: {
  activityItems?: ActivitiesAuditItem[];
  selectedPortfolioIds?: string[];
  freshness?: {
    status?: "missing" | "fresh" | "stale" | "refresh_failed";
    stale?: boolean;
    source?: "provider" | "snapshot" | "local_derived" | "none";
  };
}) {
  return {
    activeAssets: [],
    closedAssets: [],
    rawActivityCount: 1,
    filteredActivityCount: 1,
    assetCount: 0,
    activeAssetCount: 0,
    closedAssetCount: 0,
    consistencyReport: null,
    reconciliationWarnings: [],
    generatedAt: "2026-05-13T08:00:00.000Z",
    lastUpdatedAt: "2026-05-13T09:00:00.000Z",
    selectedPortfolioIds: partial?.selectedPortfolioIds ?? ["portfolio_current_1"],
    freshness: {
      present: true,
      loadedAt: "2026-05-13T08:00:00.000Z",
      updatedAt: "2026-05-13T09:00:00.000Z",
      status: partial?.freshness?.status ?? "fresh",
      source: partial?.freshness?.source ?? "snapshot",
      refreshStatus: "refreshed" as const,
      stale: partial?.freshness?.stale ?? false,
      scope: {
        portfolioCount: 1,
        fingerprint: "synthetic-scope-fingerprint",
      },
      lastRefreshErrorCategory: null,
    },
    activityItems: partial?.activityItems ?? [createCurrentActivityItem()],
  };
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ACTIVITIES_TIMELINE_PRM_FEATURE_FLAG;
  Reflect.deleteProperty(globalThis, "window");
});

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
      createCurrentActivityItem({
        id: "source:prm-ready-1",
        type: "buy",
        shares: 7,
        price: 123.45,
        amount: 864.15,
        amountNet: 860.15,
        portfolioName: "Portfolio Preserve A",
        name: "Preserved Asset A",
      }),
      createCurrentActivityItem({
        id: "source:prm-ready-2",
        type: "sell",
        rawType: "sell",
        shares: 3,
        price: 222.2,
        amount: 666.6,
        amountNet: 650.6,
        portfolioName: "Portfolio Preserve B",
        name: "Preserved Asset B",
      }),
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
    expect(result.items[0]?.id).toBe("source:prm-ready-1");
    expect(result.items[0]?.shares).toBe(7);
    expect(result.items[0]?.price).toBe(123.45);
    expect(result.items[0]?.amount).toBe(864.15);
    expect(result.items[0]?.portfolioName).toBe("Portfolio Preserve A");
    expect(result.items[0]?.name).toBe("Preserved Asset A");
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

describe("loadLocalActivityReadModel PRM projection boundary", () => {
  it("keeps activityItems as default source when projection is present but the feature flag is off", () => {
    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify(buildDashboardCacheForLocalProjection()),
    });

    const model = loadLocalActivityReadModel();

    expect(model.activitiesTimelinePrmSelection.selectedSource).toBe("activityItems");
    expect(model.activitiesTimelinePrmSelection.reason).toBe("feature_flag_disabled");
    expect(model.activitiesTimelinePrmSelection.diagnostic.status).toBe("ready");
    expect(model.items).toHaveLength(1);
    expect(model.items[0]?.id).toBe("current-activity-1");
  });

  it("selects PRM items when explicitly enabled and local projected evidence is ready", () => {
    process.env.NEXT_PUBLIC_ACTIVITIES_TIMELINE_PRM_FEATURE_FLAG = "true";
    const preservedItem = createCurrentActivityItem({
      id: "current-activity-1",
      shares: 9,
      price: 222.22,
      amount: 1999.98,
      amountNet: 1989.98,
      portfolioName: "Portfolio Preserve Local",
      name: "Preserved Local Asset",
      note: "synthetic note",
      fee: 5.5,
      tax: 2.2,
    });

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify(
        buildDashboardCacheForLocalProjection({
          activityItems: [preservedItem],
        }),
      ),
    });

    const model = loadLocalActivityReadModel();

    expect(model.activitiesTimelinePrmSelection.selectedSource).toBe("productReadModel");
    expect(model.activitiesTimelinePrmSelection.reason).toBe("diagnostic_ready");
    expect(model.activitiesTimelinePrmSelection.diagnostic.status).toBe("ready");
    expect(model.items).toHaveLength(1);
    expect(model.items[0]?.id).toBe("current-activity-1");
    expect(model.items[0]?.shares).toBe(9);
    expect(model.items[0]?.price).toBe(222.22);
    expect(model.items[0]?.amount).toBe(1999.98);
    expect(model.items[0]?.amountNet).toBe(1989.98);
    expect(model.items[0]?.portfolioName).toBe("Portfolio Preserve Local");
    expect(model.items[0]?.name).toBe("Preserved Local Asset");
  });

  it("falls back to activityItems for missing, stale and scope-mismatch local projection evidence", () => {
    process.env.NEXT_PUBLIC_ACTIVITIES_TIMELINE_PRM_FEATURE_FLAG = "true";

    installWindowWithLocalStorage();
    const missingProjection = loadLocalActivityReadModel();

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify(
        buildDashboardCacheForLocalProjection({
          freshness: {
            status: "stale",
            stale: true,
            source: "snapshot",
          },
        }),
      ),
    });
    const staleProjection = loadLocalActivityReadModel();

    installWindowWithLocalStorage({
      [DASHBOARD_CACHE_KEY]: JSON.stringify(buildDashboardCacheForLocalProjection()),
      [PORTFOLIO_SCOPE_STORAGE_KEY]: JSON.stringify({
        mode: "manual",
        selectedPortfolioIds: ["portfolio_not_in_snapshot"],
      }),
    });
    const scopeMismatchProjection = loadLocalActivityReadModel();

    expect(missingProjection.activitiesTimelinePrmSelection.selectedSource).toBe("activityItems");
    expect(missingProjection.activitiesTimelinePrmSelection.reason).toBe("diagnostic_missing");

    expect(staleProjection.activitiesTimelinePrmSelection.selectedSource).toBe("activityItems");
    expect(staleProjection.activitiesTimelinePrmSelection.reason).toBe("diagnostic_stale");

    expect(scopeMismatchProjection.activitiesTimelinePrmSelection.selectedSource).toBe("activityItems");
    expect(scopeMismatchProjection.activitiesTimelinePrmSelection.reason).toBe(
      "diagnostic_scope_mismatch",
    );
  });
});
