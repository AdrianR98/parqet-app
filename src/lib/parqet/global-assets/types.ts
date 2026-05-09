export type GlobalAssetKeyType = "isin" | "wkn" | "parqet_asset_id" | "manual";

export type GlobalAssetKey =
  | { type: "isin"; value: string }
  | { type: "wkn"; value: string }
  | { type: "parqet_asset_id"; value: string }
  | { type: "manual"; value: string };

export type MoneyValue = {
  amount: number;
  currency: string;
};

export type ActivityType =
  | "buy"
  | "sell"
  | "dividend"
  | "deposit"
  | "withdrawal"
  | "transfer_in"
  | "transfer_out"
  | "fees_taxes"
  | "unknown";

export type TimelineDisplayType =
  | ActivityType
  | "external_inflow"
  | "external_outflow"
  | "possible_transfer"
  | "matched_transfer"
  | "unknown_event";

export type GlobalAssetStatus = "active" | "closed" | "unknown";

export type PortfolioBreakdownStatus = "active" | "closed" | "historical_only" | "unknown";

export type ReconciliationWarningSeverity = "Blocker" | "Warning" | "Info";

export type ReconciliationWarningSource =
  | "normalization"
  | "aggregation"
  | "transfer"
  | "portfolio"
  | "pricing"
  | "audit";

export type ReconciliationWarningCode =
  | "RAW_ACTIVITY_NOT_OBJECT"
  | "UNKNOWN_ACTIVITY_TYPE"
  | "MISSING_ACTIVITY_ID"
  | "MISSING_DATETIME"
  | "INVALID_DATETIME"
  | "MISSING_ASSET_KEY"
  | "MISSING_ISIN"
  | "INVALID_ISIN"
  | "MISSING_CURRENCY"
  | "FALLBACK_PORTFOLIO_CURRENCY_USED"
  | "MISSING_PORTFOLIO_CONTEXT"
  | "MONEY_FIELD_WITHOUT_CURRENCY"
  | "NUMERIC_PARSE_FAILED"
  | "MISSING_QUANTITY"
  | "MISSING_PRICE"
  | "DUPLICATE_INTERNAL_ACTIVITY_ID"
  | "NEGATIVE_POSITION_QUANTITY"
  | "MIXED_CURRENCIES"
  | "UNASSIGNED_ACTIVITY"
  | "EMPTY_ASSET_GROUP"
  | "MISSING_PORTFOLIO_BREAKDOWN"
  | "TOTALS_BLOCKED_BY_MIXED_CURRENCIES";

export type BlockedMetric =
  | "portfolio_breakdown"
  | "cost_basis"
  | "unrealized_pnl"
  | "realized_gains"
  | "transfer_pairing"
  | "position"
  | "market_value"
  | "dividends"
  | "fees"
  | "taxes"
  | "confidence"
  | "unknown_metric";

export type ConfidenceLevel = "high" | "medium" | "low";

export type TransferStatus = "not_transfer" | "possible" | "matched" | "unmatched";

export type PortfolioContext = {
  portfolioId: string;
  portfolioName?: string | null;
  portfolioCurrency?: string | null;
};

export type ParqetActivityWithPortfolioContext = PortfolioContext & {
  /** Raw Parqet activity for internal processing only. Do not expose fully in UI/API responses. */
  raw: unknown;
};

export type ActivityIds = {
  /** Parqet activity id when available. */
  sourceActivityId: string | null;
  /** Stable internal activity id. The hash/build algorithm is intentionally defined later. */
  internalActivityId: string;
};

export type AssetIdentity = {
  /** Global asset key. If a usable ISIN exists, this should be derivable from it. */
  assetKey: GlobalAssetKey | null;
  isin: string | null;
  assetIdentifierType: string | null;
  holdingId: string | null;
  holdingAssetType: string | null;
};

export type ActivityAmounts = {
  amount?: MoneyValue | null;
  amountNet?: MoneyValue | null;
  fee?: MoneyValue | null;
  tax?: MoneyValue | null;
  buyAmountNet?: MoneyValue | null;
};

export type ParqetReferenceFields = {
  /** Parqet reference value only; not a self-owned app calculation. */
  realizedGains?: MoneyValue | null;
  /** Parqet reference value only; not a self-owned app calculation. */
  realizedGainsNet?: MoneyValue | null;
  /** Parqet reference value only; not a self-owned app calculation. */
  buyAmountNet?: MoneyValue | null;
  /** Parqet reference value only; not a self-owned app calculation. */
  avgHoldingPeriodDays?: number | null;
};

export type NormalizedActivity = {
  ids: ActivityIds;
  activityType: ActivityType;
  sourceType: string | null;
  datetime: string | null;
  date: string | null;
  sortKey: string;
  assetIdentity: AssetIdentity;
  portfolioContext: PortfolioContext;
  quantity: number | null;
  pricePerShare?: MoneyValue | null;
  activityCurrency: string | null;
  amounts: ActivityAmounts;
  parqetReference?: ParqetReferenceFields | null;
};

