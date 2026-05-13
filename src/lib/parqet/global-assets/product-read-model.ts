import type {
  ActivityType,
  BlockedMetric,
  ConfidenceLevel,
  GlobalAssetAggregationResult,
  GlobalAssetKey,
  ReconciliationWarning,
  ReconciliationWarningSeverity,
  TimelineDisplayType,
} from "./types";

export type ProductReadModelSourceType =
  | "provider"
  | "app_calculated"
  | "local_snapshot"
  | "local_derived"
  | "derived"
  | "none";

export type ProductReadModelSourceScope =
  | "global"
  | "portfolio"
  | "selected_portfolios"
  | "asset"
  | "report"
  | "unknown";

export type ProductReadModelFreshnessState = "fresh" | "stale" | "expired" | "unknown";
export type ProductReadModelScopeState = "scope_match" | "scope_subset" | "scope_missing" | "scope_unknown";
export type ProductReadModelConfidence = ConfidenceLevel | "unknown";
export type ProductReadModelValueClassification =
  | "provider_reference"
  | "app_calculated"
  | "estimated"
  | "preliminary"
  | "blocked"
  | "none";

export type ProductReadModelWarning = {
  code: string;
  severity: ReconciliationWarningSeverity;
  source: string;
  blockedMetrics: BlockedMetric[];
};

export type ProductReadModelActivityTimelineItem = {
  activityId: string;
  activityType: ActivityType;
  displayType: TimelineDisplayType;
  datetime: string | null;
  date: string | null;
  assetKey: GlobalAssetKey | null;
  portfolioId: string;
  warnings: ProductReadModelWarning[];
  blockedMetrics: BlockedMetric[];
  confidence: ProductReadModelConfidence;
  valueClassification: ProductReadModelValueClassification;
};

export type ProductReadModelMetadata = {
  readModelId: string;
  snapshotId: string | null;
  generatedAt: string;
  sourceType: ProductReadModelSourceType;
  sourceScope: ProductReadModelSourceScope;
  freshnessAt: string | null;
  freshnessState: ProductReadModelFreshnessState;
  scopeState: ProductReadModelScopeState;
  selectedPortfolioIds: string[];
  confidence: ProductReadModelConfidence;
  warnings: ProductReadModelWarning[];
  blockedMetrics: BlockedMetric[];
  valueClassification: ProductReadModelValueClassification;
  providerRequestCount: number | null;
};

export type ProductReadModelActivitiesTimeline = {
  metadata: ProductReadModelMetadata;
  items: ProductReadModelActivityTimelineItem[];
  summary: {
    itemCount: number;
    warningItemCount: number;
    blockerWarningCount: number;
    blockedMetricItemCount: number;
    valueClassificationCounts: Record<ProductReadModelValueClassification, number>;
  };
};

export type CreateProductReadModelActivitiesTimelineInput = {
  aggregation: GlobalAssetAggregationResult;
  readModelId?: string;
  snapshotId?: string | null;
  generatedAt?: string;
  sourceType?: ProductReadModelSourceType;
  sourceScope?: ProductReadModelSourceScope;
  freshnessAt?: string | null;
  freshnessState?: ProductReadModelFreshnessState;
  scopeState?: ProductReadModelScopeState;
  selectedPortfolioIds?: string[];
  providerRequestCount?: number | null;
};

export type LegacyActivityComparisonInputItem = {
  type?: string | null;
  warningMessages?: unknown[] | null;
  hasOverrides?: boolean;
  overrideCount?: number | null;
  overrideFlags?: Record<string, unknown> | null;
  blockedMetrics?: unknown[] | null;
  isBlocked?: boolean;
};

export type ActivityItemsCompatibilityInputItem = {
  type?: string | null;
  warningMessages?: unknown[] | null;
  hasOverrides?: boolean | null;
  overrideCount?: number | null;
  overrideFlags?: Record<string, unknown> | null;
  blockedMetrics?: unknown[] | null;
  isBlocked?: boolean | null;
};

export type LegacyActivitiesTimelineComparisonSummary = {
  itemCount: number;
  warningItemCount: number;
  overrideItemCount: number;
  unknownTypeItemCount: number;
  blockedIndicatorItemCount: number;
  byType: Record<string, number>;
};

export type ProductReadModelComparisonEvidence = {
  current: LegacyActivitiesTimelineComparisonSummary;
  projected: {
    itemCount: number;
    warningItemCount: number;
    blockerWarningCount: number;
    blockedMetricItemCount: number;
    byType: Record<string, number>;
    valueClassificationCounts: Record<ProductReadModelValueClassification, number>;
  };
  delta: {
    itemCount: number;
    warningItemCount: number;
    blockedMetricItemCount: number;
  };
};

