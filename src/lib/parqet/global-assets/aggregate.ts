import { applyGlobalAssetPositionOverrides } from "./overrides";
import {
  applyBuyPositionDelta,
  applySellLikePositionDelta,
  applyTransferInPositionDelta,
  calculatePositionMetrics,
  normalizePositionRounding,
  sumDividendNet,
  updateLatestTradePrice,
} from "../../calculations/global-asset-metrics";
import {
  ActivitiesNormalizationResult,
  AssetConfidence,
  BlockedMetric,
  GlobalAsset,
  GlobalAssetAggregationResult,
  GlobalAssetKey,
  GlobalAssetValuationFreshnessState,
  GlobalAssetValuationSnapshot,
  GlobalAssetOverrideDecisionType,
  GlobalAssetStatus,
  GlobalAssetTimelineEntry,
  FxRateSnapshot,
  MoneyValue,
  NegativeQuantityCause,
  NegativeQuantityCauseType,
  NormalizedActivity,
  PortfolioBreakdown,
  PortfolioBreakdownStatus,
  ReconciliationWarning,
  ReconciliationWarningCode,
  ReconciliationWarningSeverity,
  TimelineDisplayType,
  UnresolvedDecisionCandidate,
  WarningMetadata,
} from "./types";
import {
  logValuationInvariant,
  summarizeDiagnostics,
} from "../../debug/dev-diagnostics";

export type GlobalAssetMarketPriceOverlay = {
  priceAmount: number;
  currency: string | null;
  reportingCurrency?: string | null;
  fxRate?: FxRateSnapshot | null;
  priceDate: string | null;
  priceTimestamp: string | null;
  priceSource: string | null;
};

export type GlobalAssetMarketPriceOverlaysByIsin = Record<string, GlobalAssetMarketPriceOverlay>;

type GlobalAssetAggregationOptions = {
  marketPriceOverlaysByIsin?: GlobalAssetMarketPriceOverlaysByIsin;
  reportingCurrency?: string | null;
};

const QUANTITY_EPSILON = 0.000001;
const RATIO_TOLERANCE = 0.0001;
const COMMON_MISMATCH_FACTORS = [10, 100, 1000];

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

function quantitiesMatch(left: number, right: number): boolean {
  return Math.abs(left - right) < QUANTITY_EPSILON;
}

function isPositionEffectIgnored(activity: NormalizedActivity): boolean {
  return activity.positionOverride?.affectsPosition === false;
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
  metadata?: WarningMetadata;
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
    metadata: input.metadata,
  };
}