export type WarningEntityRefs = {
  assetKey?: GlobalAssetKey | null;
  activityId?: string | null;
  portfolioId?: string | null;
  holdingId?: string | null;
  transferGroupId?: string | null;
  fieldPath?: string | null;
};

export type ReconciliationWarning = {
  code: ReconciliationWarningCode | string;
  severity: ReconciliationWarningSeverity;
  /** Short UI-capable message. */
  message: string;
  /** Optional technical explanation for debug/audit surfaces. */
  debugMessage?: string;
  source: ReconciliationWarningSource;
  entityRefs?: WarningEntityRefs;
  blockedMetrics?: BlockedMetric[];
};

export type AssetConfidence = {
  level: ConfidenceLevel;
  reasons: string[];
  warningCodes: string[];
};

export type TransferCandidate = {
  id: string;
  status: TransferStatus;
  activityIds: string[];
  confidence: AssetConfidence;
  warnings: ReconciliationWarning[];
};

export type TransferGroup = {
  id: string;
  status: TransferStatus;
  activityIds: string[];
  candidates: TransferCandidate[];
  confidence: AssetConfidence;
  warnings: ReconciliationWarning[];
};

export type GlobalAssetTimelineEntry = {
  activity: NormalizedActivity;
  portfolioContext: PortfolioContext;
  warnings: ReconciliationWarning[];
  transferGroupId?: string | null;
  displayType: TimelineDisplayType;
  sortKey: string;
};

export type AssetDisplayMetadata = {
  name?: string | null;
  subtitle?: string | null;
  symbol?: string | null;
  logoUrl?: string | null;
  metadataSource?: string | null;
};

/** Calculated snapshot fields. Builders decide how and when these values are populated. */
export type GlobalAssetTotals = {
  quantity?: number | null;
  marketValue?: MoneyValue | null;
  costBasis?: MoneyValue | null;
  unrealizedPnL?: MoneyValue | null;
  dividendsNet?: MoneyValue | null;
  fees?: MoneyValue | null;
  taxes?: MoneyValue | null;
};

export type PortfolioBreakdown = {
  portfolioId: string;
  portfolioName?: string | null;
  quantity: number | null;
  marketValue?: MoneyValue | null;
  costBasis?: MoneyValue | null;
  pnl?: MoneyValue | null;
  avgBuyPrice?: MoneyValue | null;
  shareOfGlobalPosition?: number | null;
  status: PortfolioBreakdownStatus;
  warnings: ReconciliationWarning[];
};

export type GlobalAsset = {
  assetKey: GlobalAssetKey | null;
  display: AssetDisplayMetadata;
  timeline: GlobalAssetTimelineEntry[];
  portfolioBreakdowns: PortfolioBreakdown[];
  warnings: ReconciliationWarning[];
  confidence: AssetConfidence;
  status: GlobalAssetStatus;
  totals: GlobalAssetTotals;
};

export type ActivityNormalizationResult = {
  activity: NormalizedActivity | null;
  warnings: ReconciliationWarning[];
};

export type ActivitiesNormalizationSummary = {
  inputCount: number;
  normalizedCount: number;
  rejectedCount: number;
  warningCount: number;
  blockerCount: number;
  duplicateInternalIdCount: number;
};

export type ActivitiesNormalizationResult = {
  activities: NormalizedActivity[];
  results: ActivityNormalizationResult[];
  warnings: ReconciliationWarning[];
  summary: ActivitiesNormalizationSummary;
};

export type GlobalAssetAggregationSummary = {
  inputActivityCount: number;
  assetCount: number;
  unassignedActivityCount: number;
  warningCount: number;
  blockerCount: number;
  activeAssetCount: number;
  closedAssetCount: number;
  unknownAssetCount: number;
  mixedCurrencyAssetCount: number;
  negativeQuantityAssetCount: number;
};

export type GlobalAssetAggregationResult = {
  assets: GlobalAsset[];
  unassignedActivities: NormalizedActivity[];
  warnings: ReconciliationWarning[];
  summary: GlobalAssetAggregationSummary;
};

export function isGlobalAssetKey(value: unknown): value is GlobalAssetKey {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { type?: unknown; value?: unknown };

  return (
    typeof candidate.value === "string" &&
    ["isin", "wkn", "parqet_asset_id", "manual"].includes(String(candidate.type))
  );
}

export function isActivityType(value: unknown): value is ActivityType {
  return (
    typeof value === "string" &&
    [
      "buy",
      "sell",
      "dividend",
      "deposit",
      "withdrawal",
      "transfer_in",
      "transfer_out",
      "fees_taxes",
      "unknown",
    ].includes(value)
  );
}

export function isWarningSeverity(value: unknown): value is ReconciliationWarningSeverity {
  return typeof value === "string" && ["Blocker", "Warning", "Info"].includes(value);
}

export function isTransferStatus(value: unknown): value is TransferStatus {
  return typeof value === "string" && ["not_transfer", "possible", "matched", "unmatched"].includes(value);
}
