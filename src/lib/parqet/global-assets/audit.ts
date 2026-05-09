import { buildGlobalAssetsFromNormalizationResult } from "./aggregate";
import { normalizeActivities } from "./normalize";
import type {
  ActivitiesNormalizationResult,
  GlobalAsset,
  GlobalAssetAggregationResult,
  MoneyValue,
  NormalizedActivity,
  ParqetActivityWithPortfolioContext,
  ReconciliationWarning,
  ReconciliationWarningSeverity,
} from "./types";

export type GlobalAssetAuditEnvironment = "development" | "test" | "production" | "unknown";

export type GlobalAssetAuditOptions = {
  includeActivities?: boolean;
  includeAmounts?: boolean;
  includePortfolioNames?: boolean;
  includeActivityIds?: boolean;
  limit?: number | null;
};

export type GlobalAssetAuditSources = {
  sourceActivityCount: number;
  selectedPortfolioCount?: number;
  portfolioFilterApplied?: boolean;
  note?: string;
};

export type GlobalAssetAuditPrivacy = {
  rawPayloadsExcluded: true;
  portfolioNamesIncluded: boolean;
  portfolioNamesRedacted: boolean;
  activityIdsIncluded: boolean;
  amountsIncluded: boolean;
  isinsIncluded: true;
  limitApplied: number | null;
};

export type GlobalAssetAuditSummary = {
  sourceActivityCount: number;
  normalizedActivityCount: number;
  assetCount: number;
  unassignedActivityCount: number;
  warningCount: number;
  blockerCount: number;
  activeAssetCount: number;
  closedAssetCount: number;
  unknownAssetCount: number;
  mixedCurrencyAssetCount: number;
  negativeQuantityAssetCount: number;
  warningsBySeverity: Record<ReconciliationWarningSeverity, number>;
  warningsByCode: Record<string, number>;
};

export type GlobalAssetAuditReport = {
  generatedAt: string;
  environment: GlobalAssetAuditEnvironment;
  sources: GlobalAssetAuditSources;
  normalization: {
    summary: ActivitiesNormalizationResult["summary"];
    activities: NormalizedActivity[];
    warnings: ReconciliationWarning[];
  };
  aggregation: {
    summary: GlobalAssetAggregationResult["summary"];
    assets: GlobalAsset[];
    unassignedActivities: NormalizedActivity[];
    warnings: ReconciliationWarning[];
  };
  warnings: ReconciliationWarning[];
  summary: GlobalAssetAuditSummary;
  privacy: GlobalAssetAuditPrivacy;
  nextSteps: string[];
};

type CreateGlobalAssetAuditReportInput = {
  normalization: ActivitiesNormalizationResult;
  aggregation: GlobalAssetAggregationResult;
  options?: GlobalAssetAuditOptions;
  sources?: Partial<GlobalAssetAuditSources>;
  environment?: GlobalAssetAuditEnvironment;
};

function normalizeEnvironment(value: string | undefined): GlobalAssetAuditEnvironment {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  return "unknown";
}

function getLimit(options?: GlobalAssetAuditOptions): number | null {
  const rawLimit = options?.limit;

  if (rawLimit === null || rawLimit === undefined) {
    return null;
  }

  if (!Number.isFinite(rawLimit) || rawLimit < 1) {
    return null;
  }

  return Math.floor(rawLimit);
}

function buildPortfolioAliasMap(activities: NormalizedActivity[], assets: GlobalAsset[]): Map<string, string> {
  const portfolioIds = new Set<string>();

  for (const activity of activities) {
    portfolioIds.add(activity.portfolioContext.portfolioId);
  }

  for (const asset of assets) {
    for (const breakdown of asset.portfolioBreakdowns) {
      portfolioIds.add(breakdown.portfolioId);
    }
  }

  return new Map(Array.from(portfolioIds).map((portfolioId, index) => [portfolioId, `Portfolio ${index + 1}`]));
}

function redactMoney(value: MoneyValue | null | undefined, includeAmounts: boolean): MoneyValue | null | undefined {
  return includeAmounts ? value : null;
}

function redactWarning(warning: ReconciliationWarning, includeActivityIds: boolean): ReconciliationWarning {
  return {
    ...warning,
    entityRefs: warning.entityRefs
      ? {
          ...warning.entityRefs,
          activityId: includeActivityIds ? warning.entityRefs.activityId : null,
        }
      : undefined,
  };
}

