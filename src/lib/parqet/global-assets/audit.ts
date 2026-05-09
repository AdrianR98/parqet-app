import { buildGlobalAssetsFromNormalizationResult } from "./aggregate";
import { normalizeActivities } from "./normalize";
import type {
  ActivitiesNormalizationResult,
  AppliedGlobalAssetOverride,
  GlobalAsset,
  GlobalAssetAggregationResult,
  GlobalAssetKey,
  MoneyValue,
  NormalizedActivity,
  ParqetActivityWithPortfolioContext,
  ReconciliationWarning,
  ReconciliationWarningSeverity,
  UnresolvedDecisionCandidate,
} from "./types";

export type GlobalAssetAuditEnvironment = "development" | "test" | "production" | "unknown";

export type GlobalAssetAuditAssetFilter = {
  type: GlobalAssetKey["type"];
  value: string;
};

export type GlobalAssetAuditOptions = {
  includeActivities?: boolean;
  includeAssets?: boolean;
  includeAmounts?: boolean;
  includePortfolioNames?: boolean;
  includeActivityIds?: boolean;
  assetFilter?: GlobalAssetAuditAssetFilter | null;
  limit?: number | null;
};

export type GlobalAssetAuditSources = {
  sourceActivityCount: number;
  selectedPortfolioCount?: number;
  portfolioFilterApplied?: boolean;
  assetFilterApplied?: boolean;
  assetFilter?: GlobalAssetAuditAssetFilter | null;
  filteredActivityCount?: number;
  note?: string;
};

export type GlobalAssetAuditPrivacy = {
  rawPayloadsExcluded: true;
  portfolioNamesIncluded: boolean;
  portfolioNamesRedacted: boolean;
  portfolioIdsRedacted: boolean;
  holdingIdsRedacted: boolean;
  sortKeysRedacted: boolean;
  activityIdsIncluded: boolean;
  amountsIncluded: boolean;
  isinsIncluded: true;
  limitApplied: number | null;
  arraysLimited: boolean;
  warningsTruncated: boolean;
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
  unresolvedDecisionCandidateCount: number;
  appliedOverrideCount: number;
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
    activitiesTruncated: boolean;
    warningsTruncated: boolean;
  };
  aggregation: {
    summary: GlobalAssetAggregationResult["summary"];
    assets: GlobalAsset[];
    unassignedActivities: NormalizedActivity[];
    warnings: ReconciliationWarning[];
    unresolvedDecisionCandidates: UnresolvedDecisionCandidate[];
    appliedOverrides: AppliedGlobalAssetOverride[];
    assetsTruncated: boolean;
    unassignedActivitiesTruncated: boolean;
    warningsTruncated: boolean;
    unresolvedDecisionCandidatesTruncated: boolean;
    appliedOverridesTruncated: boolean;
    timelinesTruncated: boolean;
  };
  warnings: ReconciliationWarning[];
  warningsTruncated: boolean;
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

type RedactionOptions = Required<Pick<GlobalAssetAuditOptions, "includeAmounts" | "includePortfolioNames" | "includeActivityIds">>;