function quantityEffect(activity: NormalizedActivity): number {
  if (isPositionEffectIgnored(activity)) {
    return 0;
  }

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

function inboundQuantityEffect(activity: NormalizedActivity): number {
  if (isPositionEffectIgnored(activity)) {
    return 0;
  }

  switch (activity.activityType) {
    case "buy":
    case "deposit":
    case "transfer_in":
      return activity.quantity ?? 0;
    default:
      return 0;
  }
}

function outboundQuantityEffect(activity: NormalizedActivity): number {
  if (isPositionEffectIgnored(activity)) {
    return 0;
  }

  switch (activity.activityType) {
    case "sell":
    case "withdrawal":
    case "transfer_out":
      return activity.quantity ?? 0;
    default:
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

function sumMoneyValuesWithoutWarning(
  values: Array<MoneyValue | null | undefined>,
): MoneyValue | null {
  const presentValues = values.filter(isMoneyValue);

  if (presentValues.length === 0) {
    return null;
  }

  const currencies = collectCurrencies(presentValues);

  if (currencies.length !== 1) {
    return null;
  }

  return {
    amount: presentValues.reduce((sum, value) => sum + value.amount, 0),
    currency: currencies[0],
  };
}

function getActivityCurrency(activity: NormalizedActivity): string | null {
  return (
    activity.pricePerShare?.currency ??
    activity.amounts.amountNet?.currency ??
    activity.amounts.amount?.currency ??
    activity.activityCurrency ??
    null
  );
}

function normalizeCurrencyCode(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function getCostBasisAmountForBuy(activity: NormalizedActivity): number | null {
  return activity.amounts.amountNet?.amount ?? activity.amounts.amount?.amount ?? null;
}

function getDividendNetAmount(activity: NormalizedActivity): number | null {
  return activity.amounts.amountNet?.amount ?? null;
}

function normalizeLookupIsin(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function getAssetIsin(assetKey: GlobalAssetKey, activities: NormalizedActivity[]): string | null {
  if (assetKey.type === "isin") {
    return normalizeLookupIsin(assetKey.value);
  }

  const candidate = activities.find((activity) => activity.assetIdentity.isin)?.assetIdentity.isin;
  const normalized = normalizeLookupIsin(candidate);
  return normalized.length > 0 ? normalized : null;
}

function getReadableAssetLabel(assetKey: GlobalAssetKey | null | undefined): string {
  if (!assetKey) {
    return "unknown_asset";
  }

  return assetKey.value ?? `${assetKey.type}:unknown`;
}

function deriveValuationFreshnessState(priceDate: string | null): GlobalAssetValuationFreshnessState {
  if (!priceDate) {
    return "unknown";
  }

  const date = new Date(`${priceDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const ageMs = Date.now() - date.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return ageMs > sevenDaysMs ? "stale" : "fresh";
}

function buildValuationSnapshot(input: {
  overlay: GlobalAssetMarketPriceOverlay | null;
  fallbackLatestTradePrice: number | null;
  fallbackCurrency: string | null;
  reportingCurrency?: string | null;
}): GlobalAssetValuationSnapshot {
  if (input.overlay) {
    const nativeCurrency = normalizeCurrencyCode(input.overlay.currency ?? input.fallbackCurrency);
    const reportingCurrency =
      normalizeCurrencyCode(input.overlay.reportingCurrency) ??
      normalizeCurrencyCode(input.reportingCurrency);
    const nativeMarketPrice = nativeCurrency
      ? {
          amount: input.overlay.priceAmount,
          currency: nativeCurrency,
        }
      : null;
    const fxRate = input.overlay.fxRate ?? null;
    const fxRateMatchesUsdEur =
      fxRate != null &&
      normalizeCurrencyCode(fxRate.fromCurrency) === "USD" &&
      normalizeCurrencyCode(fxRate.toCurrency) === "EUR" &&
      Number.isFinite(fxRate.rate) &&
      fxRate.rate > 0;
    const requiresUsdEurConversion =
      nativeMarketPrice?.currency === "USD" && reportingCurrency === "EUR";
    const marketPrice =
      nativeMarketPrice == null
        ? null
        : !reportingCurrency || nativeMarketPrice.currency === reportingCurrency
          ? nativeMarketPrice
          : requiresUsdEurConversion && fxRateMatchesUsdEur
            ? {
                amount: nativeMarketPrice.amount * fxRate.rate,
                currency: reportingCurrency,
              }
            : null;
    const fxStatus =
      nativeMarketPrice == null || !reportingCurrency
        ? "not_requested"
        : nativeMarketPrice.currency === reportingCurrency
          ? "not_required"
          : marketPrice
            ? "converted"
            : "missing_rate";

    return {
      marketPrice,
      nativeMarketPrice,
      reportingMarketPrice: marketPrice,
      latestTradePrice:
        input.fallbackLatestTradePrice != null && input.fallbackCurrency
          ? {
              amount: input.fallbackLatestTradePrice,
              currency: normalizeCurrencyCode(input.fallbackCurrency) ?? input.fallbackCurrency,
            }
          : null,
      reportingCurrency: reportingCurrency ?? marketPrice?.currency ?? nativeMarketPrice?.currency ?? null,
      fxRate: fxStatus === "converted" ? fxRate : null,
      fxStatus,
      priceDate: input.overlay.priceDate,
      priceTimestamp: input.overlay.priceTimestamp,
      priceSource: input.overlay.priceSource,
      sourceKind: "market_data_db",
      freshnessState: deriveValuationFreshnessState(input.overlay.priceDate),
    };
  }

  if (input.fallbackLatestTradePrice != null && input.fallbackCurrency) {
    return {
      marketPrice: null,
      latestTradePrice: {
        amount: input.fallbackLatestTradePrice,
        currency: input.fallbackCurrency,
      },
      priceDate: null,
      priceTimestamp: null,
      priceSource: "latest_trade_price",
      sourceKind: "latest_trade_price_fallback",
      freshnessState: "unknown",
    };
  }

  return {
    marketPrice: null,
    latestTradePrice: null,
    priceDate: null,
    priceTimestamp: null,
    priceSource: null,
    sourceKind: "missing",
    freshnessState: "missing",
  };
}

function getEffectiveValuationCurrency(input: {
  valuation: GlobalAssetValuationSnapshot;
  fallbackCurrency: string | null;
}): string | null {
  return input.valuation.marketPrice?.currency ?? input.valuation.latestTradePrice?.currency ?? input.fallbackCurrency;
}

function pushMissingFxRateWarning(input: {
  warnings: ReconciliationWarning[];
  assetKey: GlobalAssetKey;
  portfolioId?: string | null;
}) {
  input.warnings.push(
    createAggregationWarning({
      code: "FX_RATE_MISSING",
      severity: "Warning",
      message: "FX rate is missing, so reporting-currency valuation metrics are blocked.",
      debugMessage: "USD market prices require a USD->EUR daily FX rate before EUR reporting values can be calculated.",
      assetKey: input.assetKey,
      portfolioId: input.portfolioId,
      blockedMetrics: ["market_value", "unrealized_pnl", "confidence"],
    }),
  );
}

function buildValuationDrivenMoneyMetrics(input: {
  quantity: number;
  remainingCostBasis: number;
  valuation: GlobalAssetValuationSnapshot;
  currency: string | null;
}): {
  marketValue: MoneyValue | null;
  costBasis: MoneyValue | null;
  unrealizedPnL: MoneyValue | null;
} {
  const currency = input.currency;
  const marketPriceAmount = input.valuation.marketPrice?.amount ?? null;
  const latestTradeFallbackAmount =
    input.valuation.sourceKind === "latest_trade_price_fallback"
      ? input.valuation.latestTradePrice?.amount ?? null
      : null;
  const effectivePrice =
    marketPriceAmount ?? latestTradeFallbackAmount;

  const costBasis =
    currency != null
      ? {
          amount: input.remainingCostBasis,
          currency,
        }
      : null;

  if (effectivePrice == null || currency == null) {
    return {
      marketValue: null,
      costBasis,
      unrealizedPnL: null,
    };
  }

  const marketValueAmount = input.quantity * effectivePrice;

  return {
    marketValue: {
      amount: marketValueAmount,
      currency,
    },
    costBasis,
    unrealizedPnL: {
      amount: marketValueAmount - input.remainingCostBasis,
      currency,
    },
  };
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

function getSuggestedDecisionTypes(cause: NegativeQuantityCauseType): GlobalAssetOverrideDecisionType[] {
  switch (cause) {
    case "transfer_in_then_sell_then_sell":
    case "duplicate_sell_candidate":
      return ["ignore_activity_for_position", "reclassify_activity_type", "mark_as_known_external_issue"];
    case "sell_quantity_ratio_mismatch":
    case "possible_decimal_or_split_issue":
      return ["manual_review_required", "mark_as_known_external_issue", "add_manual_quantity_adjustment", "reclassify_activity_type"];
    case "sell_exceeds_known_position":
    case "missing_inbound_activity":
      return ["add_manual_quantity_adjustment", "reclassify_activity_type", "mark_as_known_external_issue", "manual_review_required"];
    case "unknown_negative_quantity_case":
      return ["mark_as_known_external_issue", "manual_review_required", "add_manual_quantity_adjustment"];
  }
}

function getQuantityRatio(inboundQuantity: number, outboundQuantity: number): number | null {
  if (inboundQuantity <= QUANTITY_EPSILON || outboundQuantity <= QUANTITY_EPSILON) {
    return null;
  }

  return outboundQuantity / inboundQuantity;
}

function getPossibleMismatchFactor(quantityRatio: number | null): number | null {
  if (!quantityRatio) {
    return null;
  }

  const match = COMMON_MISMATCH_FACTORS.find((factor) => Math.abs(quantityRatio - factor) <= RATIO_TOLERANCE);
  return match ?? null;
}

function getRatioHint(possibleMismatchFactor: number | null): string | null {
  if (!possibleMismatchFactor) {
    return null;
  }

  return `Known outbound quantity is approximately ${possibleMismatchFactor}x known inbound quantity.`;
}

function classifyNegativeQuantityCause(
  assetKey: GlobalAssetKey,
  portfolioId: string,
  activities: NormalizedActivity[],
  currentQuantity: number
): NegativeQuantityCause {
  const knownInboundQuantity = normalizeQuantityForStatus(
    activities.reduce((sum, activity) => sum + inboundQuantityEffect(activity), 0)
  );
  const knownOutboundQuantity = normalizeQuantityForStatus(
    activities.reduce((sum, activity) => sum + outboundQuantityEffect(activity), 0)
  );
  const transferIns = activities.filter((activity) => activity.activityType === "transfer_in" && inboundQuantityEffect(activity) > 0);
  const sells = activities.filter((activity) => activity.activityType === "sell" && outboundQuantityEffect(activity) > 0);
  const quantityRatio = getQuantityRatio(knownInboundQuantity, knownOutboundQuantity);
  const possibleMismatchFactor = getPossibleMismatchFactor(quantityRatio);
  const hasTransferInThenSellThenSell = transferIns.some((transferIn) => {
    const matchingSells = sells.filter((sell) => quantitiesMatch(sell.quantity ?? 0, transferIn.quantity ?? 0));
    return matchingSells.length >= 2;
  });
  const hasDuplicateSellCandidate = sells.some((sell, index) =>
    sells.slice(index + 1).some((otherSell) => quantitiesMatch(sell.quantity ?? 0, otherSell.quantity ?? 0))
  );
  let cause: NegativeQuantityCauseType = "unknown_negative_quantity_case";

  if (hasTransferInThenSellThenSell) {
    cause = "transfer_in_then_sell_then_sell";
  } else if (hasDuplicateSellCandidate) {
    cause = "duplicate_sell_candidate";
  } else if (knownInboundQuantity === 0 && knownOutboundQuantity > 0) {
    cause = "missing_inbound_activity";
  } else if (possibleMismatchFactor) {
    cause = possibleMismatchFactor === 10 ? "possible_decimal_or_split_issue" : "sell_quantity_ratio_mismatch";
  } else if (knownOutboundQuantity > knownInboundQuantity) {
    cause = "sell_exceeds_known_position";
  }

  return {
    cause,
    assetKey,
    portfolioId,
    knownInboundQuantity,
    knownOutboundQuantity,
    negativeQuantity: currentQuantity,
    quantityRatio,
    possibleMismatchFactor,
    ratioHint: getRatioHint(possibleMismatchFactor),
    suggestedDecisionTypes: getSuggestedDecisionTypes(cause),
  };
}

function buildPortfolioBreakdowns(input: {
  assetKey: GlobalAssetKey;
  activities: NormalizedActivity[];
  warnings: ReconciliationWarning[];
  unresolvedDecisionCandidates: UnresolvedDecisionCandidate[];
  marketPriceOverlay: GlobalAssetMarketPriceOverlay | null;
  assetLatestTradePrice: number | null;
  reportingCurrency?: string | null;
}): PortfolioBreakdown[] {
  const groups = new Map<string, NormalizedActivity[]>();

  for (const activity of input.activities) {
    const portfolioId = activity.portfolioContext.portfolioId;
    const current = groups.get(portfolioId) ?? [];
    current.push(activity);
    groups.set(portfolioId, current);
  }

  if (groups.size === 0) {
    input.warnings.push(
      createAggregationWarning({
        code: "MISSING_PORTFOLIO_BREAKDOWN",
        severity: "Warning",
        message: "No portfolio breakdown could be created for asset.",
        debugMessage: "At least one portfolio context is required for breakdowns.",
        assetKey: input.assetKey,
        blockedMetrics: ["portfolio_breakdown"],
      })
    );
  }

  return Array.from(groups.entries()).map(([portfolioId, portfolioActivities]) => {
    let netShares = 0;
    let remainingCostBasis = 0;
    let totalDividendNet = 0;
    let hasExplicitCostBasis = false;

    for (const activity of portfolioActivities) {
      const quantity = activity.quantity ?? 0;

      if (activity.activityType === "buy" || activity.activityType === "deposit") {
        const costBasisAmount = getCostBasisAmountForBuy(activity);
        const next = applyBuyPositionDelta(
          { netShares, remainingCostBasis },
          { shares: quantity, amount: costBasisAmount ?? 0 },
        );
        netShares = next.netShares;
        remainingCostBasis = next.remainingCostBasis;
        hasExplicitCostBasis = hasExplicitCostBasis || costBasisAmount != null;
      } else if (activity.activityType === "transfer_in") {
        const next = applyTransferInPositionDelta(
          { netShares, remainingCostBasis },
          { shares: quantity },
        );
        netShares = next.netShares;
        remainingCostBasis = next.remainingCostBasis;
      } else if (
        activity.activityType === "sell" ||
        activity.activityType === "withdrawal" ||
        activity.activityType === "transfer_out"
      ) {
        const next = applySellLikePositionDelta(
          { netShares, remainingCostBasis },
          { shares: quantity },
        );
        netShares = next.netShares;
        remainingCostBasis = next.remainingCostBasis;
      } else if (activity.activityType === "dividend") {
        const dividendNetAmount = getDividendNetAmount(activity);
        if (dividendNetAmount != null) {
          totalDividendNet += dividendNetAmount;
        }
      }

    }

    const rounded = normalizePositionRounding({
      netShares: normalizeQuantityForStatus(netShares),
      remainingCostBasis,
    });
    const computedQuantity = normalizeQuantityForStatus(rounded.netShares);
    const quantity = computedQuantity;
    const status: PortfolioBreakdownStatus = isPositiveQuantity(quantity)
      ? "active"
      : quantity === 0
        ? "historical_only"
        : "unknown";
    const breakdownWarnings: ReconciliationWarning[] = [];

    if (isNegativeQuantity(quantity)) {
      const negativeQuantityCause = classifyNegativeQuantityCause(
        input.assetKey,
        portfolioId,
        portfolioActivities,
        quantity
      );
      const unresolvedDecisionCandidate: UnresolvedDecisionCandidate = {
        ...negativeQuantityCause,
        metricsBlocked: true,
      };
      const warning = createAggregationWarning({
        code: "NEGATIVE_POSITION_QUANTITY",
        severity: "Warning",
        message: "Portfolio position quantity is negative.",
        debugMessage: "Preliminary quantity calculation resulted in a negative portfolio quantity after applying tolerance.",
        assetKey: input.assetKey,
        portfolioId,
        blockedMetrics: ["position", "portfolio_breakdown"],
        metadata: {
          negativeQuantityCause,
        },
      });
      breakdownWarnings.push(warning);
      input.warnings.push(warning);
      input.unresolvedDecisionCandidates.push(unresolvedDecisionCandidate);
    }

    const priceCurrencies = collectCurrencies(
      portfolioActivities.map((activity) => {
        if (
          activity.activityType === "buy" ||
          activity.activityType === "sell" ||
          activity.activityType === "deposit" ||
          activity.activityType === "withdrawal" ||
          activity.activityType === "transfer_in" ||
          activity.activityType === "transfer_out"
        ) {
          const currency = getActivityCurrency(activity);
          return currency ? { amount: 0, currency } : null;
        }

        return null;
      }),
    );
    const tradeCurrency = priceCurrencies.length === 1 ? priceCurrencies[0] : null;
    const valuation = buildValuationSnapshot({
      overlay: input.marketPriceOverlay,
      fallbackLatestTradePrice: input.assetLatestTradePrice,
      fallbackCurrency: tradeCurrency,
      reportingCurrency: input.reportingCurrency,
    });
    if (valuation.fxStatus === "missing_rate") {
      pushMissingFxRateWarning({
        warnings: breakdownWarnings,
        assetKey: input.assetKey,
        portfolioId,
      });
    }
    const valuationCurrency = getEffectiveValuationCurrency({
      valuation,
      fallbackCurrency: tradeCurrency,
    });
    const metrics = calculatePositionMetrics({
      netShares: quantity,
      remainingCostBasis: rounded.remainingCostBasis,
      latestTradePrice:
        valuation.sourceKind === "latest_trade_price_fallback"
          ? valuation.latestTradePrice?.amount ?? null
          : null,
      marketPrice: valuation.marketPrice?.amount ?? null,
    });
    const valuationDrivenMetrics = buildValuationDrivenMoneyMetrics({
      quantity,
      remainingCostBasis: rounded.remainingCostBasis,
      valuation,
      currency: valuationCurrency,
    });
    const costBasis = hasExplicitCostBasis ? valuationDrivenMetrics.costBasis : null;
    const pnl = hasExplicitCostBasis ? valuationDrivenMetrics.unrealizedPnL : null;
    const dividendsCurrencies = collectCurrencies(
      portfolioActivities
        .filter((activity) => activity.activityType === "dividend")
        .map((activity) => activity.amounts.amountNet),
    );
    const dividendsCurrency =
      dividendsCurrencies.length === 1 ? dividendsCurrencies[0] : null;

    return {
      portfolioId,
      portfolioName: portfolioActivities[0]?.portfolioContext.portfolioName ?? null,
      quantity,
      marketValue: valuationDrivenMetrics.marketValue,
      costBasis,
      pnl,
      dividendsNet: dividendsCurrency
        ? { amount: totalDividendNet, currency: dividendsCurrency }
        : null,
      fees: null,
      taxes: null,
      avgBuyPrice:
        hasExplicitCostBasis && valuationCurrency && metrics.avgBuyPrice != null
          ? { amount: metrics.avgBuyPrice, currency: valuationCurrency }
          : null,
      valuation,
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

function buildAsset(
  assetKey: GlobalAssetKey,
  activities: NormalizedActivity[],
  marketPriceOverlaysByIsin: GlobalAssetMarketPriceOverlaysByIsin = {},
  reportingCurrency?: string | null,
): GlobalAsset {
  const warnings: ReconciliationWarning[] = [];
  const unresolvedDecisionCandidates: UnresolvedDecisionCandidate[] = [];

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

  let latestTradePrice: number | null = null;
  for (const activity of activities) {
    const tradePrice = activity.pricePerShare?.amount ?? null;
    if (
      tradePrice != null &&
      (activity.activityType === "buy" ||
        activity.activityType === "sell" ||
        activity.activityType === "deposit" ||
        activity.activityType === "withdrawal" ||
        activity.activityType === "transfer_in" ||
        activity.activityType === "transfer_out")
    ) {
      latestTradePrice = updateLatestTradePrice(latestTradePrice, tradePrice);
    }
  }

  const assetIsin = getAssetIsin(assetKey, activities);
  const marketPriceOverlay = assetIsin ? marketPriceOverlaysByIsin[assetIsin] ?? null : null;

  const portfolioBreakdowns = buildPortfolioBreakdowns({
    assetKey,
    activities,
    warnings,
    unresolvedDecisionCandidates,
    marketPriceOverlay,
    assetLatestTradePrice: latestTradePrice,
    reportingCurrency,
  });
  const rawTotalQuantity = portfolioBreakdowns.reduce((sum, breakdown) => sum + (breakdown.quantity ?? 0), 0);
  const totalQuantity = normalizeQuantityForStatus(rawTotalQuantity);

  if (isNegativeQuantity(totalQuantity)) {
    const firstCause = unresolvedDecisionCandidates[0];
    warnings.push(
      createAggregationWarning({
        code: "NEGATIVE_POSITION_QUANTITY",
        severity: "Warning",
        message: "Global asset quantity is negative.",
        debugMessage: "Preliminary quantity calculation resulted in a negative global quantity after applying tolerance.",
        assetKey,
        blockedMetrics: ["position"],
        metadata: firstCause
          ? {
              negativeQuantityCause: firstCause,
            }
          : undefined,
      })
    );
  }

  const currencies = collectCurrencies(
    activities.map((activity) => (activity.activityCurrency ? { amount: 0, currency: activity.activityCurrency } : null))
  );
  const hasMixedCurrencies = currencies.length > 1;
  const valuation = buildValuationSnapshot({
    overlay: marketPriceOverlay,
    fallbackLatestTradePrice: latestTradePrice,
    fallbackCurrency: currencies.length === 1 ? currencies[0] : null,
    reportingCurrency,
  });

  if (valuation.sourceKind === "latest_trade_price_fallback") {
    warnings.push(
      createAggregationWarning({
        code: "MARKET_PRICE_FALLBACK_USED",
        severity: "Warning",
        message: "Current market price is missing; valuation falls back to latest trade price.",
        debugMessage: "Slice 2 keeps latestTradePrice only as an explicit degraded fallback path.",
        assetKey,
        blockedMetrics: ["confidence"],
      }),
    );
  } else if (valuation.fxStatus === "missing_rate") {
    pushMissingFxRateWarning({
      warnings,
      assetKey,
    });
  } else if (valuation.sourceKind === "missing") {
    warnings.push(
      createAggregationWarning({
        code: "MISSING_MARKET_PRICE",
        severity: "Warning",
        message: "Current market price is missing, so valuation metrics are blocked.",
        debugMessage: "Neither market-data overlay nor latest trade fallback was available.",
        assetKey,
        blockedMetrics: ["market_value", "unrealized_pnl", "confidence"],
      }),
    );
  } else if (valuation.freshnessState === "stale") {
    warnings.push(
      createAggregationWarning({
        code: "STALE_MARKET_PRICE",
        severity: "Warning",
        message: "Current market price is stale; valuation is preliminary.",
        debugMessage: "Latest DB market price is older than the freshness threshold.",
        assetKey,
        blockedMetrics: ["confidence"],
      }),
    );
  }

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

  const totalMarketValue = sumMoneyValuesWithoutWarning(
    portfolioBreakdowns.map((breakdown) => breakdown.marketValue),
  );
  const totalCostBasis = sumMoneyValuesWithoutWarning(
    portfolioBreakdowns.map((breakdown) => breakdown.costBasis),
  );
  const totalUnrealizedPnL = sumMoneyValuesWithoutWarning(
    portfolioBreakdowns.map((breakdown) => breakdown.pnl),
  );
  const valuationCurrency = getEffectiveValuationCurrency({
    valuation,
    fallbackCurrency: currencies.length === 1 ? currencies[0] : null,
  });
  const valuationDrivenTotals = buildValuationDrivenMoneyMetrics({
    quantity: totalQuantity,
    remainingCostBasis: totalCostBasis?.amount ?? 0,
    valuation,
    currency: totalCostBasis?.currency ?? valuationCurrency,
  });
  const totalDividendsNet =
    sumMoneyValuesWithoutWarning(
      portfolioBreakdowns.map((breakdown) => breakdown.dividendsNet),
    ) ?? dividendsNet;

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
    valuation,
    warnings,
    unresolvedDecisionCandidates,
    confidence: deriveAssetConfidence(warnings),
    status,
    totals: {
      quantity: totalQuantity,
      marketValue: valuationDrivenTotals.marketValue ?? totalMarketValue,
      costBasis: totalCostBasis,
      unrealizedPnL: valuationDrivenTotals.unrealizedPnL ?? totalUnrealizedPnL,
      dividendsNet: totalDividendsNet,
      fees,
      taxes,
    },
  };
}

export function buildGlobalAssets(
  activities: NormalizedActivity[],
  options: GlobalAssetAggregationOptions = {},
): GlobalAssetAggregationResult {
  const overrideResult = applyGlobalAssetPositionOverrides(activities);
  const activitiesWithOverrides = overrideResult.activities;
  const groups = new Map<string, { assetKey: GlobalAssetKey; activities: NormalizedActivity[] }>();
  const unassignedActivities: NormalizedActivity[] = [];
  const warnings: ReconciliationWarning[] = [];

  for (const activity of activitiesWithOverrides) {
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

  const assets = Array.from(groups.values()).map((group) =>
    buildAsset(
      group.assetKey,
      group.activities,
      options.marketPriceOverlaysByIsin,
      options.reportingCurrency,
    ),
  );

  let valuationAnomalies = 0;
  let fallbackPriceUsedCount = 0;
  let missingMarketPriceCount = 0;

  for (const asset of assets) {
    const isin = asset.assetKey?.type === "isin" ? asset.assetKey.value : null;
    const assetLabel = getReadableAssetLabel(asset.assetKey);
    const valuation = asset.valuation ?? {
      marketPrice: null,
      latestTradePrice: null,
      priceDate: null,
      priceTimestamp: null,
      priceSource: null,
      sourceKind: "missing" as const,
      freshnessState: "missing" as const,
    };

    if (valuation.sourceKind === "latest_trade_price_fallback") {
      fallbackPriceUsedCount += 1;
    } else if (valuation.sourceKind === "missing") {
      missingMarketPriceCount += 1;
    }

    const assetInvariant = logValuationInvariant("aggregate:asset", {
      isin,
      assetLabel,
      quantity: asset.totals.quantity,
      marketPrice: valuation.marketPrice?.amount ?? null,
      marketValue: asset.totals.marketValue?.amount ?? null,
      remainingCostBasis: asset.totals.costBasis?.amount ?? null,
      unrealizedPnL: asset.totals.unrealizedPnL?.amount ?? null,
      valuationSourceKind: valuation.sourceKind,
      priceDate: valuation.priceDate,
      priceSource: valuation.priceSource,
    });

    if (assetInvariant.checked && !assetInvariant.isConsistent) {
      valuationAnomalies += 1;
    }

    for (const breakdown of asset.portfolioBreakdowns) {
      const breakdownInvariant = logValuationInvariant("aggregate:portfolio_breakdown", {
        isin,
        assetLabel,
        portfolioId: breakdown.portfolioId,
        portfolioName: breakdown.portfolioName,
        quantity: breakdown.quantity,
        marketPrice: breakdown.valuation?.marketPrice?.amount ?? valuation.marketPrice?.amount ?? null,
        marketValue: breakdown.marketValue?.amount ?? null,
        remainingCostBasis: breakdown.costBasis?.amount ?? null,
        unrealizedPnL: breakdown.pnl?.amount ?? null,
        valuationSourceKind: breakdown.valuation?.sourceKind ?? valuation.sourceKind,
        priceDate: breakdown.valuation?.priceDate ?? valuation.priceDate,
        priceSource: breakdown.valuation?.priceSource ?? valuation.priceSource,
      });

      if (breakdownInvariant.checked && !breakdownInvariant.isConsistent) {
        valuationAnomalies += 1;
      }
    }
  }

  const assetWarnings = assets.flatMap((asset) => asset.warnings);
  const assetDecisionCandidates = assets.flatMap((asset) => asset.unresolvedDecisionCandidates ?? []);
  const allWarnings = [...warnings, ...assetWarnings];

  summarizeDiagnostics("aggregate", {
    totalAssetsChecked: assets.length,
    valuationAnomalies,
    fallbackPriceUsedCount,
    missingMarketPriceCount,
  }, "valuation");

  return {
    assets,
    unassignedActivities,
    warnings: allWarnings,
    unresolvedDecisionCandidates: assetDecisionCandidates,
    appliedOverrides: overrideResult.appliedOverrides,
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
      appliedOverrideCount: overrideResult.appliedOverrides.length,
    },
  };
}

export function buildGlobalAssetsFromNormalizationResult(
  result: ActivitiesNormalizationResult,
  options: GlobalAssetAggregationOptions = {},
): GlobalAssetAggregationResult {
  const aggregation = buildGlobalAssets(result.activities, options);

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
