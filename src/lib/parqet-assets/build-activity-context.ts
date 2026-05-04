import type { Portfolio, ReconciliationWarning } from "../types";
import type { Activity } from "./activity-types";
import { loadActivitiesForPortfolios } from "./fetch-activities";
import { fetchAuthorizedPortfolios } from "./fetch-portfolios";
import { isRealSecurityActivity } from "./filters";
import type { NormalizedActivity } from "./normalization";
import { normalizeActivities } from "./normalization";
import { readActivityOverrides } from "./override-store";
import { applyOverrides, type CorrectedActivity } from "./overrides";
import { buildReconciliationWarnings } from "./reconciliation";

export type ActivityContext = {
    authorizedPortfolios: Portfolio[];
    selectedPortfolios: Portfolio[];
    portfolioNameById: Map<string, string>;
    rawActivities: Activity[];
    filteredActivities: Activity[];
    normalizedActivities: NormalizedActivity[];
    correctedActivities: CorrectedActivity<NormalizedActivity>[];
    reconciliationWarnings: ReconciliationWarning[];
};

export async function buildActivityContext(
    accessToken: string,
    portfolioIds: string[]
): Promise<ActivityContext> {
    const portfolios = await fetchAuthorizedPortfolios(accessToken);
    const selectedPortfolios = portfolios.filter((portfolio) =>
        portfolioIds.includes(portfolio.id)
    );

    const portfolioNameById = new Map<string, string>();

    for (const portfolio of portfolios) {
        portfolioNameById.set(portfolio.id, portfolio.name);
    }

    const rawActivities = await loadActivitiesForPortfolios(accessToken, portfolioIds);
    const filteredActivities = rawActivities.filter(isRealSecurityActivity);
    const normalizedActivities = normalizeActivities(filteredActivities);
    const overrides = await readActivityOverrides();
    const correctedActivities = applyOverrides(normalizedActivities, overrides);
    const reconciliationWarnings = buildReconciliationWarnings(correctedActivities);

    return {
        authorizedPortfolios: portfolios,
        selectedPortfolios,
        portfolioNameById,
        rawActivities,
        filteredActivities,
        normalizedActivities,
        correctedActivities,
        reconciliationWarnings,
    };
}