type ReportAliases = {
  portfolioNameById: Map<string, string>;
  portfolioIdById: Map<string, string>;
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

function limitArray<T>(items: T[], limit: number | null): { items: T[]; truncated: boolean } {
  if (!limit || items.length <= limit) {
    return { items, truncated: false };
  }

  return { items: items.slice(0, limit), truncated: true };
}

function matchesAssetFilter(activity: NormalizedActivity, assetFilter: GlobalAssetAuditAssetFilter | null | undefined): boolean {
  if (!assetFilter) {
    return true;
  }

  const assetKey = activity.assetIdentity.assetKey;
  return Boolean(assetKey && assetKey.type === assetFilter.type && assetKey.value === assetFilter.value);
}

function buildAliases(activities: NormalizedActivity[], assets: GlobalAsset[]): ReportAliases {
  const portfolioIds = new Set<string>();

  for (const activity of activities) {
    portfolioIds.add(activity.portfolioContext.portfolioId);
  }

  for (const asset of assets) {
    for (const breakdown of asset.portfolioBreakdowns) {
      portfolioIds.add(breakdown.portfolioId);
    }
  }

  const entries = Array.from(portfolioIds).map((portfolioId, index) => [portfolioId, index + 1] as const);

  return {
    portfolioNameById: new Map(entries.map(([portfolioId, number]) => [portfolioId, `Portfolio ${number}`])),
    portfolioIdById: new Map(entries.map(([portfolioId, number]) => [portfolioId, `portfolio_${number}`])),
  };
}

function redactMoney(value: MoneyValue | null | undefined, includeAmounts: boolean): MoneyValue | null | undefined {
  return includeAmounts ? value : null;
}

function redactPortfolioId(portfolioId: string | null | undefined, aliases: ReportAliases): string | null | undefined {
  if (!portfolioId) {
    return portfolioId;
  }

  return aliases.portfolioIdById.get(portfolioId) ?? "portfolio_redacted";
}

function redactActivityId(activityId: string | null | undefined, includeActivityIds: boolean): string | null | undefined {
  return includeActivityIds ? activityId : null;
}

function redactHoldingId(holdingId: string | null | undefined, includeActivityIds: boolean): string | null | undefined {
  return includeActivityIds ? holdingId : null;
}

function redactSortKey(sortKey: string, includeActivityIds: boolean): string {
  if (includeActivityIds) {
    return sortKey;
  }

  const [datePart] = sortKey.split("|");
  return `${datePart || "unknown-date"}|redacted`;
}

function redactAppliedOverride(
  appliedOverride: AppliedGlobalAssetOverride,
  options: RedactionOptions,
  aliases: ReportAliases
): AppliedGlobalAssetOverride {
  return {
    ...appliedOverride,
    portfolioId: redactPortfolioId(appliedOverride.portfolioId, aliases),
    activityId: redactActivityId(appliedOverride.activityId, options.includeActivityIds),
  };
}

function redactUnresolvedDecisionCandidate(
  candidate: UnresolvedDecisionCandidate,
  aliases: ReportAliases
): UnresolvedDecisionCandidate {
  return {
    ...candidate,
    portfolioId: redactPortfolioId(candidate.portfolioId, aliases),
  };
}

function redactWarning(
  warning: ReconciliationWarning,
  options: RedactionOptions,
  aliases: ReportAliases
): ReconciliationWarning {
  const redactedCause = warning.metadata?.negativeQuantityCause
    ? redactUnresolvedDecisionCandidate(
        { ...warning.metadata.negativeQuantityCause, metricsBlocked: true },
        aliases
      )
    : undefined;

  return {
    ...warning,
    entityRefs: warning.entityRefs
      ? {
          ...warning.entityRefs,
          activityId: options.includeActivityIds ? warning.entityRefs.activityId : null,
          portfolioId: redactPortfolioId(warning.entityRefs.portfolioId, aliases),
          holdingId: redactHoldingId(warning.entityRefs.holdingId, options.includeActivityIds),
        }
      : undefined,
    metadata: warning.metadata
      ? {
          ...warning.metadata,
          negativeQuantityCause: redactedCause,
        }
      : undefined,
  };
}

function redactActivity(
  activity: NormalizedActivity,
  options: RedactionOptions,
  aliases: ReportAliases
): NormalizedActivity {
  const portfolioId = activity.portfolioContext.portfolioId;
  const redactedPortfolioId = redactPortfolioId(portfolioId, aliases) ?? "portfolio_redacted";

  return {
    ...activity,
    ids: {
      sourceActivityId: options.includeActivityIds ? activity.ids.sourceActivityId : null,
      internalActivityId: options.includeActivityIds ? activity.ids.internalActivityId : "redacted",
    },
    sortKey: redactSortKey(activity.sortKey, options.includeActivityIds),
    assetIdentity: {
      ...activity.assetIdentity,
      holdingId: redactHoldingId(activity.assetIdentity.holdingId, options.includeActivityIds) ?? null,
    },
    portfolioContext: {
      ...activity.portfolioContext,
      portfolioId: redactedPortfolioId,
      portfolioName: options.includePortfolioNames
        ? activity.portfolioContext.portfolioName ?? null
        : aliases.portfolioNameById.get(portfolioId) ?? "Portfolio",
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
    positionOverride: activity.positionOverride
      ? {
          ...redactAppliedOverride(activity.positionOverride, options, aliases),
          affectsPosition: activity.positionOverride.affectsPosition,
        }
      : activity.positionOverride,
  };
}

function redactAsset(
  asset: GlobalAsset,
  options: RedactionOptions,
  aliases: ReportAliases,
  limit: number | null
): { asset: GlobalAsset; timelineTruncated: boolean } {
  const limitedTimeline = limitArray(asset.timeline, limit);

  return {
    timelineTruncated: limitedTimeline.truncated,
    asset: {
      ...asset,
      timeline: limitedTimeline.items.map((entry) => {
        const redactedActivity = redactActivity(entry.activity, options, aliases);

        return {
          ...entry,
          activity: redactedActivity,
          portfolioContext: redactedActivity.portfolioContext,
          sortKey: redactSortKey(entry.sortKey, options.includeActivityIds),
          warnings: entry.warnings.map((warning) => redactWarning(warning, options, aliases)),
        };
      }),
      portfolioBreakdowns: asset.portfolioBreakdowns.map((breakdown) => ({
        ...breakdown,
        portfolioId: redactPortfolioId(breakdown.portfolioId, aliases) ?? "portfolio_redacted",
        portfolioName: options.includePortfolioNames
          ? breakdown.portfolioName ?? null
          : aliases.portfolioNameById.get(breakdown.portfolioId) ?? "Portfolio",
        marketValue: redactMoney(breakdown.marketValue, options.includeAmounts),
        costBasis: redactMoney(breakdown.costBasis, options.includeAmounts),
        pnl: redactMoney(breakdown.pnl, options.includeAmounts),
        avgBuyPrice: redactMoney(breakdown.avgBuyPrice, options.includeAmounts),
        warnings: breakdown.warnings.map((warning) => redactWarning(warning, options, aliases)),
      })),
      warnings: asset.warnings.map((warning) => redactWarning(warning, options, aliases)),
      unresolvedDecisionCandidates: asset.unresolvedDecisionCandidates?.map((candidate) =>
        redactUnresolvedDecisionCandidate(candidate, aliases)
      ),
      totals: {
        ...asset.totals,
        marketValue: redactMoney(asset.totals.marketValue, options.includeAmounts),
        costBasis: redactMoney(asset.totals.costBasis, options.includeAmounts),
        unrealizedPnL: redactMoney(asset.totals.unrealizedPnL, options.includeAmounts),
        dividendsNet: redactMoney(asset.totals.dividendsNet, options.includeAmounts),
        fees: redactMoney(asset.totals.fees, options.includeAmounts),
        taxes: redactMoney(asset.totals.taxes, options.includeAmounts),
      },
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
    "Reconnect Parqet and reauthorize all current portfolios if portfolios were added, renamed or missing.",
    "Verify the report with local Parqet data only.",
    "Do not wire the Global Asset pipeline into production UI until the Phase-1 gate is complete.",
    "Transfer matching is not implemented yet; treat transfer-related quantities as preliminary.",
    "Continue with transfer handling and confidence refinement.",
  ];

  if (summary.appliedOverrideCount > 0) {
    nextSteps.unshift("Review applied overrides and keep real local override decisions out of commits.");
  }

  if (summary.unresolvedDecisionCandidateCount > 0) {
    nextSteps.unshift("Review unresolved decision candidates before unblocking affected metrics.");
  }

  if (summary.unassignedActivityCount > 0) {
    nextSteps.unshift("Inspect unassigned activities and missing asset keys.");
  }

  if (summary.mixedCurrencyAssetCount > 0) {
    nextSteps.unshift("Inspect mixed-currency assets before trusting affected totals.");
  }

  if (summary.negativeQuantityAssetCount > 0) {
    nextSteps.unshift("Treat negative quantities as preliminary until transfer handling and portfolio authorization are verified.");
  }

  return nextSteps;
}

export function createGlobalAssetAuditReport(input: CreateGlobalAssetAuditReportInput): GlobalAssetAuditReport {
  const limit = getLimit(input.options);
  const includeAmounts = input.options?.includeAmounts === true;
  const includePortfolioNames = input.options?.includePortfolioNames === true;
  const includeActivityIds = input.options?.includeActivityIds === true;
  const includeActivities = input.options?.includeActivities === true;
  const includeAssets = input.options?.includeAssets !== false;
  const privacyOptions = { includeAmounts, includePortfolioNames, includeActivityIds };
  const allUnredactedActivities = input.normalization.activities;
  const allUnredactedAssets = input.aggregation.assets;
  const aliases = buildAliases(allUnredactedActivities, allUnredactedAssets);
  const limitedActivities = limitArray(allUnredactedActivities, limit);
  const limitedAssets = limitArray(allUnredactedAssets, limit);
  const limitedUnassigned = limitArray(input.aggregation.unassignedActivities, limit);
  const unresolvedDecisionCandidates = input.aggregation.unresolvedDecisionCandidates ?? [];
  const appliedOverrides = input.aggregation.appliedOverrides ?? [];
  const limitedUnresolvedDecisionCandidates = limitArray(unresolvedDecisionCandidates, limit);
  const limitedAppliedOverrides = limitArray(appliedOverrides, limit);
  const redactedAllNormalizationWarnings = input.normalization.warnings.map((warning) =>
    redactWarning(warning, privacyOptions, aliases)
  );
  const redactedAllAggregationWarnings = input.aggregation.warnings.map((warning) =>
    redactWarning(warning, privacyOptions, aliases)
  );
  const limitedNormalizationWarnings = limitArray(redactedAllNormalizationWarnings, limit);
  const limitedAggregationWarnings = limitArray(redactedAllAggregationWarnings, limit);
  const allWarnings = [...redactedAllNormalizationWarnings, ...redactedAllAggregationWarnings];
  const limitedFlatWarnings = limitArray(allWarnings, limit);
  const redactedAssets = includeAssets
    ? limitedAssets.items.map((asset) => redactAsset(asset, privacyOptions, aliases, limit))
    : [];
  const timelinesTruncated = redactedAssets.some((item) => item.timelineTruncated);
  const summary: GlobalAssetAuditSummary = {
    sourceActivityCount: input.sources?.sourceActivityCount ?? input.normalization.summary.inputCount,
    normalizedActivityCount: input.normalization.summary.normalizedCount,
    assetCount: input.aggregation.summary.assetCount,
    unassignedActivityCount: input.aggregation.summary.unassignedActivityCount,
    warningCount: allWarnings.length,
    blockerCount: allWarnings.filter((warning) => warning.severity === "Blocker").length,
    activeAssetCount: input.aggregation.summary.activeAssetCount,
    closedAssetCount: input.aggregation.summary.closedAssetCount,
    unknownAssetCount: input.aggregation.summary.unknownAssetCount,
    mixedCurrencyAssetCount: input.aggregation.summary.mixedCurrencyAssetCount,
    negativeQuantityAssetCount: input.aggregation.summary.negativeQuantityAssetCount,
    unresolvedDecisionCandidateCount: unresolvedDecisionCandidates.length,
    appliedOverrideCount: appliedOverrides.length,
    warningsBySeverity: countWarningsBySeverity(allWarnings),
    warningsByCode: countWarningsByCode(allWarnings),
  };

  return {
    generatedAt: new Date().toISOString(),
    environment: input.environment ?? normalizeEnvironment(process.env.NODE_ENV),
    sources: {
      sourceActivityCount: summary.sourceActivityCount,
      selectedPortfolioCount: input.sources?.selectedPortfolioCount,
      portfolioFilterApplied: input.sources?.portfolioFilterApplied,
      assetFilterApplied: input.sources?.assetFilterApplied,
      assetFilter: input.sources?.assetFilter,
      filteredActivityCount: input.sources?.filteredActivityCount,
      note: input.sources?.note,
    },
    normalization: {
      summary: input.normalization.summary,
      activities: includeActivities
        ? limitedActivities.items.map((activity) => redactActivity(activity, privacyOptions, aliases))
        : [],
      warnings: limitedNormalizationWarnings.items,
      activitiesTruncated: includeActivities ? limitedActivities.truncated : false,
      warningsTruncated: limitedNormalizationWarnings.truncated,
    },
    aggregation: {
      summary: input.aggregation.summary,
      assets: redactedAssets.map((item) => item.asset),
      unassignedActivities: includeAssets
        ? limitedUnassigned.items.map((activity) => redactActivity(activity, privacyOptions, aliases))
        : [],
      warnings: limitedAggregationWarnings.items,
      unresolvedDecisionCandidates: limitedUnresolvedDecisionCandidates.items.map((candidate) =>
        redactUnresolvedDecisionCandidate(candidate, aliases)
      ),
      appliedOverrides: limitedAppliedOverrides.items.map((appliedOverride) =>
        redactAppliedOverride(appliedOverride, privacyOptions, aliases)
      ),
      assetsTruncated: includeAssets ? limitedAssets.truncated : false,
      unassignedActivitiesTruncated: includeAssets ? limitedUnassigned.truncated : false,
      warningsTruncated: limitedAggregationWarnings.truncated,
      unresolvedDecisionCandidatesTruncated: limitedUnresolvedDecisionCandidates.truncated,
      appliedOverridesTruncated: limitedAppliedOverrides.truncated,
      timelinesTruncated,
    },
    warnings: limitedFlatWarnings.items,
    warningsTruncated: limitedFlatWarnings.truncated,
    summary,
    privacy: {
      rawPayloadsExcluded: true,
      portfolioNamesIncluded: includePortfolioNames,
      portfolioNamesRedacted: !includePortfolioNames,
      portfolioIdsRedacted: true,
      holdingIdsRedacted: !includeActivityIds,
      sortKeysRedacted: !includeActivityIds,
      activityIdsIncluded: includeActivityIds,
      amountsIncluded: includeAmounts,
      isinsIncluded: true,
      limitApplied: limit,
      arraysLimited: Boolean(limit),
      warningsTruncated:
        limitedFlatWarnings.truncated || limitedAggregationWarnings.truncated || limitedNormalizationWarnings.truncated,
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
  const assetFilter = options?.assetFilter ?? null;
  const filteredActivities = assetFilter
    ? normalization.activities.filter((activity) => matchesAssetFilter(activity, assetFilter))
    : normalization.activities;
  const filteredNormalization: ActivitiesNormalizationResult = assetFilter
    ? {
        ...normalization,
        activities: filteredActivities,
        results: normalization.results.filter((result) =>
          result.activity ? matchesAssetFilter(result.activity, assetFilter) : false
        ),
        warnings: normalization.warnings.filter((warning) =>
          warning.entityRefs?.assetKey
            ? warning.entityRefs.assetKey.type === assetFilter.type && warning.entityRefs.assetKey.value === assetFilter.value
            : false
        ),
        summary: {
          ...normalization.summary,
          inputCount: filteredActivities.length,
          normalizedCount: filteredActivities.length,
          rejectedCount: 0,
          warningCount: normalization.warnings.filter((warning) =>
            warning.entityRefs?.assetKey
              ? warning.entityRefs.assetKey.type === assetFilter.type && warning.entityRefs.assetKey.value === assetFilter.value
              : false
          ).length,
          blockerCount: normalization.warnings.filter((warning) =>
            warning.severity === "Blocker" && warning.entityRefs?.assetKey?.type === assetFilter.type && warning.entityRefs.assetKey.value === assetFilter.value
          ).length,
          duplicateInternalIdCount: 0,
        },
      }
    : normalization;
  const aggregation = buildGlobalAssetsFromNormalizationResult(filteredNormalization);

  return createGlobalAssetAuditReport({
    normalization: filteredNormalization,
    aggregation,
    options,
    sources: {
      sourceActivityCount: contextualActivities.length,
      assetFilterApplied: Boolean(assetFilter),
      assetFilter,
      filteredActivityCount: filteredActivities.length,
      ...sources,
    },
  });
}
