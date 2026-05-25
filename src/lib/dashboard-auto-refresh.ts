export type DashboardAutoRefreshReason =
  | "missing_cache"
  | "stale_cache"
  | "portfolio_scope_changed";

export type DashboardAutoRefreshDecision = {
  shouldRefresh: boolean;
  reason: DashboardAutoRefreshReason | null;
  executionKey: string | null;
};

type ShouldAutoRefreshInput = {
  loadingPortfolios: boolean;
  loadingAssets: boolean;
  refreshingAssets: boolean;
  hasPortfolios: boolean;
  selectedPortfolioIds: string[];
  hasCachedData: boolean;
  isCacheStale: boolean;
  hasPendingPortfolioSelection: boolean;
  alreadyExecutedKeys: Set<string>;
};

function buildExecutionKey(
  reason: DashboardAutoRefreshReason,
  selectedPortfolioIds: string[],
): string {
  const sortedIds = [...selectedPortfolioIds].sort();
  return `${reason}:${sortedIds.join("|")}`;
}

export function shouldAutoRefreshDashboardData(
  input: ShouldAutoRefreshInput,
): DashboardAutoRefreshDecision {
  if (input.loadingPortfolios || input.loadingAssets || input.refreshingAssets) {
    return { shouldRefresh: false, reason: null, executionKey: null };
  }

  if (!input.hasPortfolios || input.selectedPortfolioIds.length === 0) {
    return { shouldRefresh: false, reason: null, executionKey: null };
  }

  const reason: DashboardAutoRefreshReason | null = !input.hasCachedData
    ? "missing_cache"
    : input.hasPendingPortfolioSelection
      ? "portfolio_scope_changed"
      : input.isCacheStale
        ? "stale_cache"
        : null;

  if (!reason) {
    return { shouldRefresh: false, reason: null, executionKey: null };
  }

  const executionKey = buildExecutionKey(reason, input.selectedPortfolioIds);
  if (input.alreadyExecutedKeys.has(executionKey)) {
    return { shouldRefresh: false, reason: null, executionKey: null };
  }

  return { shouldRefresh: true, reason, executionKey };
}
