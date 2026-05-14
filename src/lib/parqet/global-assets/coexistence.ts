import type { ActivityContext } from "../../parqet-assets/build-activity-context";
import { buildGlobalAssetsFromNormalizationResult } from "./aggregate";
import { normalizeActivities } from "./normalize";
import {
  type ProductReadModelAssets,
  type ProductReadModelFreshnessState,
  type ProductReadModelScopeState,
  type ProductReadModelSourceType,
  projectGlobalAssetsProductReadModel,
} from "./product-read-model";
import type { ParqetActivityWithPortfolioContext } from "./types";

function normalizePortfolioIds(portfolioIds: string[]): string[] {
  return Array.from(
    new Set(portfolioIds.map((portfolioId) => portfolioId.trim()).filter((portfolioId) => portfolioId.length > 0)),
  ).sort();
}

function mapFreshnessState(status: ActivityContext["freshness"]["status"]): ProductReadModelFreshnessState {
  if (status === "fresh") {
    return "fresh";
  }

  if (status === "stale" || status === "refresh_failed") {
    return "stale";
  }

  return "unknown";
}

function mapSourceType(source: ActivityContext["freshness"]["source"]): ProductReadModelSourceType {
  if (source === "provider") {
    return "provider";
  }

  if (source === "snapshot") {
    return "local_snapshot";
  }

  if (source === "local_derived") {
    return "local_derived";
  }

  return "none";
}

function mapScopeState(input: {
  requestedPortfolioIds: string[];
  availablePortfolioIds: string[];
}): ProductReadModelScopeState {
  const requestedPortfolioIds = normalizePortfolioIds(input.requestedPortfolioIds);
  const availablePortfolioIds = normalizePortfolioIds(input.availablePortfolioIds);

  if (requestedPortfolioIds.length === 0 || availablePortfolioIds.length === 0) {
    return "scope_unknown";
  }

  const availablePortfolioIdSet = new Set(availablePortfolioIds);
  const allRequestedCovered = requestedPortfolioIds.every((portfolioId) =>
    availablePortfolioIdSet.has(portfolioId),
  );

  if (!allRequestedCovered) {
    return "scope_missing";
  }

  if (requestedPortfolioIds.length === availablePortfolioIds.length) {
    return "scope_match";
  }

  return "scope_subset";
}

function toContextualActivities(
  activityContext: ActivityContext,
  availablePortfolioIds: string[],
): ParqetActivityWithPortfolioContext[] {
  const allowedPortfolioIds = new Set(availablePortfolioIds);
  const portfolioById = new Map(
    activityContext.authorizedPortfolios.map((portfolio) => [portfolio.id, portfolio] as const),
  );

  return activityContext.filteredActivities.flatMap((activity) => {
    const portfolioId = activity.portfolioId ?? null;

    if (!portfolioId || !allowedPortfolioIds.has(portfolioId)) {
      return [];
    }

    const portfolio = portfolioById.get(portfolioId);

    return [
      {
        portfolioId,
        portfolioName:
          portfolio?.name ?? activityContext.portfolioNameById.get(portfolioId) ?? null,
        portfolioCurrency: portfolio?.currency ?? null,
        raw: activity,
      },
    ];
  });
}

export function buildGlobalAssetProductReadModelFromActivityContext(input: {
  activityContext: ActivityContext;
  requestedPortfolioIds: string[];
  generatedAt?: string;
}): ProductReadModelAssets | null {
  const requestedPortfolioIds = normalizePortfolioIds(input.requestedPortfolioIds);
  const availablePortfolioIds = normalizePortfolioIds(
    input.activityContext.selectedPortfolios.map((portfolio) => portfolio.id),
  );

  if (availablePortfolioIds.length === 0) {
    return null;
  }

  const contextualActivities = toContextualActivities(input.activityContext, availablePortfolioIds);
  const normalization = normalizeActivities(contextualActivities);
  const aggregation = buildGlobalAssetsFromNormalizationResult(normalization);
  const freshnessAt =
    input.activityContext.freshness.updatedAt ?? input.activityContext.freshness.loadedAt ?? null;
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  return projectGlobalAssetsProductReadModel({
    aggregation,
    generatedAt,
    readModelId: `product-read-model:global-assets:${generatedAt}`,
    snapshotId: input.activityContext.freshness.scope.fingerprint
      ? `activity-snapshot:${input.activityContext.freshness.scope.fingerprint}`
      : null,
    sourceType: mapSourceType(input.activityContext.freshness.source),
    sourceScope: "selected_portfolios",
    freshnessAt,
    freshnessState: mapFreshnessState(input.activityContext.freshness.status),
    scopeState: mapScopeState({
      requestedPortfolioIds,
      availablePortfolioIds,
    }),
    selectedPortfolioIds: availablePortfolioIds,
    providerRequestCount: null,
  });
}
