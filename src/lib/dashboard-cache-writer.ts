import { notifyLocalSettingsChanged } from "./app-settings";
import { enrichAssetsWithMetadata } from "./asset-metadata";
import { saveDashboardCache, type DashboardCache } from "./dashboard-cache";
import { selectCanonicalDashboardSafeFieldSource } from "./dashboard-helpers";
import { readGlobalAssetProductReadModel } from "./parqet/global-assets/product-surface-selectors";
import type { GlobalAssetViewModel, AssetsApiResponse } from "./types";

const CLOSED_POSITION_EPSILON = 1e-8;

function splitAssetsByPosition(assets: GlobalAssetViewModel[]): {
  activeAssets: GlobalAssetViewModel[];
  closedAssets: GlobalAssetViewModel[];
} {
  return {
    activeAssets: assets.filter((asset) => asset.netShares > CLOSED_POSITION_EPSILON),
    closedAssets: assets.filter((asset) => asset.netShares <= CLOSED_POSITION_EPSILON),
  };
}

export type PrepareDashboardCacheWriteInput = {
  response: AssetsApiResponse;
  selectedPortfolioIds: string[];
  guardEnabled: boolean;
  generatedAt?: string;
};

export type PreparedDashboardCacheWrite = {
  generatedAt: string;
  selectedAssets: GlobalAssetViewModel[];
  selectedActiveAssets: GlobalAssetViewModel[];
  selectedClosedAssets: GlobalAssetViewModel[];
  cachePayload: DashboardCache;
};

export function prepareDashboardCacheWrite(
  input: PrepareDashboardCacheWriteInput,
): PreparedDashboardCacheWrite {
  const nextActiveAssets = enrichAssetsWithMetadata(input.response.activeAssets ?? []);
  const nextClosedAssets = enrichAssetsWithMetadata(input.response.closedAssets ?? []);
  const runtimeFallbackAssets = [...nextActiveAssets, ...nextClosedAssets];
  const responseWithCoexistence = input.response as AssetsApiResponse & {
    globalAssetProductReadModel?: unknown;
  };
  const rawGlobalAssetProductReadModel =
    responseWithCoexistence.globalAssetProductReadModel ?? null;
  const globalAssetProductReadModel = readGlobalAssetProductReadModel(
    rawGlobalAssetProductReadModel,
  );
  const canonicalSafeFieldSelection = selectCanonicalDashboardSafeFieldSource({
    runtimeFallbackAssets,
    productReadModel: rawGlobalAssetProductReadModel,
    guardEnabled: input.guardEnabled,
  });
  // Fallback assets stay available for compatibility when PRM cannot be selected.
  const selectedAssets = canonicalSafeFieldSelection.assets;
  const selectedByPosition = splitAssetsByPosition(selectedAssets);
  const generatedAt =
    input.generatedAt ?? input.response.generatedAt ?? new Date().toISOString();

  return {
    generatedAt,
    selectedAssets,
    selectedActiveAssets: selectedByPosition.activeAssets,
    selectedClosedAssets: selectedByPosition.closedAssets,
    cachePayload: {
      activeAssets: nextActiveAssets,
      closedAssets: nextClosedAssets,
      rawActivityCount: input.response.rawActivityCount ?? 0,
      filteredActivityCount: input.response.filteredActivityCount ?? 0,
      assetCount: input.response.assetCount ?? 0,
      activeAssetCount: input.response.activeAssetCount ?? nextActiveAssets.length,
      closedAssetCount: input.response.closedAssetCount ?? nextClosedAssets.length,
      consistencyReport: input.response.consistencyReport ?? null,
      reconciliationWarnings: input.response.reconciliationWarnings ?? [],
      generatedAt,
      lastUpdatedAt: generatedAt,
      selectedPortfolioIds: input.selectedPortfolioIds,
      freshness: input.response.freshness,
      activityItems: input.response.activityItems ?? [],
      globalAssetProductReadModel,
      guardedSourceSelection: canonicalSafeFieldSelection.selection,
    },
  };
}

export function persistDashboardCacheWrite(
  input: PrepareDashboardCacheWriteInput,
): PreparedDashboardCacheWrite {
  const prepared = prepareDashboardCacheWrite(input);
  saveDashboardCache(prepared.cachePayload);
  notifyLocalSettingsChanged();
  return prepared;
}

