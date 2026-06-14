import type {
  ActivityType,
  BlockedMetric,
  ConfidenceLevel,
  GlobalAsset,
  GlobalAssetAggregationResult,
  GlobalAssetKey,
  FxRateSnapshot,
  MoneyValue,
  ReconciliationWarning,
  ReconciliationWarningSeverity,
  TimelineDisplayType,
} from "./types";
import {
  logValuationInvariant,
  summarizeDiagnostics,
} from "../../debug/dev-diagnostics";
import {
  buildExtendedKpiMoneyMetric,
  calculateAnnualizedDividendIncome,
  calculateActivityKpis,
  calculateDataConfidenceScore,
  calculateCurrentDividendYield,
  calculateDividendGrowth1y,
  calculateDividendGrowth3y,
  calculateDividendYieldOnCost,
  calculateDividendKpis,
  calculateIncomeReturn,
  calculateMarketPriceFreshness,
  calculateMetadataCompletenessScore,
  calculatePayoutFrequency,
  calculatePortfolioDataConfidenceScore,
  calculatePortfolioStructureKpis,
  calculatePortfolioWeight,
  calculatePriceReturnExcludingDividends,
  calculateTotalReturnIncludingDividends,
  type ExtendedKpiAllocationByAssetTypeMetric,
  type ExtendedKpiMarketPriceFreshnessMetric,
  type ExtendedKpiMetricStatus,
  type ExtendedKpiMoneyMetric,
  type ExtendedKpiPayoutFrequencyMetric,
  type ExtendedKpiRatioMetric,
} from "../../calculations/extended-kpi-metrics";

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

export type ActivitiesTimelineShadowComparisonStatus =
  | "available"
  | "stale"
  | "scope_mismatch"
  | "missing"
  | "unavailable";

export type ActivitiesTimelineShadowComparison = {
  status: ActivitiesTimelineShadowComparisonStatus;
  current: LegacyActivitiesTimelineComparisonSummary;
  projected: ProductReadModelComparisonEvidence["projected"] | null;
  delta: {
    itemCount: number | null;
    warningItemCount: number | null;
    blockedIndicatorOrMetricItemCount: number | null;
    byType: Record<string, number> | null;
  };
};

export type ActivitiesTimelineShadowDiagnosticStatus =
  | "ready"
  | "missing"
  | "stale"
  | "scope_mismatch"
  | "unavailable";

export type ActivitiesTimelineShadowDiagnosticHarness = {
  status: ActivitiesTimelineShadowDiagnosticStatus;
  reviewReady: boolean;
  summary: {
    currentItemCount: number;
    projectedItemCount: number | null;
    itemDelta: number | null;
    warningDelta: number | null;
    blockedDelta: number | null;
    byTypeDelta: Record<string, number> | null;
  };
  evidence: ActivitiesTimelineShadowComparison;
};

export type ActivitiesTimelinePrmFeatureFlagSelectionReason =
  | "feature_flag_disabled"
  | "diagnostic_ready"
  | "diagnostic_missing"
  | "diagnostic_stale"
  | "diagnostic_scope_mismatch"
  | "diagnostic_unavailable"
  | "diagnostic_not_ready";

export type SelectActivitiesTimelinePrmFeatureFlagSourceInput = {
  currentItems: ActivityItemsCompatibilityInputItem[];
  projected?: ProductReadModelActivitiesTimeline | null;
  featureFlagEnabled: boolean;
  diagnosticHarness?: ActivitiesTimelineShadowDiagnosticHarness | null;
  statusOverride?: ActivitiesTimelineShadowComparisonStatus;
};

