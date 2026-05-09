import {
  ActivitiesNormalizationResult,
  AssetConfidence,
  BlockedMetric,
  GlobalAsset,
  GlobalAssetAggregationResult,
  GlobalAssetKey,
  GlobalAssetStatus,
  GlobalAssetTimelineEntry,
  MoneyValue,
  NormalizedActivity,
  PortfolioBreakdown,
  PortfolioBreakdownStatus,
  ReconciliationWarning,
  ReconciliationWarningCode,
  ReconciliationWarningSeverity,
  TimelineDisplayType,
} from "./types";

const QUANTITY_EPSILON = 0.000001;

function assetKeyToGroupKey(assetKey: GlobalAssetKey): string {
  return `${assetKey.type}:${assetKey.value}`;
}

function isMoneyValue(value: MoneyValue | null | undefined): value is MoneyValue {
  return Boolean(value);
}

function normalizeQuantityForStatus(quantity: number): number {
  return Math.abs(quantity) < QUANTITY_EPSILON ? 0 : quantity;
}

function isPositiveQuantity(quantity: number): boolean {
  return normalizeQuantityForStatus(quantity) > 0;
}

function isNegativeQuantity(quantity: number): boolean {
  return normalizeQuantityForStatus(quantity) < 0;
}

function createAggregationWarning(input: {
  code: ReconciliationWarningCode;
  severity: ReconciliationWarningSeverity;
  message: string;
  debugMessage?: string;
  assetKey?: GlobalAssetKey | null;
  activityId?: string | null;
  portfolioId?: string | null;
  holdingId?: string | null;
  blockedMetrics?: BlockedMetric[];
}): ReconciliationWarning {
  return {
    code: input.code,
    severity: input.severity,
    message: input.message,
    debugMessage: input.debugMessage,
    source: "aggregation",
    entityRefs: {
      assetKey: input.assetKey,
      activityId: input.activityId,
      portfolioId: input.portfolioId,
      holdingId: input.holdingId,
    },
    blockedMetrics: input.blockedMetrics,
  };
}

function quantityEffect(activity: NormalizedActivity): number {
  const quantity = activity.quantity ?? 0;

  switch (activity.activityType) {
    case "buy":
    case "deposit":
    case "transfer_in":
      return quantity;
    case "sell":
    case "withdrawal":
    case "transfer_out":
      return -quantity;
    case "dividend":
    case "fees_taxes":
    case "unknown":
      return 0;
  }
}

function toDisplayType(activity: NormalizedActivity): TimelineDisplayType {
  switch (activity.activityType) {
    case "deposit":
      return "external_inflow";
    case "withdrawal":
      return "external_outflow";
    case "transfer_in":
    case "transfer_out":
      return "possible_transfer";
    case "unknown":
      return "unknown_event";
    default:
      return activity.activityType;
  }
}

function sortTimelineEntries(entries: GlobalAssetTimelineEntry[]): GlobalAssetTimelineEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const sortCompare = left.entry.sortKey.localeCompare(right.entry.sortKey);
      return sortCompare !== 0 ? sortCompare : left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function collectCurrencies(values: Array<MoneyValue | null | undefined>): string[] {
  return Array.from(new Set(values.filter(isMoneyValue).map((value) => value.currency)));
}

function sumMoneyValues(
  values: Array<MoneyValue | null | undefined>,
  context: { assetKey: GlobalAssetKey; metric: BlockedMetric; label: string },
  warnings: ReconciliationWarning[]
): MoneyValue | null {
  const presentValues = values.filter(isMoneyValue);

  if (presentValues.length === 0) {
    return null;
  }

  const currencies = collectCurrencies(presentValues);

  if (currencies.length !== 1) {
    warnings.push(
      createAggregationWarning({
        code: "TOTALS_BLOCKED_BY_MIXED_CURRENCIES",
        severity: "Warning",
        message: `${context.label} total could not be calculated because multiple currencies are present.`,
        debugMessage: "P1-5 does not perform FX conversion.",
        assetKey: context.assetKey,
        blockedMetrics: [context.metric],
      })
    );
    return null;
  }

  return {
    amount: presentValues.reduce((sum, value) => sum + value.amount, 0),
    currency: currencies[0],
  };
}