function uniqueBlockedMetrics(warnings: ProductReadModelWarning[]): BlockedMetric[] {
  return Array.from(
    new Set(warnings.flatMap((warning) => warning.blockedMetrics).filter((metric) => Boolean(metric))),
  );
}

function mapWarning(warning: ReconciliationWarning): ProductReadModelWarning {
  return {
    code: String(warning.code),
    severity: warning.severity,
    source: warning.source,
    blockedMetrics: warning.blockedMetrics ?? [],
  };
}

function hasBlockerWarning(warnings: ProductReadModelWarning[]): boolean {
  return warnings.some((warning) => warning.severity === "Blocker");
}

function deriveItemConfidence(
  baseConfidence: ConfidenceLevel,
  warnings: ProductReadModelWarning[],
): ProductReadModelConfidence {
  if (hasBlockerWarning(warnings)) {
    return "low";
  }

  if (warnings.length > 0 && baseConfidence === "high") {
    return "medium";
  }

  return baseConfidence;
}

function deriveValueClassification(
  warnings: ProductReadModelWarning[],
  blockedMetrics: BlockedMetric[],
  confidence: ProductReadModelConfidence,
): ProductReadModelValueClassification {
  if (hasBlockerWarning(warnings) || blockedMetrics.length > 0) {
    return "blocked";
  }

  if (warnings.length > 0 || confidence !== "high") {
    return "preliminary";
  }

  return "app_calculated";
}

function countBy<T>(items: T[], mapper: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = mapper(item);
    return {
      ...counts,
      [key]: (counts[key] ?? 0) + 1,
    };
  }, {});
}

function buildReadModelId(generatedAt: string): string {
  return `product-read-model:activities-timeline:${generatedAt}`;
}

function normalizePortfolioIds(ids?: string[]): string[] {
  if (!ids) {
    return [];
  }

  return Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)));
}

function toLegacyTypeBucket(type: string | null | undefined): string {
  const normalized = type?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : "unknown";
}

function hasBlockedIndicator(item: LegacyActivityComparisonInputItem): boolean {
  if (item.isBlocked) {
    return true;
  }

  return Array.isArray(item.blockedMetrics) && item.blockedMetrics.length > 0;
}

function getOverrideCountFromFlags(item: ActivityItemsCompatibilityInputItem): number {
  if (!item.overrideFlags) {
    return 0;
  }

  return Object.keys(item.overrideFlags).length;
}

export function mapActivityItemsToLegacyComparisonInput(
  items: ActivityItemsCompatibilityInputItem[],
): LegacyActivityComparisonInputItem[] {
  return items.map((item) => ({
    type: item.type,
    warningMessages: Array.isArray(item.warningMessages) ? item.warningMessages : [],
    hasOverrides: Boolean(item.hasOverrides),
    overrideCount: item.overrideCount ?? getOverrideCountFromFlags(item),
    overrideFlags: item.overrideFlags,
    blockedMetrics: Array.isArray(item.blockedMetrics) ? item.blockedMetrics : [],
    isBlocked: Boolean(item.isBlocked),
  }));
}

export function buildActivityItemsCompatibilityComparisonSummary(
  activityItems: ActivityItemsCompatibilityInputItem[],
): LegacyActivitiesTimelineComparisonSummary {
  return buildLegacyActivitiesTimelineComparisonSummary(
    mapActivityItemsToLegacyComparisonInput(activityItems),
  );
}