export type ActivitiesTimelinePrmFeatureFlagSelection = {
  selectedSource: "activityItems" | "productReadModel";
  reason: ActivitiesTimelinePrmFeatureFlagSelectionReason;
  selectedItemCount: number;
  diagnostic: {
    status: ActivitiesTimelineShadowDiagnosticStatus;
    reviewReady: boolean;
    currentItemCount: number;
    projectedItemCount: number | null;
    itemDelta: number | null;
    warningDelta: number | null;
    blockedDelta: number | null;
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

function resolveShadowComparisonStatus(
  projected: ProductReadModelActivitiesTimeline | null | undefined,
): ActivitiesTimelineShadowComparisonStatus {
  if (!projected) {
    return "missing";
  }

  if (projected.metadata.scopeState === "scope_missing" || projected.metadata.scopeState === "scope_unknown") {
    return "scope_mismatch";
  }

  if (projected.metadata.freshnessState === "stale" || projected.metadata.freshnessState === "expired") {
    return "stale";
  }

  return "available";
}

function buildTypeDelta(
  currentByType: Record<string, number>,
  projectedByType: Record<string, number>,
): Record<string, number> {
  const keys = new Set([...Object.keys(currentByType), ...Object.keys(projectedByType)]);
  const delta: Record<string, number> = {};

  for (const key of keys) {
    delta[key] = (projectedByType[key] ?? 0) - (currentByType[key] ?? 0);
  }

  return delta;
}

export function buildActivitiesTimelineShadowComparison(input: {
  currentItems: LegacyActivityComparisonInputItem[] | ActivityItemsCompatibilityInputItem[];
  projected?: ProductReadModelActivitiesTimeline | null;
  statusOverride?: ActivitiesTimelineShadowComparisonStatus;
}): ActivitiesTimelineShadowComparison {
  const current = buildLegacyActivitiesTimelineComparisonSummary(
    mapActivityItemsToLegacyComparisonInput(input.currentItems),
  );
  const status = input.statusOverride ?? resolveShadowComparisonStatus(input.projected);

  if (status === "missing" || status === "unavailable" || !input.projected) {
    return {
      status,
      current,
      projected: null,
      delta: {
        itemCount: null,
        warningItemCount: null,
        blockedIndicatorOrMetricItemCount: null,
        byType: null,
      },
    };
  }

  const evidence = buildActivitiesTimelineComparisonEvidence({
    currentItems: input.currentItems,
    projected: input.projected,
  });

  return {
    status,
    current,
    projected: evidence.projected,
    delta: {
      itemCount: evidence.delta.itemCount,
      warningItemCount: evidence.delta.warningItemCount,
      blockedIndicatorOrMetricItemCount:
        evidence.projected.blockedMetricItemCount - evidence.current.blockedIndicatorItemCount,
      byType: buildTypeDelta(evidence.current.byType, evidence.projected.byType),
    },
  };
}

function mapShadowStatusToDiagnosticStatus(
  status: ActivitiesTimelineShadowComparisonStatus,
): ActivitiesTimelineShadowDiagnosticStatus {
  if (status === "available") {
    return "ready";
  }

  if (status === "scope_mismatch") {
    return "scope_mismatch";
  }

  if (status === "stale") {
    return "stale";
  }

  if (status === "unavailable") {
    return "unavailable";
  }

  return "missing";
}

function mapDiagnosticStatusToFallbackReason(
  status: ActivitiesTimelineShadowDiagnosticStatus,
): ActivitiesTimelinePrmFeatureFlagSelectionReason {
  if (status === "missing") {
    return "diagnostic_missing";
  }

  if (status === "stale") {
    return "diagnostic_stale";
  }

  if (status === "scope_mismatch") {
    return "diagnostic_scope_mismatch";
  }

  if (status === "unavailable") {
    return "diagnostic_unavailable";
  }

  return "diagnostic_not_ready";
}

export function buildActivitiesTimelineShadowDiagnosticHarness(input: {
  currentItems: LegacyActivityComparisonInputItem[] | ActivityItemsCompatibilityInputItem[];
  projected?: ProductReadModelActivitiesTimeline | null;
  statusOverride?: ActivitiesTimelineShadowComparisonStatus;
}): ActivitiesTimelineShadowDiagnosticHarness {
  const evidence = buildActivitiesTimelineShadowComparison(input);
  const status = mapShadowStatusToDiagnosticStatus(evidence.status);

  return {
    status,
    reviewReady: status === "ready",
    summary: {
      currentItemCount: evidence.current.itemCount,
      projectedItemCount: evidence.projected?.itemCount ?? null,
      itemDelta: evidence.delta.itemCount,
      warningDelta: evidence.delta.warningItemCount,
      blockedDelta: evidence.delta.blockedIndicatorOrMetricItemCount,
      byTypeDelta: evidence.delta.byType,
    },
    evidence,
  };
}

export function selectActivitiesTimelinePrmFeatureFlagSource(
  input: SelectActivitiesTimelinePrmFeatureFlagSourceInput,
): ActivitiesTimelinePrmFeatureFlagSelection {
  const diagnostic =
    input.diagnosticHarness ??
    buildActivitiesTimelineShadowDiagnosticHarness({
      currentItems: input.currentItems,
      projected: input.projected,
      statusOverride: input.statusOverride,
    });

  const projectedReady = Boolean(input.projected && diagnostic.status === "ready" && diagnostic.reviewReady);
  const canSelectProductReadModel = input.featureFlagEnabled && projectedReady;
  const selectedSource = canSelectProductReadModel ? "productReadModel" : "activityItems";
  const reason =
    canSelectProductReadModel
      ? "diagnostic_ready"
      : input.featureFlagEnabled
        ? mapDiagnosticStatusToFallbackReason(diagnostic.status)
        : "feature_flag_disabled";

  return {
    selectedSource,
    reason,
    selectedItemCount:
      selectedSource === "productReadModel"
        ? (diagnostic.summary.projectedItemCount ?? 0)
        : diagnostic.summary.currentItemCount,
    diagnostic: {
      status: diagnostic.status,
      reviewReady: diagnostic.reviewReady,
      currentItemCount: diagnostic.summary.currentItemCount,
      projectedItemCount: diagnostic.summary.projectedItemCount,
      itemDelta: diagnostic.summary.itemDelta,
      warningDelta: diagnostic.summary.warningDelta,
      blockedDelta: diagnostic.summary.blockedDelta,
    },
  };
}

export type ProductReadModelAssetStatus = "active" | "closed" | "unknown";

export type ProductReadModelAssetIdentity = {
  assetKey: GlobalAssetKey | null;
  stableKey: string | null;
  compatibilityIsin: string | null;
};

export type ProductReadModelAssetDisplayIdentity = {
  displayName: string;
  subtitle: string | null;
  symbol: string | null;
  wkn: string | null;
};

export type ProductReadModelAssetMoneyMetric = {
  amount: number | null;
  currency: string | null;
  valueClassification: ProductReadModelValueClassification;
  blockedMetrics: BlockedMetric[];
};

export type ProductReadModelFxRate = FxRateSnapshot;

export type ProductReadModelAssetValuation = {
  marketPrice: ProductReadModelAssetMoneyMetric;
  nativeMarketPrice: ProductReadModelAssetMoneyMetric;
  reportingMarketPrice: ProductReadModelAssetMoneyMetric;
  latestTradePrice: ProductReadModelAssetMoneyMetric;
  reportingCurrency: string | null;
  fxRate: ProductReadModelFxRate | null;
  fxStatus: "not_requested" | "not_required" | "converted" | "missing_rate";
  priceDate: string | null;
  priceTimestamp: string | null;
  priceSource: string | null;
  sourceKind: "market_data_db" | "latest_trade_price_fallback" | "missing";
  freshnessState: "fresh" | "stale" | "missing" | "unknown";
};

export type ProductReadModelAssetClassification = {
  assetType?: string | null;
  currency?: string | null;
  symbol?: string | null;
  primarySymbol?: string | null;
  wkn?: string | null;
};

export type ProductReadModelKpiMoneyMetric = ExtendedKpiMoneyMetric;
export type ProductReadModelKpiRatioMetric = ExtendedKpiRatioMetric;
export type ProductReadModelKpiMetricStatus = ExtendedKpiMetricStatus;
export type ProductReadModelMarketPriceFreshnessMetric = ExtendedKpiMarketPriceFreshnessMetric;
export type ProductReadModelAllocationByAssetTypeMetric = ExtendedKpiAllocationByAssetTypeMetric;
export type ProductReadModelPayoutFrequencyMetric = ExtendedKpiPayoutFrequencyMetric;

export type ProductReadModelAssetMetrics = {
  activity?: {
    grossBuyVolume?: ProductReadModelKpiMoneyMetric;
    grossSellVolume?: ProductReadModelKpiMoneyMetric;
    buyCount?: number;
    sellCount?: number;
  };
  income?: {
    dividendCount?: number;
    lastDividendDate?: string | null;
    annualizedDividendIncome?: ProductReadModelKpiMoneyMetric;
    dividendGrowth1y?: ProductReadModelKpiRatioMetric;
    dividendGrowth3y?: ProductReadModelKpiRatioMetric;
    payoutFrequency?: ProductReadModelPayoutFrequencyMetric;
    dividendYieldOnCost?: ProductReadModelKpiRatioMetric;
    currentDividendYield?: ProductReadModelKpiRatioMetric;
  };
  returns?: {
    incomeReturn?: ProductReadModelKpiRatioMetric;
    priceReturnExcludingDividends?: ProductReadModelKpiRatioMetric;
    totalReturnIncludingDividends?: ProductReadModelKpiRatioMetric;
  };
  structure?: {
    portfolioWeight?: ProductReadModelKpiRatioMetric;
  };
  quality?: {
    dataConfidenceScore?: number | null;
    marketPriceFreshness?: ProductReadModelMarketPriceFreshnessMetric;
    metadataCompletenessScore?: number | null;
    warningCount?: number;
  };
};

export type ProductReadModelSummaryMetrics = {
  activity?: {
    grossBuyVolume?: ProductReadModelKpiMoneyMetric;
    grossSellVolume?: ProductReadModelKpiMoneyMetric;
    buyCount?: number;
    sellCount?: number;
    dividendCount?: number;
    lastDividendDate?: string | null;
  };
  income?: {
    annualizedDividendIncome?: ProductReadModelKpiMoneyMetric;
    dividendGrowth1y?: ProductReadModelKpiRatioMetric;
    dividendGrowth3y?: ProductReadModelKpiRatioMetric;
    dividendYieldOnCost?: ProductReadModelKpiRatioMetric;
    currentDividendYield?: ProductReadModelKpiRatioMetric;
  };
  returns?: {
    incomeReturn?: ProductReadModelKpiRatioMetric;
    priceReturnExcludingDividends?: ProductReadModelKpiRatioMetric;
    totalReturnIncludingDividends?: ProductReadModelKpiRatioMetric;
  };
  structure?: {
    top5Concentration?: ProductReadModelKpiRatioMetric;
    top10Concentration?: ProductReadModelKpiRatioMetric;
    herfindahlIndex?: ProductReadModelKpiRatioMetric;
    allocationByAssetType?: ProductReadModelAllocationByAssetTypeMetric;
  };
  quality?: {
    dataConfidenceScore?: number | null;
    warningCount?: number;
  };
};

export type ProductReadModelAssetPortfolioBreakdown = {
  portfolioId: string;
  portfolioName: string | null;
  status: string;
  quantity: number | null;
  valuation: ProductReadModelAssetValuation;
  marketValue: ProductReadModelAssetMoneyMetric;
  costBasis: ProductReadModelAssetMoneyMetric;
  unrealizedPnL: ProductReadModelAssetMoneyMetric;
  dividendsNet: ProductReadModelAssetMoneyMetric;
  fees: ProductReadModelAssetMoneyMetric;
  taxes: ProductReadModelAssetMoneyMetric;
  warnings: ProductReadModelWarning[];
  blockedMetrics: BlockedMetric[];
  confidence: ProductReadModelConfidence;
};

export type ProductReadModelAssetRow = {
  identity: ProductReadModelAssetIdentity;
  display: ProductReadModelAssetDisplayIdentity;
  classification?: ProductReadModelAssetClassification;
  status: ProductReadModelAssetStatus;
  quantity: number | null;
  quantityValueClassification: ProductReadModelValueClassification;
  valuation: ProductReadModelAssetValuation;
  marketValue: ProductReadModelAssetMoneyMetric;
  costBasis: ProductReadModelAssetMoneyMetric;
  unrealizedPnL: ProductReadModelAssetMoneyMetric;
  dividendsNet: ProductReadModelAssetMoneyMetric;
  fees: ProductReadModelAssetMoneyMetric;
  taxes: ProductReadModelAssetMoneyMetric;
  warnings: ProductReadModelWarning[];
  blockedMetrics: BlockedMetric[];
  confidence: ProductReadModelConfidence;
  valueClassification: ProductReadModelValueClassification;
  sourceType: ProductReadModelSourceType;
  sourceScope: ProductReadModelSourceScope;
  freshnessState: ProductReadModelFreshnessState;
  scopeState: ProductReadModelScopeState;
  portfolioBreakdown: ProductReadModelAssetPortfolioBreakdown[];
  latestActivityAt: string | null;
  metrics?: ProductReadModelAssetMetrics;
};

export type ProductReadModelAssetsSummary = {
  assetCount: number;
  activeAssetCount: number;
  closedAssetCount: number;
  unknownAssetCount: number;
  warningAssetCount: number;
  blockerWarningCount: number;
  blockedMetricAssetCount: number;
  blockedMetricCount: number;
  valueClassificationCounts: Record<ProductReadModelValueClassification, number>;
  metrics?: ProductReadModelSummaryMetrics;
};

export type ProductReadModelAssets = {
  metadata: ProductReadModelMetadata;
  assets: ProductReadModelAssetRow[];
  summary: ProductReadModelAssetsSummary;
};

export type CreateProductReadModelAssetsInput = {
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

/**
 * Runtime fallback asset shape used for comparison diagnostics only.
 * This input is not the canonical Product Read Model calculation output.
 */
export type ProductReadModelRuntimeFallbackAssetInput = {
  isin?: string | null;
  positionValue?: number | null;
  unrealizedPnL?: number | null;
  totalDividendNet?: number | null;
  netShares?: number | null;
};

export type ProductReadModelAssetsComparisonEvidence = {
  compatibility: {
    assetCount: number;
    assetWithPositionValueCount: number;
    assetWithUnrealizedPnLCount: number;
    assetWithDividendCount: number;
    assetWithQuantityCount: number;
  };
  projected: {
    assetCount: number;
    blockedMetricAssetCount: number;
    blockedMetricCount: number;
    warningAssetCount: number;
    blockerWarningCount: number;
    withQuantityCount: number;
    withMarketValueCount: number;
    withCostBasisCount: number;
    withUnrealizedPnLCount: number;
    withDividendsCount: number;
    withFeesCount: number;
    withTaxesCount: number;
    byStatus: Record<ProductReadModelAssetStatus, number>;
  };
  delta: {
    assetCount: number;
    blockedMetricAssetCount: number;
    warningAssetCount: number;
    blockerWarningCount: number;
    quantityCoverage: number;
    marketValueCoverage: number;
    costBasisCoverage: number;
    unrealizedPnLCoverage: number;
    dividendsCoverage: number;
  };
};

function toStableAssetKey(assetKey: GlobalAssetKey | null): string | null {
  if (!assetKey) {
    return null;
  }

  return `${assetKey.type}:${assetKey.value}`;
}

function toCompatibilityIsin(assetKey: GlobalAssetKey | null): string | null {
  if (!assetKey || assetKey.type !== "isin") {
    return null;
  }

  return assetKey.value;
}

function mapMoneyMetric(
  value: MoneyValue | null | undefined,
  blockedMetrics: BlockedMetric[],
): ProductReadModelAssetMoneyMetric {
  const hasValue = Boolean(value);
  const hasBlockedMetric = blockedMetrics.length > 0;

  return {
    amount: value?.amount ?? null,
    currency: value?.currency ?? null,
    valueClassification: hasBlockedMetric ? "blocked" : hasValue ? "app_calculated" : "preliminary",
    blockedMetrics,
  };
}

function findLatestActivityAt(asset: GlobalAsset): string | null {
  const timelineDatetimes = asset.timeline
    .map((entry) => entry.activity.datetime)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (timelineDatetimes.length === 0) {
    return null;
  }

  return [...timelineDatetimes].sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
}

function deriveAssetValueClassification(
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

function deriveAssetStatus(status: string): ProductReadModelAssetStatus {
  if (status === "active" || status === "closed") {
    return status;
  }

  return "unknown";
}

function toWarningSignature(warning: ProductReadModelWarning): string {
  return [
    warning.code,
    warning.source,
    warning.severity,
    [...warning.blockedMetrics].sort().join(","),
  ].join("|");
}

function calculateSnapshotScopeWarningCount(input: {
  modelWarnings: ProductReadModelWarning[];
  assetWarnings: ProductReadModelWarning[][];
}): number {
  const assetWarningSignatures = new Set(
    input.assetWarnings.flat().map(toWarningSignature),
  );
  const nonOverlappingModelWarnings = input.modelWarnings.filter(
    (warning) => !assetWarningSignatures.has(toWarningSignature(warning)),
  );

  return (
    input.assetWarnings.reduce((sum, warnings) => sum + warnings.length, 0) +
    nonOverlappingModelWarnings.length
  );
}

function buildAssetMetrics(input: {
  asset: GlobalAsset;
  row: Pick<
    ProductReadModelAssetRow,
    "identity" | "display" | "classification" | "valuation" | "marketValue" | "costBasis" | "unrealizedPnL" | "dividendsNet" | "warnings"
  >;
  portfolioValue?: { amount: number | null; currency: string | null } | null;
}): ProductReadModelAssetMetrics {
  const activities = input.asset.timeline.map((entry) => ({
    activityType: entry.activity.activityType,
    amount: entry.activity.amounts.amount ?? null,
    amountNet: entry.activity.amounts.amountNet ?? null,
    date: entry.activity.date,
    datetime: entry.activity.datetime,
  }));
  const activityMetrics = calculateActivityKpis(activities);
  const dividendMetrics = calculateDividendKpis(activities);
  const annualizedDividendIncome = calculateAnnualizedDividendIncome({
    activities,
    fallbackCurrency:
      input.row.dividendsNet.currency ??
      input.row.costBasis.currency ??
      input.row.marketValue.currency ??
      input.row.classification?.currency ??
      null,
  });
  const payoutFrequency = calculatePayoutFrequency(activities);
  const dividendGrowth1y = calculateDividendGrowth1y({
    activities,
  });
  const dividendGrowth3y = calculateDividendGrowth3y({
    activities,
  });
  const metadataCompletenessScore = calculateMetadataCompletenessScore({
    displayName: input.row.display.displayName,
    name: input.row.display.displayName,
    isin: input.row.identity.compatibilityIsin,
    wkn: input.row.classification?.wkn ?? input.row.display.wkn,
    assetType: input.row.classification?.assetType ?? null,
    currency:
      input.row.classification?.currency ??
      input.row.marketValue.currency ??
      input.row.valuation.marketPrice.currency ??
      input.row.valuation.latestTradePrice.currency,
    symbol: input.row.display.symbol,
    primarySymbol: input.row.classification?.primarySymbol ?? input.row.classification?.symbol ?? null,
  });
  const warningCount = input.row.warnings.length;
  const dividendYieldOnCost = calculateDividendYieldOnCost({
    annualizedDividendIncome,
    remainingCostBasisAmount: input.row.costBasis.amount,
    remainingCostBasisCurrency: input.row.costBasis.currency,
  });
  const currentDividendYield = calculateCurrentDividendYield({
    annualizedDividendIncome,
    positionValueAmount: input.row.marketValue.amount,
    positionValueCurrency: input.row.marketValue.currency,
  });
  const incomeReturn = calculateIncomeReturn({
    totalDividendNetAmount: input.row.dividendsNet.amount,
    totalDividendNetCurrency: input.row.dividendsNet.currency,
    remainingCostBasisAmount: input.row.costBasis.amount,
    remainingCostBasisCurrency: input.row.costBasis.currency,
  });
  const priceReturnExcludingDividends = calculatePriceReturnExcludingDividends({
    unrealizedPnLAmount: input.row.unrealizedPnL.amount,
    unrealizedPnLCurrency: input.row.unrealizedPnL.currency,
    remainingCostBasisAmount: input.row.costBasis.amount,
    remainingCostBasisCurrency: input.row.costBasis.currency,
  });
  const totalReturnIncludingDividends = calculateTotalReturnIncludingDividends({
    unrealizedPnLAmount: input.row.unrealizedPnL.amount,
    unrealizedPnLCurrency: input.row.unrealizedPnL.currency,
    totalDividendNetAmount: input.row.dividendsNet.amount,
    totalDividendNetCurrency: input.row.dividendsNet.currency,
    remainingCostBasisAmount: input.row.costBasis.amount,
    remainingCostBasisCurrency: input.row.costBasis.currency,
  });

  return {
    activity: {
      grossBuyVolume: activityMetrics.grossBuyVolume,
      grossSellVolume: activityMetrics.grossSellVolume,
      buyCount: activityMetrics.buyCount,
      sellCount: activityMetrics.sellCount,
    },
    income: {
      dividendCount: dividendMetrics.dividendCount,
      lastDividendDate: dividendMetrics.lastDividendDate,
      annualizedDividendIncome,
      dividendGrowth1y,
      dividendGrowth3y,
      payoutFrequency,
      dividendYieldOnCost,
      currentDividendYield,
    },
    returns: {
      incomeReturn,
      priceReturnExcludingDividends,
      totalReturnIncludingDividends,
    },
    structure: {
      portfolioWeight: calculatePortfolioWeight({
        assetPositionValue: {
          amount: input.row.marketValue.amount,
          currency: input.row.marketValue.currency,
        },
        portfolioValue: input.portfolioValue ?? null,
      }),
    },
    quality: {
      dataConfidenceScore: calculateDataConfidenceScore({
        valuationSourceKind: input.row.valuation.sourceKind,
        freshnessState: input.row.valuation.freshnessState,
        metadataCompletenessScore,
        warningCount,
      }),
      marketPriceFreshness: calculateMarketPriceFreshness({
        priceDate: input.row.valuation.priceDate,
        priceTimestamp: input.row.valuation.priceTimestamp,
        sourceKind: input.row.valuation.sourceKind,
        freshnessState: input.row.valuation.freshnessState,
      }),
      metadataCompletenessScore,
      warningCount,
    },
  };
}

export function enrichGlobalAssetsProductReadModelMetrics(
  productReadModel: ProductReadModelAssets,
): ProductReadModelAssets {
  // Snapshot-scope summary metrics are valid for the PRM/API snapshot scope only.
  // Later UI rescoping must recompute or rescope these metrics instead of reusing
  // snapshot-wide summary values after a local portfolio-selection change.
  const portfolioStructure = calculatePortfolioStructureKpis({
    assets: productReadModel.assets.map((asset) => ({
      positionValue:
        asset.marketValue.amount != null
          ? {
              amount: asset.marketValue.amount,
              currency: asset.marketValue.currency,
            }
          : null,
      assetType: asset.classification?.assetType ?? null,
    })),
  });
  const assetRowsWithMetrics = productReadModel.assets.map((asset) => {
    const metadataCompletenessScore = calculateMetadataCompletenessScore({
      displayName: asset.display.displayName,
      name: asset.display.displayName,
      isin: asset.identity.compatibilityIsin,
      wkn: asset.classification?.wkn ?? asset.display.wkn,
      assetType: asset.classification?.assetType ?? null,
      currency:
        asset.classification?.currency ??
        asset.marketValue.currency ??
        asset.valuation.marketPrice.currency ??
        asset.valuation.latestTradePrice.currency,
      symbol: asset.display.symbol,
      primarySymbol: asset.classification?.primarySymbol ?? asset.classification?.symbol ?? null,
    });
    const portfolioValue = {
      amount: productReadModel.assets.reduce((sum, row) => sum + (row.marketValue.amount ?? 0), 0),
      currency: portfolioStructure.allocationByAssetType.currency,
    };

    return {
      ...asset,
      metrics: {
        ...(asset.metrics ?? {}),
        activity: {
          ...(asset.metrics?.activity ?? {}),
        },
        income: {
          ...(asset.metrics?.income ?? {}),
          annualizedDividendIncome:
            asset.metrics?.income?.annualizedDividendIncome ??
            calculateAnnualizedDividendIncome({
              activities: [],
              fallbackCurrency:
                asset.dividendsNet.currency ??
                asset.costBasis.currency ??
                asset.marketValue.currency ??
                asset.classification?.currency ??
                null,
            }),
          dividendGrowth1y:
            asset.metrics?.income?.dividendGrowth1y ??
            calculateDividendGrowth1y({
              activities: [],
            }),
          dividendGrowth3y:
            asset.metrics?.income?.dividendGrowth3y ??
            calculateDividendGrowth3y({
              activities: [],
            }),
          payoutFrequency: asset.metrics?.income?.payoutFrequency,
          dividendYieldOnCost:
            asset.metrics?.income?.dividendYieldOnCost ??
            calculateDividendYieldOnCost({
              annualizedDividendIncome:
                asset.metrics?.income?.annualizedDividendIncome ??
                calculateAnnualizedDividendIncome({
                  activities: [],
                  fallbackCurrency:
                    asset.dividendsNet.currency ??
                    asset.costBasis.currency ??
                    asset.marketValue.currency ??
                    asset.classification?.currency ??
                    null,
                }),
              remainingCostBasisAmount: asset.costBasis.amount,
              remainingCostBasisCurrency: asset.costBasis.currency,
            }),
          currentDividendYield:
            asset.metrics?.income?.currentDividendYield ??
            calculateCurrentDividendYield({
              annualizedDividendIncome:
                asset.metrics?.income?.annualizedDividendIncome ??
                calculateAnnualizedDividendIncome({
                  activities: [],
                  fallbackCurrency:
                    asset.dividendsNet.currency ??
                    asset.costBasis.currency ??
                    asset.marketValue.currency ??
                    asset.classification?.currency ??
                    null,
                }),
              positionValueAmount: asset.marketValue.amount,
              positionValueCurrency: asset.marketValue.currency,
            }),
        },
        returns: {
          ...(asset.metrics?.returns ?? {}),
          incomeReturn:
            asset.metrics?.returns?.incomeReturn ??
            calculateIncomeReturn({
              totalDividendNetAmount: asset.dividendsNet.amount,
              totalDividendNetCurrency: asset.dividendsNet.currency,
              remainingCostBasisAmount: asset.costBasis.amount,
              remainingCostBasisCurrency: asset.costBasis.currency,
            }),
          priceReturnExcludingDividends:
            asset.metrics?.returns?.priceReturnExcludingDividends ??
            calculatePriceReturnExcludingDividends({
              unrealizedPnLAmount: asset.unrealizedPnL.amount,
              unrealizedPnLCurrency: asset.unrealizedPnL.currency,
              remainingCostBasisAmount: asset.costBasis.amount,
              remainingCostBasisCurrency: asset.costBasis.currency,
            }),
          totalReturnIncludingDividends:
            asset.metrics?.returns?.totalReturnIncludingDividends ??
            calculateTotalReturnIncludingDividends({
              unrealizedPnLAmount: asset.unrealizedPnL.amount,
              unrealizedPnLCurrency: asset.unrealizedPnL.currency,
              totalDividendNetAmount: asset.dividendsNet.amount,
              totalDividendNetCurrency: asset.dividendsNet.currency,
              remainingCostBasisAmount: asset.costBasis.amount,
              remainingCostBasisCurrency: asset.costBasis.currency,
            }),
        },
        structure: {
          ...(asset.metrics?.structure ?? {}),
          portfolioWeight: calculatePortfolioWeight({
            assetPositionValue: {
              amount: asset.marketValue.amount,
              currency: asset.marketValue.currency,
            },
            portfolioValue,
          }),
        },
        quality: {
          ...(asset.metrics?.quality ?? {}),
          dataConfidenceScore: calculateDataConfidenceScore({
            valuationSourceKind: asset.valuation.sourceKind,
            freshnessState: asset.valuation.freshnessState,
            metadataCompletenessScore,
            warningCount: asset.warnings.length,
          }),
          marketPriceFreshness: calculateMarketPriceFreshness({
            priceDate: asset.valuation.priceDate,
            priceTimestamp: asset.valuation.priceTimestamp,
            sourceKind: asset.valuation.sourceKind,
            freshnessState: asset.valuation.freshnessState,
          }),
          metadataCompletenessScore,
          warningCount: asset.warnings.length,
        },
      },
    };
  });
  const averageMetadataCompletenessScore =
    assetRowsWithMetrics.length > 0
      ? assetRowsWithMetrics.reduce(
          (sum, asset) => sum + (asset.metrics?.quality?.metadataCompletenessScore ?? 0),
          0,
        ) / assetRowsWithMetrics.length
      : 0;
  const summaryActivityMetrics = {
    grossBuyVolume: buildExtendedKpiMoneyMetric({
      values: assetRowsWithMetrics.map((asset) =>
        asset.metrics?.activity?.grossBuyVolume?.amount != null
          ? {
              amount: asset.metrics.activity.grossBuyVolume.amount,
              currency: asset.metrics.activity.grossBuyVolume.currency,
            }
          : null,
      ),
      mixedCurrencyNote: "gross_buy_volume_unconverted_mixed_currencies",
      missingNote: "gross_buy_volume_missing",
    }),
    grossSellVolume: buildExtendedKpiMoneyMetric({
      values: assetRowsWithMetrics.map((asset) =>
        asset.metrics?.activity?.grossSellVolume?.amount != null
          ? {
              amount: asset.metrics.activity.grossSellVolume.amount,
              currency: asset.metrics.activity.grossSellVolume.currency,
            }
          : null,
      ),
      mixedCurrencyNote: "gross_sell_volume_unconverted_mixed_currencies",
      missingNote: "gross_sell_volume_missing",
    }),
    buyCount: assetRowsWithMetrics.reduce((sum, asset) => sum + (asset.metrics?.activity?.buyCount ?? 0), 0),
    sellCount: assetRowsWithMetrics.reduce((sum, asset) => sum + (asset.metrics?.activity?.sellCount ?? 0), 0),
  };
  const summaryDividendMetrics = {
    dividendCount: assetRowsWithMetrics.reduce(
      (sum, asset) => sum + (asset.metrics?.income?.dividendCount ?? 0),
      0,
    ),
    lastDividendDate:
      assetRowsWithMetrics
        .map((asset) => asset.metrics?.income?.lastDividendDate ?? null)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => left.localeCompare(right))
        .at(-1) ?? null,
  };
  const summaryAnnualizedDividendIncome = buildExtendedKpiMoneyMetric({
    values: assetRowsWithMetrics.map((asset) =>
      asset.metrics?.income?.annualizedDividendIncome?.amount != null
        ? {
            amount: asset.metrics.income.annualizedDividendIncome.amount,
            currency: asset.metrics.income.annualizedDividendIncome.currency,
          }
        : null,
    ),
    mixedCurrencyNote: "annualized_dividend_income_unconverted_mixed_currencies",
    missingNote: "annualized_dividend_income_missing",
  });
  const totalCostBasisMetric = buildExtendedKpiMoneyMetric({
    values: assetRowsWithMetrics.map((asset) =>
      asset.costBasis.amount != null
        ? {
            amount: asset.costBasis.amount,
            currency: asset.costBasis.currency,
          }
        : null,
    ),
    mixedCurrencyNote: "remaining_cost_basis_unconverted_mixed_currencies",
    missingNote: "remaining_cost_basis_missing",
  });
  const totalMarketValueMetric = buildExtendedKpiMoneyMetric({
    values: assetRowsWithMetrics.map((asset) =>
      asset.marketValue.amount != null
        ? {
            amount: asset.marketValue.amount,
            currency: asset.marketValue.currency,
          }
        : null,
    ),
    mixedCurrencyNote: "position_value_unconverted_mixed_currencies",
    missingNote: "position_value_missing",
  });
  const totalUnrealizedPnLMetric = buildExtendedKpiMoneyMetric({
    values: assetRowsWithMetrics.map((asset) =>
      asset.unrealizedPnL.amount != null
        ? {
            amount: asset.unrealizedPnL.amount,
            currency: asset.unrealizedPnL.currency,
          }
        : null,
    ),
    mixedCurrencyNote: "unrealized_pnl_unconverted_mixed_currencies",
    missingNote: "unrealized_pnl_missing",
  });
  const totalDividendNetMetric = buildExtendedKpiMoneyMetric({
    values: assetRowsWithMetrics.map((asset) =>
      asset.dividendsNet.amount != null
        ? {
            amount: asset.dividendsNet.amount,
            currency: asset.dividendsNet.currency,
          }
        : null,
    ),
    mixedCurrencyNote: "dividend_income_unconverted_mixed_currencies",
    missingNote: "dividend_income_missing",
  });
  const summaryDividendYieldOnCost = calculateDividendYieldOnCost({
    annualizedDividendIncome: summaryAnnualizedDividendIncome,
    remainingCostBasisAmount: totalCostBasisMetric.amount,
    remainingCostBasisCurrency: totalCostBasisMetric.currency,
  });
  const summaryCurrentDividendYield = calculateCurrentDividendYield({
    annualizedDividendIncome: summaryAnnualizedDividendIncome,
    positionValueAmount: totalMarketValueMetric.amount,
    positionValueCurrency: totalMarketValueMetric.currency,
  });
  const summaryIncomeReturn = calculateIncomeReturn({
    totalDividendNetAmount: totalDividendNetMetric.amount,
    totalDividendNetCurrency: totalDividendNetMetric.currency,
    remainingCostBasisAmount: totalCostBasisMetric.amount,
    remainingCostBasisCurrency: totalCostBasisMetric.currency,
  });
  const summaryPriceReturnExcludingDividends = calculatePriceReturnExcludingDividends({
    unrealizedPnLAmount: totalUnrealizedPnLMetric.amount,
    unrealizedPnLCurrency: totalUnrealizedPnLMetric.currency,
    remainingCostBasisAmount: totalCostBasisMetric.amount,
    remainingCostBasisCurrency: totalCostBasisMetric.currency,
  });
  const summaryTotalReturnIncludingDividends = calculateTotalReturnIncludingDividends({
    unrealizedPnLAmount: totalUnrealizedPnLMetric.amount,
    unrealizedPnLCurrency: totalUnrealizedPnLMetric.currency,
    totalDividendNetAmount: totalDividendNetMetric.amount,
    totalDividendNetCurrency: totalDividendNetMetric.currency,
    remainingCostBasisAmount: totalCostBasisMetric.amount,
    remainingCostBasisCurrency: totalCostBasisMetric.currency,
  });
  const marketDataAssetCount = assetRowsWithMetrics.filter(
    (asset) => asset.valuation.sourceKind === "market_data_db" && asset.valuation.freshnessState === "fresh",
  ).length;
  const staleAssetCount = assetRowsWithMetrics.filter(
    (asset) => asset.valuation.sourceKind === "market_data_db" && asset.valuation.freshnessState === "stale",
  ).length;
  const fallbackAssetCount = assetRowsWithMetrics.filter(
    (asset) => asset.valuation.sourceKind === "latest_trade_price_fallback",
  ).length;
  const missingPriceAssetCount = assetRowsWithMetrics.filter(
    (asset) => asset.valuation.sourceKind === "missing",
  ).length;
  const warningCount = calculateSnapshotScopeWarningCount({
    modelWarnings: productReadModel.metadata.warnings,
    assetWarnings: assetRowsWithMetrics.map((asset) => asset.warnings),
  });

  return {
    ...productReadModel,
    assets: assetRowsWithMetrics,
    summary: {
      ...productReadModel.summary,
      metrics: {
        activity: {
          grossBuyVolume: summaryActivityMetrics.grossBuyVolume,
          grossSellVolume: summaryActivityMetrics.grossSellVolume,
          buyCount: summaryActivityMetrics.buyCount,
          sellCount: summaryActivityMetrics.sellCount,
          dividendCount: summaryDividendMetrics.dividendCount,
          lastDividendDate: summaryDividendMetrics.lastDividendDate,
        },
        income: {
          annualizedDividendIncome: summaryAnnualizedDividendIncome,
          dividendYieldOnCost: summaryDividendYieldOnCost,
          currentDividendYield: summaryCurrentDividendYield,
        },
        returns: {
          incomeReturn: summaryIncomeReturn,
          priceReturnExcludingDividends: summaryPriceReturnExcludingDividends,
          totalReturnIncludingDividends: summaryTotalReturnIncludingDividends,
        },
        structure: {
          top5Concentration: portfolioStructure.top5Concentration,
          top10Concentration: portfolioStructure.top10Concentration,
          herfindahlIndex: portfolioStructure.herfindahlIndex,
          allocationByAssetType: portfolioStructure.allocationByAssetType,
        },
        quality: {
          dataConfidenceScore: calculatePortfolioDataConfidenceScore({
            assetCount: assetRowsWithMetrics.length,
            marketDataAssetCount,
            staleAssetCount,
            fallbackAssetCount,
            missingPriceAssetCount,
            averageMetadataCompletenessScore,
            warningCount,
          }),
          warningCount,
        },
      },
    },
  };
}

function buildAssetRowFromGlobalAsset(input: {
  asset: GlobalAsset;
  sourceType: ProductReadModelSourceType;
  sourceScope: ProductReadModelSourceScope;
  freshnessState: ProductReadModelFreshnessState;
  scopeState: ProductReadModelScopeState;
}): ProductReadModelAssetRow {
  const warnings = input.asset.warnings.map(mapWarning);
  const implicitBlockedMetrics: BlockedMetric[] = [];

  if (!input.asset.totals.marketValue) {
    implicitBlockedMetrics.push("market_value");
  }

  if (!input.asset.totals.costBasis) {
    implicitBlockedMetrics.push("cost_basis");
  }

  if (!input.asset.totals.unrealizedPnL) {
    implicitBlockedMetrics.push("unrealized_pnl");
  }

  const blockedMetrics = Array.from(
    new Set([...uniqueBlockedMetrics(warnings), ...implicitBlockedMetrics]),
  );
  const confidence = deriveItemConfidence(input.asset.confidence.level, warnings);
  const valueClassification = deriveAssetValueClassification(
    warnings,
    blockedMetrics,
    confidence,
  );
  const quantity = input.asset.totals.quantity ?? null;

  const metricBlockedMetrics: Record<"marketValue" | "costBasis" | "unrealizedPnL", BlockedMetric[]> = {
    marketValue: blockedMetrics.filter((metric) => metric === "market_value"),
    costBasis: blockedMetrics.filter((metric) => metric === "cost_basis"),
    unrealizedPnL: blockedMetrics.filter((metric) => metric === "unrealized_pnl"),
  };
  const row: ProductReadModelAssetRow = {
    identity: {
      assetKey: input.asset.assetKey,
      stableKey: toStableAssetKey(input.asset.assetKey),
      compatibilityIsin: toCompatibilityIsin(input.asset.assetKey),
    },
    display: {
      displayName: input.asset.display.name ?? input.asset.assetKey?.value ?? "Unknown asset",
      subtitle: input.asset.display.subtitle ?? null,
      symbol: input.asset.display.symbol ?? null,
      wkn: input.asset.assetKey?.type === "wkn" ? input.asset.assetKey.value : null,
    },
    classification: {
      assetType: null,
      currency:
        input.asset.totals.marketValue?.currency ??
        input.asset.valuation?.marketPrice?.currency ??
        input.asset.valuation?.latestTradePrice?.currency ??
        null,
      symbol: input.asset.display.symbol ?? null,
      primarySymbol: null,
      wkn: input.asset.assetKey?.type === "wkn" ? input.asset.assetKey.value : null,
    },
    status: deriveAssetStatus(input.asset.status),
    quantity,
    quantityValueClassification:
      quantity === null ? "preliminary" : blockedMetrics.includes("position") ? "blocked" : "app_calculated",
    valuation: mapValuationSnapshot(input.asset.valuation),
    marketValue: mapMoneyMetric(input.asset.totals.marketValue, metricBlockedMetrics.marketValue),
    costBasis: mapMoneyMetric(input.asset.totals.costBasis, metricBlockedMetrics.costBasis),
    unrealizedPnL: mapMoneyMetric(
      input.asset.totals.unrealizedPnL,
      metricBlockedMetrics.unrealizedPnL,
    ),
    dividendsNet: mapMoneyMetric(
      input.asset.totals.dividendsNet,
      blockedMetrics.filter((metric) => metric === "dividends"),
    ),
    fees: mapMoneyMetric(
      input.asset.totals.fees,
      blockedMetrics.filter((metric) => metric === "fees"),
    ),
    taxes: mapMoneyMetric(
      input.asset.totals.taxes,
      blockedMetrics.filter((metric) => metric === "taxes"),
    ),
    warnings,
    blockedMetrics,
    confidence,
    valueClassification,
    sourceType: input.sourceType,
    sourceScope: input.sourceScope,
    freshnessState: input.freshnessState,
    scopeState: input.scopeState,
    portfolioBreakdown: input.asset.portfolioBreakdowns.map((breakdown) => {
      const breakdownWarnings = breakdown.warnings.map(mapWarning);
      const implicitBreakdownBlockedMetrics: BlockedMetric[] = [];

      if (!breakdown.marketValue) {
        implicitBreakdownBlockedMetrics.push("market_value");
      }

      if (!breakdown.costBasis) {
        implicitBreakdownBlockedMetrics.push("cost_basis");
      }

      if (!breakdown.pnl) {
        implicitBreakdownBlockedMetrics.push("unrealized_pnl");
      }

      const breakdownBlockedMetrics = Array.from(
        new Set([...uniqueBlockedMetrics(breakdownWarnings), ...implicitBreakdownBlockedMetrics]),
      );
      const breakdownConfidence = deriveItemConfidence(input.asset.confidence.level, breakdownWarnings);
      const breakdownMarketValue = mapMoneyMetric(
        breakdown.marketValue,
        breakdownBlockedMetrics.filter((metric) => metric === "market_value"),
      );
      const breakdownCostBasis = mapMoneyMetric(
        breakdown.costBasis,
        breakdownBlockedMetrics.filter((metric) => metric === "cost_basis"),
      );
      const breakdownUnrealizedPnL = mapMoneyMetric(
        breakdown.pnl,
        breakdownBlockedMetrics.filter((metric) => metric === "unrealized_pnl"),
      );

      return {
        portfolioId: breakdown.portfolioId,
        portfolioName: breakdown.portfolioName ?? null,
        status: breakdown.status,
        quantity: breakdown.quantity ?? null,
        valuation: mapValuationSnapshot(breakdown.valuation),
        marketValue: breakdownMarketValue,
        costBasis: breakdownCostBasis,
        unrealizedPnL: breakdownUnrealizedPnL,
        dividendsNet: mapMoneyMetric(
          breakdown.dividendsNet,
          breakdownBlockedMetrics.filter((metric) => metric === "dividends"),
        ),
        fees: mapMoneyMetric(
          breakdown.fees,
          breakdownBlockedMetrics.filter((metric) => metric === "fees"),
        ),
        taxes: mapMoneyMetric(
          breakdown.taxes,
          breakdownBlockedMetrics.filter((metric) => metric === "taxes"),
        ),
        warnings: breakdownWarnings,
        blockedMetrics: breakdownBlockedMetrics,
        confidence: breakdownConfidence,
      };
    }),
    latestActivityAt: findLatestActivityAt(input.asset),
  };

  row.metrics = buildAssetMetrics({
    asset: input.asset,
    row,
    portfolioValue: null,
  });

  return row;
}

export function projectGlobalAssetsProductReadModel(
  input: CreateProductReadModelAssetsInput,
): ProductReadModelAssets {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const readModelWarnings = input.aggregation.warnings.map(mapWarning);
  const readModelBlockedMetrics = uniqueBlockedMetrics(readModelWarnings);
  const readModelConfidence: ProductReadModelConfidence = hasBlockerWarning(readModelWarnings)
    ? "low"
    : readModelWarnings.length > 0
      ? "medium"
      : "high";
  const sourceType = input.sourceType ?? "app_calculated";
  const sourceScope = input.sourceScope ?? "selected_portfolios";
  const freshnessState = input.freshnessState ?? "unknown";
  const scopeState = input.scopeState ?? "scope_unknown";
  const projectedAssets = input.aggregation.assets
    .map((asset) =>
      buildAssetRowFromGlobalAsset({
        asset,
        sourceType,
        sourceScope,
        freshnessState,
        scopeState,
      }),
    )
    .sort((left, right) => {
      const quantityDelta = (right.quantity ?? 0) - (left.quantity ?? 0);

      if (quantityDelta !== 0) {
        return quantityDelta;
      }

      return left.display.displayName.localeCompare(right.display.displayName, "de-DE");
    });
  const baseModel: ProductReadModelAssets = {
    metadata: {
      readModelId: input.readModelId ?? `product-read-model:global-assets:${generatedAt}`,
      snapshotId: input.snapshotId ?? null,
      generatedAt,
      sourceType,
      sourceScope,
      freshnessAt: input.freshnessAt ?? null,
      freshnessState,
      scopeState,
      selectedPortfolioIds: normalizePortfolioIds(input.selectedPortfolioIds),
      confidence: readModelConfidence,
      warnings: readModelWarnings,
      blockedMetrics: [],
      valueClassification: "none",
      providerRequestCount: input.providerRequestCount ?? null,
    },
    assets: projectedAssets,
    summary: {
      assetCount: projectedAssets.length,
      activeAssetCount: projectedAssets.filter((asset) => asset.status === "active").length,
      closedAssetCount: projectedAssets.filter((asset) => asset.status === "closed").length,
      unknownAssetCount: projectedAssets.filter((asset) => asset.status === "unknown").length,
      warningAssetCount: projectedAssets.filter((asset) => asset.warnings.length > 0).length,
      blockerWarningCount: projectedAssets.reduce(
        (count, asset) =>
          count + asset.warnings.filter((warning) => warning.severity === "Blocker").length,
        0,
      ),
      blockedMetricAssetCount: projectedAssets.filter((asset) => asset.blockedMetrics.length > 0).length,
      blockedMetricCount: projectedAssets.reduce((count, asset) => count + asset.blockedMetrics.length, 0),
      valueClassificationCounts: {
        provider_reference: 0,
        app_calculated: 0,
        estimated: 0,
        preliminary: 0,
        blocked: 0,
        none: 0,
      },
    },
  };
  const enrichedModel = enrichGlobalAssetsProductReadModelMetrics(baseModel);
  const snapshotDividendActivities = input.aggregation.assets.flatMap((asset) =>
    asset.timeline.map((entry) => ({
      activityType: entry.activity.activityType,
      amount: entry.activity.amounts.amount ?? null,
      amountNet: entry.activity.amounts.amountNet ?? null,
      date: entry.activity.date,
      datetime: entry.activity.datetime,
    })),
  );
  const summaryDividendGrowth1y = calculateDividendGrowth1y({
    activities: snapshotDividendActivities,
  });
  const summaryDividendGrowth3y = calculateDividendGrowth3y({
    activities: snapshotDividendActivities,
  });
  enrichedModel.summary.metrics = {
    ...(enrichedModel.summary.metrics ?? {}),
    income: {
      ...(enrichedModel.summary.metrics?.income ?? {}),
      dividendGrowth1y: summaryDividendGrowth1y,
      dividendGrowth3y: summaryDividendGrowth3y,
    },
  };
  const assets = enrichedModel.assets;
  let valuationAnomalies = 0;

  for (const asset of assets) {
    const assetInvariant = logValuationInvariant("product_read_model:asset", {
      isin: asset.identity.compatibilityIsin ?? asset.identity.stableKey,
      assetLabel: asset.display.displayName,
      quantity: asset.quantity,
      marketPrice: asset.valuation.marketPrice.amount,
      marketValue: asset.marketValue.amount,
      remainingCostBasis: asset.costBasis.amount,
      unrealizedPnL: asset.unrealizedPnL.amount,
      valuationSourceKind: asset.valuation.sourceKind,
      priceDate: asset.valuation.priceDate,
      priceSource: asset.valuation.priceSource,
    });

    if (assetInvariant.checked && !assetInvariant.isConsistent) {
      valuationAnomalies += 1;
    }

    for (const breakdown of asset.portfolioBreakdown) {
      const breakdownInvariant = logValuationInvariant("product_read_model:portfolio_breakdown", {
        isin: asset.identity.compatibilityIsin ?? asset.identity.stableKey,
        assetLabel: asset.display.displayName,
        portfolioId: breakdown.portfolioId,
        portfolioName: breakdown.portfolioName,
        quantity: breakdown.quantity,
        marketPrice: breakdown.valuation.marketPrice.amount,
        marketValue: breakdown.marketValue.amount,
        remainingCostBasis: breakdown.costBasis.amount,
        unrealizedPnL: breakdown.unrealizedPnL.amount,
        valuationSourceKind: breakdown.valuation.sourceKind,
        priceDate: breakdown.valuation.priceDate,
        priceSource: breakdown.valuation.priceSource,
      });

      if (breakdownInvariant.checked && !breakdownInvariant.isConsistent) {
        valuationAnomalies += 1;
      }
    }
  }
  const blockedMetricsFromAssets = Array.from(
    new Set(assets.flatMap((asset) => asset.blockedMetrics)),
  );
  const effectiveReadModelBlockedMetrics = Array.from(
    new Set([...readModelBlockedMetrics, ...blockedMetricsFromAssets]),
  );
  const effectiveReadModelValueClassification = deriveAssetValueClassification(
    readModelWarnings,
    effectiveReadModelBlockedMetrics,
    readModelConfidence,
  );
  const valueClassificationCounts = assets.reduce<Record<ProductReadModelValueClassification, number>>(
    (counts, asset) => ({
      ...counts,
      [asset.valueClassification]: counts[asset.valueClassification] + 1,
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

  summarizeDiagnostics("product_read_model", {
    assetCount: assets.length,
    valuationAnomalies,
    warningAssetCount: assets.filter((asset) => asset.warnings.length > 0).length,
    fallbackPriceUsedCount: assets.filter(
      (asset) => asset.valuation.sourceKind === "latest_trade_price_fallback",
    ).length,
    missingMarketPriceCount: assets.filter(
      (asset) => asset.valuation.sourceKind === "missing",
    ).length,
  }, "valuation");

  return {
    ...enrichedModel,
    metadata: {
      ...enrichedModel.metadata,
      blockedMetrics: effectiveReadModelBlockedMetrics,
      valueClassification: effectiveReadModelValueClassification,
    },
    summary: {
      ...enrichedModel.summary,
      valueClassificationCounts,
    },
  };
}

export function buildGlobalAssetsProductReadModelComparisonEvidence(input: {
  runtimeFallbackAssets: ProductReadModelRuntimeFallbackAssetInput[];
  projected: ProductReadModelAssets;
}): ProductReadModelAssetsComparisonEvidence {
  const currentSurface = {
    assetCount: input.runtimeFallbackAssets.length,
    assetWithPositionValueCount: input.runtimeFallbackAssets.filter(
      (asset) => asset.positionValue != null,
    ).length,
    assetWithUnrealizedPnLCount: input.runtimeFallbackAssets.filter(
      (asset) => asset.unrealizedPnL != null,
    ).length,
    assetWithDividendCount: input.runtimeFallbackAssets.filter(
      (asset) => asset.totalDividendNet != null,
    ).length,
    assetWithQuantityCount: input.runtimeFallbackAssets.filter((asset) => asset.netShares != null).length,
  };
  const projectedByStatus: Record<ProductReadModelAssetStatus, number> = {
    active: 0,
    closed: 0,
    unknown: 0,
  };

  for (const asset of input.projected.assets) {
    projectedByStatus[asset.status] += 1;
  }

  const projected = {
    assetCount: input.projected.summary.assetCount,
    blockedMetricAssetCount: input.projected.summary.blockedMetricAssetCount,
    blockedMetricCount: input.projected.summary.blockedMetricCount,
    warningAssetCount: input.projected.summary.warningAssetCount,
    blockerWarningCount: input.projected.summary.blockerWarningCount,
    withQuantityCount: input.projected.assets.filter((asset) => asset.quantity != null).length,
    withMarketValueCount: input.projected.assets.filter((asset) => asset.marketValue.amount != null).length,
    withCostBasisCount: input.projected.assets.filter((asset) => asset.costBasis.amount != null).length,
    withUnrealizedPnLCount: input.projected.assets.filter(
      (asset) => asset.unrealizedPnL.amount != null,
    ).length,
    withDividendsCount: input.projected.assets.filter((asset) => asset.dividendsNet.amount != null).length,
    withFeesCount: input.projected.assets.filter((asset) => asset.fees.amount != null).length,
    withTaxesCount: input.projected.assets.filter((asset) => asset.taxes.amount != null).length,
    byStatus: projectedByStatus,
  };

  return {
    compatibility: currentSurface,
    projected,
    delta: {
      assetCount: projected.assetCount - currentSurface.assetCount,
      blockedMetricAssetCount: projected.blockedMetricAssetCount,
      warningAssetCount: projected.warningAssetCount,
      blockerWarningCount: projected.blockerWarningCount,
      quantityCoverage: projected.withQuantityCount - currentSurface.assetWithQuantityCount,
      marketValueCoverage: projected.withMarketValueCount - currentSurface.assetWithPositionValueCount,
      costBasisCoverage: projected.withCostBasisCount - currentSurface.assetCount,
      unrealizedPnLCoverage:
        projected.withUnrealizedPnLCount - currentSurface.assetWithUnrealizedPnLCount,
      dividendsCoverage: projected.withDividendsCount - currentSurface.assetWithDividendCount,
    },
  };
}

function mapValuationSnapshot(
  valuation: GlobalAsset["valuation"] | GlobalAsset["portfolioBreakdowns"][number]["valuation"],
): ProductReadModelAssetValuation {
  return {
    marketPrice: mapMoneyMetric(valuation?.marketPrice, []),
    nativeMarketPrice: mapMoneyMetric(valuation?.nativeMarketPrice ?? valuation?.marketPrice, []),
    reportingMarketPrice: mapMoneyMetric(valuation?.reportingMarketPrice ?? valuation?.marketPrice, []),
    latestTradePrice: mapMoneyMetric(valuation?.latestTradePrice, []),
    reportingCurrency:
      valuation?.reportingCurrency ??
      valuation?.reportingMarketPrice?.currency ??
      valuation?.marketPrice?.currency ??
      null,
    fxRate: valuation?.fxRate ?? null,
    fxStatus: valuation?.fxStatus ?? "not_requested",
    priceDate: valuation?.priceDate ?? null,
    priceTimestamp: valuation?.priceTimestamp ?? null,
    priceSource: valuation?.priceSource ?? null,
    sourceKind: valuation?.sourceKind ?? "missing",
    freshnessState: valuation?.freshnessState ?? "missing",
  };
}