function redactActivity(
  activity: NormalizedActivity,
  options: Required<Pick<GlobalAssetAuditOptions, "includeAmounts" | "includePortfolioNames" | "includeActivityIds">>,
  portfolioAliases: Map<string, string>
): NormalizedActivity {
  const portfolioId = activity.portfolioContext.portfolioId;

  return {
    ...activity,
    ids: {
      sourceActivityId: options.includeActivityIds ? activity.ids.sourceActivityId : null,
      internalActivityId: options.includeActivityIds ? activity.ids.internalActivityId : "redacted",
    },
    portfolioContext: {
      ...activity.portfolioContext,
      portfolioName: options.includePortfolioNames
        ? activity.portfolioContext.portfolioName ?? null
        : portfolioAliases.get(portfolioId) ?? "Portfolio",
    },
    pricePerShare: redactMoney(activity.pricePerShare, options.includeAmounts),
    amounts: {
      amount: redactMoney(activity.amounts.amount, options.includeAmounts),
      amountNet: redactMoney(activity.amounts.amountNet, options.includeAmounts),
      fee: redactMoney(activity.amounts.fee, options.includeAmounts),
      tax: redactMoney(activity.amounts.tax, options.includeAmounts),
      buyAmountNet: redactMoney(activity.amounts.buyAmountNet, options.includeAmounts),
    },
    parqetReference: activity.parqetReference
      ? {
          realizedGains: redactMoney(activity.parqetReference.realizedGains, options.includeAmounts),
          realizedGainsNet: redactMoney(activity.parqetReference.realizedGainsNet, options.includeAmounts),
          buyAmountNet: redactMoney(activity.parqetReference.buyAmountNet, options.includeAmounts),
          avgHoldingPeriodDays: activity.parqetReference.avgHoldingPeriodDays ?? null,
        }
      : null,
  };
}

function redactAsset(
  asset: GlobalAsset,
  options: Required<Pick<GlobalAssetAuditOptions, "includeAmounts" | "includePortfolioNames" | "includeActivityIds">>,
  portfolioAliases: Map<string, string>
): GlobalAsset {
  return {
    ...asset,
    timeline: asset.timeline.map((entry) => {
      const redactedActivity = redactActivity(entry.activity, options, portfolioAliases);

      return {
        ...entry,
        activity: redactedActivity,
        portfolioContext: redactedActivity.portfolioContext,
        warnings: entry.warnings.map((warning) => redactWarning(warning, options.includeActivityIds)),
      };
    }),
    portfolioBreakdowns: asset.portfolioBreakdowns.map((breakdown) => ({
      ...breakdown,
      portfolioName: options.includePortfolioNames
        ? breakdown.portfolioName ?? null
        : portfolioAliases.get(breakdown.portfolioId) ?? "Portfolio",
      marketValue: redactMoney(breakdown.marketValue, options.includeAmounts),
      costBasis: redactMoney(breakdown.costBasis, options.includeAmounts),
      pnl: redactMoney(breakdown.pnl, options.includeAmounts),
      avgBuyPrice: redactMoney(breakdown.avgBuyPrice, options.includeAmounts),
      warnings: breakdown.warnings.map((warning) => redactWarning(warning, options.includeActivityIds)),
    })),
    warnings: asset.warnings.map((warning) => redactWarning(warning, options.includeActivityIds)),
    totals: {
      ...asset.totals,
      marketValue: redactMoney(asset.totals.marketValue, options.includeAmounts),
      costBasis: redactMoney(asset.totals.costBasis, options.includeAmounts),
      unrealizedPnL: redactMoney(asset.totals.unrealizedPnL, options.includeAmounts),
      dividendsNet: redactMoney(asset.totals.dividendsNet, options.includeAmounts),
      fees: redactMoney(asset.totals.fees, options.includeAmounts),
      taxes: redactMoney(asset.totals.taxes, options.includeAmounts),
    },
  };
}

function countWarningsBySeverity(warnings: ReconciliationWarning[]): Record<ReconciliationWarningSeverity, number> {
  return warnings.reduce<Record<ReconciliationWarningSeverity, number>>(
    (counts, warning) => ({
      ...counts,
      [warning.severity]: counts[warning.severity] + 1,
    }),
    { Blocker: 0, Warning: 0, Info: 0 }
  );
}

function countWarningsByCode(warnings: ReconciliationWarning[]): Record<string, number> {
  return warnings.reduce<Record<string, number>>((counts, warning) => {
    const code = String(warning.code);
    return {
      ...counts,
      [code]: (counts[code] ?? 0) + 1,
    };
  }, {});
}

function buildNextSteps(summary: GlobalAssetAuditSummary): string[] {
  const nextSteps = [
    "Verify the report with local Parqet data only.",
    "Do not wire the Global Asset pipeline into production UI until the Phase-1 gate is complete.",
    "Continue with transfer handling and confidence refinement.",
  ];

  if (summary.unassignedActivityCount > 0) {
    nextSteps.unshift("Inspect unassigned activities and missing asset keys.");
  }

  if (summary.mixedCurrencyAssetCount > 0) {
    nextSteps.unshift("Inspect mixed-currency assets before trusting affected totals.");
  }

  return nextSteps;
}

