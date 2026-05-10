import type { Portfolio, ReconciliationWarning } from "../types";
import type { Activity } from "./activity-types";
import {
  getActivitySnapshot,
  getActivitySnapshotFreshness,
  saveActivitySnapshot,
  snapshotEntryToContext,
  snapshotEntryToFreshContext,
} from "./activity-snapshot";
import { loadActivitiesForPortfolios } from "./fetch-activities";
import { fetchAuthorizedPortfolios } from "./fetch-portfolios";
import { isRealSecurityActivity } from "./filters";
import type { NormalizedActivity } from "./normalization";
import { normalizeActivities } from "./normalization";
import { readActivityOverrides } from "./override-store";
import { applyOverrides, type CorrectedActivity } from "./overrides";
import { buildReconciliationWarnings } from "./reconciliation";

export type BuildActivityContextOptions = {
  /**
   * Explicitly allow provider-backed portfolio/activity fetches.
   * Defaults to false so omitted options stay snapshot/local-first.
   */
  refresh?: boolean;
};

export type ActivityContext = {
  authorizedPortfolios: Portfolio[];
  selectedPortfolios: Portfolio[];
  portfolioNameById: Map<string, string>;
  rawActivities: Activity[];
  rawActivityCount: number;
  filteredActivities: Activity[];
  normalizedActivities: NormalizedActivity[];
  correctedActivities: CorrectedActivity<NormalizedActivity>[];
  reconciliationWarnings: ReconciliationWarning[];
  freshness: import("../types").SnapshotFreshness;
};

export async function buildActivityContext(
  accessToken: string,
  portfolioIds: string[],
  options: BuildActivityContextOptions = {},
): Promise<ActivityContext> {
  const shouldRefresh = options.refresh ?? false;

  if (!shouldRefresh) {
    const snapshot = getActivitySnapshot(portfolioIds);

    if (snapshot) {
      return snapshotEntryToContext(snapshot);
    }

    return {
      authorizedPortfolios: [],
      selectedPortfolios: [],
      portfolioNameById: new Map(),
      rawActivities: [],
      rawActivityCount: 0,
      filteredActivities: [],
      normalizedActivities: [],
      correctedActivities: [],
      reconciliationWarnings: [],
      freshness: getActivitySnapshotFreshness(portfolioIds),
    };
  }
  const portfolios = await fetchAuthorizedPortfolios(accessToken);
  const selectedPortfolios = portfolios.filter((portfolio) =>
    portfolioIds.includes(portfolio.id),
  );

  const portfolioNameById = new Map<string, string>();

  for (const portfolio of portfolios) {
    portfolioNameById.set(portfolio.id, portfolio.name);
  }

  const rawActivities = await loadActivitiesForPortfolios(
    accessToken,
    portfolioIds,
  );
  const filteredActivities = rawActivities.filter(isRealSecurityActivity);
  const normalizedActivities = normalizeActivities(filteredActivities);
  const overrides = await readActivityOverrides();
  const correctedActivities = applyOverrides(normalizedActivities, overrides);
  const reconciliationWarnings =
    buildReconciliationWarnings(correctedActivities);
  const snapshot = saveActivitySnapshot({
    portfolioIds,
    authorizedPortfolios: portfolios,
    selectedPortfolios,
    portfolioNameByIdEntries: Array.from(portfolioNameById.entries()),
    rawActivityCount: rawActivities.length,
    filteredActivities,
    normalizedActivities,
    correctedActivities,
    reconciliationWarnings,
  });

  if (snapshot) {
    return snapshotEntryToFreshContext(snapshot);
  }

  return {
    authorizedPortfolios: portfolios,
    selectedPortfolios,
    portfolioNameById,
    rawActivities,
    rawActivityCount: rawActivities.length,
    filteredActivities,
    normalizedActivities,
    correctedActivities,
    reconciliationWarnings,
    freshness: {
      present: false,
      loadedAt: null,
      updatedAt: new Date().toISOString(),
      status: "missing",
      source: "provider",
      refreshStatus: "refreshed",
      stale: false,
      scope: {
        portfolioCount: portfolioIds.length,
        fingerprint: "not-cached",
      },
    },
  };
}