function buildPortfolioBreakdowns(
  assetKey: GlobalAssetKey,
  activities: NormalizedActivity[],
  warnings: ReconciliationWarning[]
): PortfolioBreakdown[] {
  const groups = new Map<string, NormalizedActivity[]>();

  for (const activity of activities) {
    const portfolioId = activity.portfolioContext.portfolioId;
    const current = groups.get(portfolioId) ?? [];
    current.push(activity);
    groups.set(portfolioId, current);
  }

  if (groups.size === 0) {
    warnings.push(
      createAggregationWarning({
        code: "MISSING_PORTFOLIO_BREAKDOWN",
        severity: "Warning",
        message: "No portfolio breakdown could be created for asset.",
        debugMessage: "At least one portfolio context is required for breakdowns.",
        assetKey,
        blockedMetrics: ["portfolio_breakdown"],
      })
    );
  }

  return Array.from(groups.entries()).map(([portfolioId, portfolioActivities]) => {
    const rawQuantity = portfolioActivities.reduce((sum, activity) => sum + quantityEffect(activity), 0);
    const quantity = normalizeQuantityForStatus(rawQuantity);
    const status: PortfolioBreakdownStatus = isPositiveQuantity(quantity)
      ? "active"
      : quantity === 0
        ? "historical_only"
        : "unknown";
    const breakdownWarnings: ReconciliationWarning[] = [];

    if (isNegativeQuantity(quantity)) {
      const warning = createAggregationWarning({
        code: "NEGATIVE_POSITION_QUANTITY",
        severity: "Warning",
        message: "Portfolio position quantity is negative.",
        debugMessage: "Preliminary quantity calculation resulted in a negative portfolio quantity after applying tolerance.",
        assetKey,
        portfolioId,
        blockedMetrics: ["position", "portfolio_breakdown"],
      });
      breakdownWarnings.push(warning);
      warnings.push(warning);
    }

    return {
      portfolioId,
      portfolioName: portfolioActivities[0]?.portfolioContext.portfolioName ?? null,
      quantity,
      marketValue: null,
      costBasis: null,
      pnl: null,
      avgBuyPrice: null,
      shareOfGlobalPosition: null,
      status,
      warnings: breakdownWarnings,
    };
  });
}

function deriveAssetConfidence(warnings: ReconciliationWarning[]): AssetConfidence {
  if (warnings.some((warning) => warning.severity === "Blocker")) {
    return {
      level: "low",
      reasons: ["At least one blocker warning is present."],
      warningCodes: Array.from(new Set(warnings.map((warning) => String(warning.code)))),
    };
  }

  if (warnings.length > 0) {
    return {
      level: "medium",
      reasons: ["Warnings are present for this asset."],
      warningCodes: Array.from(new Set(warnings.map((warning) => String(warning.code)))),
    };
  }

  return {
    level: "high",
    reasons: ["No aggregation warnings are present."],
    warningCodes: [],
  };
}

function buildAsset(assetKey: GlobalAssetKey, activities: NormalizedActivity[]): GlobalAsset {
  const warnings: ReconciliationWarning[] = [];

  if (activities.length === 0) {
    warnings.push(
      createAggregationWarning({
        code: "EMPTY_ASSET_GROUP",
        severity: "Warning",
        message: "Asset group has no activities.",
        debugMessage: "An empty group should not normally occur during aggregation.",
        assetKey,
      })
    );
  }

  const timeline = sortTimelineEntries(
    activities.map((activity) => ({
      activity,
      portfolioContext: activity.portfolioContext,
      warnings: [],
      transferGroupId: null,
      displayType: toDisplayType(activity),
      sortKey: activity.sortKey,
    }))
  );

  const portfolioBreakdowns = buildPortfolioBreakdowns(assetKey, activities, warnings);
  const rawTotalQuantity = portfolioBreakdowns.reduce((sum, breakdown) => sum + (breakdown.quantity ?? 0), 0);
  const totalQuantity = normalizeQuantityForStatus(rawTotalQuantity);

  if (isNegativeQuantity(totalQuantity)) {
    warnings.push(
      createAggregationWarning({
        code: "NEGATIVE_POSITION_QUANTITY",
        severity: "Warning",
        message: "Global asset quantity is negative.",
        debugMessage: "Preliminary quantity calculation resulted in a negative global quantity after applying tolerance.",
        assetKey,
        blockedMetrics: ["position"],
      })
    );
  }

  const currencies = collectCurrencies(
    activities.map((activity) => (activity.activityCurrency ? { amount: 0, currency: activity.activityCurrency } : null))
  );
  const hasMixedCurrencies = currencies.length > 1;

  if (hasMixedCurrencies) {
    warnings.push(
      createAggregationWarning({
        code: "MIXED_CURRENCIES",
        severity: "Warning",
        message: "Asset contains activities with multiple currencies.",
        debugMessage: "P1-5 does not perform FX conversion, so affected totals are blocked.",
        assetKey,
        blockedMetrics: ["dividends", "fees", "taxes"],
      })
    );
  }

  const dividendsNet = hasMixedCurrencies
    ? null
    : sumMoneyValues(
        activities
          .filter((activity) => activity.activityType === "dividend")
          .map((activity) => activity.amounts.amountNet),
        { assetKey, metric: "dividends", label: "Dividend net" },
        warnings
      );
  const fees = hasMixedCurrencies
    ? null
    : sumMoneyValues(
        activities.map((activity) => activity.amounts.fee),
        { assetKey, metric: "fees", label: "Fees" },
        warnings
      );
  const taxes = hasMixedCurrencies
    ? null
    : sumMoneyValues(
        activities.map((activity) => activity.amounts.tax),
        { assetKey, metric: "taxes", label: "Taxes" },
        warnings
      );

  if (hasMixedCurrencies) {
    warnings.push(
      createAggregationWarning({
        code: "TOTALS_BLOCKED_BY_MIXED_CURRENCIES",
        severity: "Warning",
        message: "Some totals were blocked because mixed currencies are present.",
        debugMessage: "Dividend, fee and tax totals require consistent currencies in P1-5.",
        assetKey,
        blockedMetrics: ["dividends", "fees", "taxes"],
      })
    );
  }

  const status: GlobalAssetStatus = isNegativeQuantity(totalQuantity)
    ? "unknown"
    : portfolioBreakdowns.some((breakdown) => breakdown.status === "active")
      ? "active"
      : totalQuantity === 0 && activities.length > 0
        ? "closed"
        : "unknown";

  return {
    assetKey,
    display: {
      name: assetKey.value,
      subtitle: assetKey.type.toUpperCase(),
      symbol: null,
      logoUrl: null,
      metadataSource: null,
    },
    timeline,
    portfolioBreakdowns,
    warnings,
    confidence: deriveAssetConfidence(warnings),
    status,
    totals: {
      quantity: totalQuantity,
      marketValue: null,
      costBasis: null,
      unrealizedPnL: null,
      dividendsNet,
      fees,
      taxes,
    },
  };
}