export function createGlobalAssetAuditReport(input: CreateGlobalAssetAuditReportInput): GlobalAssetAuditReport {
  const limit = getLimit(input.options);
  const includeAmounts = input.options?.includeAmounts === true;
  const includePortfolioNames = input.options?.includePortfolioNames === true;
  const includeActivityIds = input.options?.includeActivityIds === true;
  const includeActivities = input.options?.includeActivities !== false;
  const privacyOptions = { includeAmounts, includePortfolioNames, includeActivityIds };
  const allUnredactedActivities = input.normalization.activities;
  const allUnredactedAssets = input.aggregation.assets;
  const portfolioAliases = buildPortfolioAliasMap(allUnredactedActivities, allUnredactedAssets);
  const limitedActivities = limit ? allUnredactedActivities.slice(0, limit) : allUnredactedActivities;
  const limitedAssets = limit ? allUnredactedAssets.slice(0, limit) : allUnredactedAssets;
  const limitedUnassigned = limit
    ? input.aggregation.unassignedActivities.slice(0, limit)
    : input.aggregation.unassignedActivities;
  const normalizationWarnings = input.normalization.warnings.map((warning) => redactWarning(warning, includeActivityIds));
  const aggregationWarnings = input.aggregation.warnings.map((warning) => redactWarning(warning, includeActivityIds));
  const warnings = [...normalizationWarnings, ...aggregationWarnings];
  const summary: GlobalAssetAuditSummary = {
    sourceActivityCount: input.sources?.sourceActivityCount ?? input.normalization.summary.inputCount,
    normalizedActivityCount: input.normalization.summary.normalizedCount,
    assetCount: input.aggregation.summary.assetCount,
    unassignedActivityCount: input.aggregation.summary.unassignedActivityCount,
    warningCount: warnings.length,
    blockerCount: warnings.filter((warning) => warning.severity === "Blocker").length,
    activeAssetCount: input.aggregation.summary.activeAssetCount,
    closedAssetCount: input.aggregation.summary.closedAssetCount,
    unknownAssetCount: input.aggregation.summary.unknownAssetCount,
    mixedCurrencyAssetCount: input.aggregation.summary.mixedCurrencyAssetCount,
    negativeQuantityAssetCount: input.aggregation.summary.negativeQuantityAssetCount,
    warningsBySeverity: countWarningsBySeverity(warnings),
    warningsByCode: countWarningsByCode(warnings),
  };

  return {
    generatedAt: new Date().toISOString(),
    environment: input.environment ?? normalizeEnvironment(process.env.NODE_ENV),
    sources: {
      sourceActivityCount: summary.sourceActivityCount,
      selectedPortfolioCount: input.sources?.selectedPortfolioCount,
      portfolioFilterApplied: input.sources?.portfolioFilterApplied,
      note: input.sources?.note,
    },
    normalization: {
      summary: input.normalization.summary,
      activities: includeActivities
        ? limitedActivities.map((activity) => redactActivity(activity, privacyOptions, portfolioAliases))
        : [],
      warnings: normalizationWarnings,
    },
    aggregation: {
      summary: input.aggregation.summary,
      assets: limitedAssets.map((asset) => redactAsset(asset, privacyOptions, portfolioAliases)),
      unassignedActivities: limitedUnassigned.map((activity) => redactActivity(activity, privacyOptions, portfolioAliases)),
      warnings: aggregationWarnings,
    },
    warnings,
    summary,
    privacy: {
      rawPayloadsExcluded: true,
      portfolioNamesIncluded: includePortfolioNames,
      portfolioNamesRedacted: !includePortfolioNames,
      activityIdsIncluded: includeActivityIds,
      amountsIncluded: includeAmounts,
      isinsIncluded: true,
      limitApplied: limit,
    },
    nextSteps: buildNextSteps(summary),
  };
}

export function runGlobalAssetPipelineAudit(
  contextualActivities: ParqetActivityWithPortfolioContext[],
  options?: GlobalAssetAuditOptions,
  sources?: Partial<GlobalAssetAuditSources>
): GlobalAssetAuditReport {
  const normalization = normalizeActivities(contextualActivities);
  const aggregation = buildGlobalAssetsFromNormalizationResult(normalization);

  return createGlobalAssetAuditReport({
    normalization,
    aggregation,
    options,
    sources: {
      sourceActivityCount: contextualActivities.length,
      ...sources,
    },
  });
}