export function projectActivitiesTimelineProductReadModel(
  input: CreateProductReadModelActivitiesTimelineInput,
): ProductReadModelActivitiesTimeline {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const readModelWarnings = input.aggregation.warnings.map(mapWarning);
  const readModelBlockedMetrics = uniqueBlockedMetrics(readModelWarnings);
  const readModelConfidence: ProductReadModelConfidence = hasBlockerWarning(readModelWarnings)
    ? "low"
    : readModelWarnings.length > 0
      ? "medium"
      : "high";
  const readModelValueClassification = deriveValueClassification(
    readModelWarnings,
    readModelBlockedMetrics,
    readModelConfidence,
  );

  const flattened = input.aggregation.assets.flatMap((asset) =>
    asset.timeline.map((entry) => {
      const warnings = [...asset.warnings, ...entry.warnings].map(mapWarning);
      const blockedMetrics = uniqueBlockedMetrics(warnings);
      const confidence = deriveItemConfidence(asset.confidence.level, warnings);
      const valueClassification = deriveValueClassification(warnings, blockedMetrics, confidence);

      return {
        activityId: entry.activity.ids.internalActivityId,
        activityType: entry.activity.activityType,
        displayType: entry.displayType,
        datetime: entry.activity.datetime,
        date: entry.activity.date,
        assetKey: asset.assetKey,
        portfolioId: entry.activity.portfolioContext.portfolioId,
        warnings,
        blockedMetrics,
        confidence,
        valueClassification,
        sortKey: entry.sortKey,
      };
    }),
  );

  const items = flattened
    .map((item, index) => ({ ...item, index }))
    .sort((left, right) => {
      const sortByKey = left.sortKey.localeCompare(right.sortKey);
      return sortByKey !== 0 ? sortByKey : left.index - right.index;
    })
    .map((item) => {
      const { sortKey, index, ...projected } = item;
      void sortKey;
      void index;
      return projected;
    });

  const warningItemCount = items.filter((item) => item.warnings.length > 0).length;
  const blockerWarningCount = items.filter((item) =>
    item.warnings.some((warning) => warning.severity === "Blocker"),
  ).length;
  const blockedMetricItemCount = items.filter((item) => item.blockedMetrics.length > 0).length;
  const valueClassificationCounts = items.reduce<Record<ProductReadModelValueClassification, number>>(
    (counts, item) => ({
      ...counts,
      [item.valueClassification]: counts[item.valueClassification] + 1,
    }),
    {
      provider_reference: 0,
      app_calculated: 0,
      estimated: 0,
      preliminary: 0,
      blocked: 0,
      none: 0,
    },
  );

  return {
    metadata: {
      readModelId: input.readModelId ?? buildReadModelId(generatedAt),
      snapshotId: input.snapshotId ?? null,
      generatedAt,
      sourceType: input.sourceType ?? "app_calculated",
      sourceScope: input.sourceScope ?? "selected_portfolios",
      freshnessAt: input.freshnessAt ?? null,
      freshnessState: input.freshnessState ?? "unknown",
      scopeState: input.scopeState ?? "scope_unknown",
      selectedPortfolioIds: normalizePortfolioIds(input.selectedPortfolioIds),
      confidence: readModelConfidence,
      warnings: readModelWarnings,
      blockedMetrics: readModelBlockedMetrics,
      valueClassification: readModelValueClassification,
      providerRequestCount: input.providerRequestCount ?? null,
    },
    items,
    summary: {
      itemCount: items.length,
      warningItemCount,
      blockerWarningCount,
      blockedMetricItemCount,
      valueClassificationCounts,
    },
  };
}

export function buildLegacyActivitiesTimelineComparisonSummary(
  items: LegacyActivityComparisonInputItem[],
): LegacyActivitiesTimelineComparisonSummary {
  const byType = countBy(items, (item) => toLegacyTypeBucket(item.type));
  const warningItemCount = items.filter(
    (item) => Array.isArray(item.warningMessages) && item.warningMessages.length > 0,
  ).length;
  const overrideItemCount = items.filter(
    (item) => item.hasOverrides || (item.overrideCount ?? 0) > 0,
  ).length;
  const unknownTypeItemCount = items.filter((item) => toLegacyTypeBucket(item.type) === "unknown").length;
  const blockedIndicatorItemCount = items.filter((item) => hasBlockedIndicator(item)).length;

  return {
    itemCount: items.length,
    warningItemCount,
    overrideItemCount,
    unknownTypeItemCount,
    blockedIndicatorItemCount,
    byType,
  };
}

export function buildActivitiesTimelineComparisonEvidence(input: {
  currentItems: LegacyActivityComparisonInputItem[] | ActivityItemsCompatibilityInputItem[];
  projected: ProductReadModelActivitiesTimeline;
}): ProductReadModelComparisonEvidence {
  const currentSummary = buildLegacyActivitiesTimelineComparisonSummary(
    mapActivityItemsToLegacyComparisonInput(input.currentItems),
  );
  const projectedByType = countBy(input.projected.items, (item) => item.activityType);

  return {
    current: currentSummary,
    projected: {
      itemCount: input.projected.summary.itemCount,
      warningItemCount: input.projected.summary.warningItemCount,
      blockerWarningCount: input.projected.summary.blockerWarningCount,
      blockedMetricItemCount: input.projected.summary.blockedMetricItemCount,
      byType: projectedByType,
      valueClassificationCounts: input.projected.summary.valueClassificationCounts,
    },
    delta: {
      itemCount: input.projected.summary.itemCount - currentSummary.itemCount,
      warningItemCount: input.projected.summary.warningItemCount - currentSummary.warningItemCount,
      blockedMetricItemCount: input.projected.summary.blockedMetricItemCount,
    },
  };
}