export function buildGlobalAssets(activities: NormalizedActivity[]): GlobalAssetAggregationResult {
  const groups = new Map<string, { assetKey: GlobalAssetKey; activities: NormalizedActivity[] }>();
  const unassignedActivities: NormalizedActivity[] = [];
  const warnings: ReconciliationWarning[] = [];

  for (const activity of activities) {
    const assetKey = activity.assetIdentity.assetKey;

    if (!assetKey) {
      unassignedActivities.push(activity);
      warnings.push(
        createAggregationWarning({
          code: "UNASSIGNED_ACTIVITY",
          severity: "Blocker",
          message: "Activity could not be assigned to a Global Asset.",
          debugMessage: "Missing assetKey prevents aggregation for this activity.",
          activityId: activity.ids.internalActivityId,
          portfolioId: activity.portfolioContext.portfolioId,
          holdingId: activity.assetIdentity.holdingId,
          blockedMetrics: ["position", "portfolio_breakdown", "cost_basis"],
        })
      );
      continue;
    }

    const groupKey = assetKeyToGroupKey(assetKey);
    const group = groups.get(groupKey) ?? { assetKey, activities: [] };
    group.activities.push(activity);
    groups.set(groupKey, group);
  }

  const assets = Array.from(groups.values()).map((group) => buildAsset(group.assetKey, group.activities));
  const assetWarnings = assets.flatMap((asset) => asset.warnings);
  const allWarnings = [...warnings, ...assetWarnings];

  return {
    assets,
    unassignedActivities,
    warnings: allWarnings,
    summary: {
      inputActivityCount: activities.length,
      assetCount: assets.length,
      unassignedActivityCount: unassignedActivities.length,
      warningCount: allWarnings.length,
      blockerCount: allWarnings.filter((warning) => warning.severity === "Blocker").length,
      activeAssetCount: assets.filter((asset) => asset.status === "active").length,
      closedAssetCount: assets.filter((asset) => asset.status === "closed").length,
      unknownAssetCount: assets.filter((asset) => asset.status === "unknown").length,
      mixedCurrencyAssetCount: assets.filter((asset) =>
        asset.warnings.some((warning) => warning.code === "MIXED_CURRENCIES")
      ).length,
      negativeQuantityAssetCount: assets.filter((asset) =>
        asset.warnings.some((warning) => warning.code === "NEGATIVE_POSITION_QUANTITY")
      ).length,
    },
  };
}

export function buildGlobalAssetsFromNormalizationResult(
  result: ActivitiesNormalizationResult
): GlobalAssetAggregationResult {
  const aggregation = buildGlobalAssets(result.activities);

  return {
    ...aggregation,
    warnings: [...result.warnings, ...aggregation.warnings],
    summary: {
      ...aggregation.summary,
      warningCount: result.warnings.length + aggregation.summary.warningCount,
      blockerCount:
        result.warnings.filter((warning) => warning.severity === "Blocker").length +
        aggregation.summary.blockerCount,
    },
  };
}
