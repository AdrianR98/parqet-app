import {
  ActivityNormalizationResult,
  ActivitiesNormalizationResult,
  ActivityType,
  BlockedMetric,
  GlobalAssetKey,
  MoneyValue,
  NormalizedActivity,
  ParqetActivityWithPortfolioContext,
  ParqetReferenceFields,
  ReconciliationWarning,
  ReconciliationWarningCode,
  ReconciliationWarningSeverity,
} from "./types";

const ISO_LIKE_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/;
const SUPPORTED_ACTIVITY_TYPES: ActivityType[] = [
  "buy",
  "sell",
  "dividend",
  "deposit",
  "withdrawal",
  "transfer_in",
  "transfer_out",
  "fees_taxes",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function readNestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return readRecord(record[key]);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readNumber(record: Record<string, unknown>, key: string): { value: number | null; failed: boolean } {
  const value = record[key];

  if (typeof value === "number") {
    return Number.isFinite(value) ? { value, failed: false } : { value: null, failed: true };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return { value: null, failed: false };
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? { value: parsed, failed: false } : { value: null, failed: true };
  }

  if (value === null || value === undefined) {
    return { value: null, failed: false };
  }

  return { value: null, failed: true };
}

function createWarning(input: {
  code: ReconciliationWarningCode;
  severity: ReconciliationWarningSeverity;
  message: string;
  debugMessage?: string;
  portfolioId?: string | null;
  activityId?: string | null;
  holdingId?: string | null;
  fieldPath?: string | null;
  assetKey?: GlobalAssetKey | null;
  blockedMetrics?: BlockedMetric[];
}): ReconciliationWarning {
  return {
    code: input.code,
    severity: input.severity,
    message: input.message,
    debugMessage: input.debugMessage,
    source: "normalization",
    entityRefs: {
      assetKey: input.assetKey,
      activityId: input.activityId,
      portfolioId: input.portfolioId,
      holdingId: input.holdingId,
      fieldPath: input.fieldPath,
    },
    blockedMetrics: input.blockedMetrics,
  };
}

function normalizeActivityType(sourceType: string | null): ActivityType {
  if (!sourceType) {
    return "unknown";
  }

  return SUPPORTED_ACTIVITY_TYPES.includes(sourceType as ActivityType) ? (sourceType as ActivityType) : "unknown";
}

function normalizeIsin(isin: string | null): string | null {
  if (!isin) {
    return null;
  }

  const normalized = isin.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function isValidSimpleIsin(isin: string | null): boolean {
  return typeof isin === "string" && isin.length === 12;
}

function readIsin(raw: Record<string, unknown>): string | null {
  const asset = readNestedRecord(raw, "asset");

  return normalizeIsin(
    (asset ? readString(asset, "isin") : null) ??
      readString(raw, "isin") ??
      (asset ? readString(asset, "identifier") : null)
  );
}

function readAssetIdentifierType(raw: Record<string, unknown>): string | null {
  const asset = readNestedRecord(raw, "asset");
  return asset ? readString(asset, "assetIdentifierType") : null;
}

function readHoldingId(raw: Record<string, unknown>): string | null {
  const holding = readNestedRecord(raw, "holding");
  return readString(raw, "holdingId") ?? (holding ? readString(holding, "id") : null);
}

function readCurrency(input: ParqetActivityWithPortfolioContext, raw: Record<string, unknown>) {
  const rawCurrency = readString(raw, "currency");
  const fallbackCurrency = input.portfolioCurrency?.trim() || null;

  return {
    currency: rawCurrency ?? fallbackCurrency,
    usedPortfolioFallback: !rawCurrency && Boolean(fallbackCurrency),
  };
}

function readMoney(
  raw: Record<string, unknown>,
  key: string,
  currency: string | null,
  warnings: ReconciliationWarning[],
  context: { portfolioId: string; activityId: string | null }
): MoneyValue | null {
  const parsed = readNumber(raw, key);

  if (parsed.failed) {
    warnings.push(
      createWarning({
        code: "NUMERIC_PARSE_FAILED",
        severity: "Warning",
        message: "A numeric field could not be parsed.",
        debugMessage: `Could not parse numeric field '${key}'.`,
        portfolioId: context.portfolioId,
        activityId: context.activityId,
        fieldPath: key,
      })
    );
    return null;
  }

  if (parsed.value === null) {
    return null;
  }

  if (!currency) {
    warnings.push(
      createWarning({
        code: "MONEY_FIELD_WITHOUT_CURRENCY",
        severity: "Warning",
        message: "A money field has an amount but no currency.",
        debugMessage: `Money field '${key}' could not be mapped because no currency was available.`,
        portfolioId: context.portfolioId,
        activityId: context.activityId,
        fieldPath: key,
        blockedMetrics: ["market_value", "cost_basis"],
      })
    );
    return null;
  }

  return {
    amount: parsed.value,
    currency,
  };
}

function buildFallbackId(input: {
  portfolioId: string;
  datetime: string | null;
  sourceType: string | null;
  isin: string | null;
  amount: number | null;
  quantity: number | null;
  index?: number;
}) {
  return [
    "fallback",
    input.portfolioId,
    input.datetime ?? "missing-datetime",
    input.sourceType ?? "missing-type",
    input.isin ?? "missing-isin",
    input.amount === null ? "missing-amount" : String(input.amount),
    input.quantity === null ? "missing-quantity" : String(input.quantity),
    input.index === undefined ? "no-index" : String(input.index),
  ].join("|");
}

export function normalizeActivity(
  input: ParqetActivityWithPortfolioContext,
  options?: { index?: number }
): ActivityNormalizationResult {
  const warnings: ReconciliationWarning[] = [];
  const raw = readRecord(input.raw);

  if (!raw) {
    return {
      activity: null,
      warnings: [
        createWarning({
          code: "RAW_ACTIVITY_NOT_OBJECT",
          severity: "Blocker",
          message: "Raw activity is not an object.",
          debugMessage: "Normalization can only process object-like raw activities.",
          portfolioId: input.portfolioId,
          blockedMetrics: ["position", "cost_basis", "portfolio_breakdown"],
        }),
      ],
    };
  }

  if (!input.portfolioId) {
    warnings.push(
      createWarning({
        code: "MISSING_PORTFOLIO_CONTEXT",
        severity: "Warning",
        message: "Portfolio context is missing.",
        debugMessage: "Portfolio-specific metrics require portfolioId from the fetch layer.",
        blockedMetrics: ["portfolio_breakdown"],
      })
    );
  }

  const sourceActivityId = readString(raw, "id") ?? readString(raw, "activityId");

  if (!sourceActivityId) {
    warnings.push(
      createWarning({
        code: "MISSING_ACTIVITY_ID",
        severity: "Warning",
        message: "Activity source id is missing.",
        debugMessage: "A deterministic fallback internal id will be used.",
        portfolioId: input.portfolioId,
        fieldPath: "id",
      })
    );
  }

  const sourceType = readString(raw, "type");
  const activityType = normalizeActivityType(sourceType);

  if (!sourceType) {
    warnings.push(
      createWarning({
        code: "UNKNOWN_ACTIVITY_TYPE",
        severity: "Warning",
        message: "Activity type is missing.",
        debugMessage: "Missing source type was mapped to unknown.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: "type",
      })
    );
  } else if (activityType === "unknown") {
    warnings.push(
      createWarning({
        code: "UNKNOWN_ACTIVITY_TYPE",
        severity: "Warning",
        message: "Activity type is unknown.",
        debugMessage: "Unsupported source type was mapped to unknown.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: "type",
      })
    );
  }

  const datetime = readString(raw, "datetime");
  let normalizedDate: string | null = null;

  if (!datetime) {
    warnings.push(
      createWarning({
        code: "MISSING_DATETIME",
        severity: "Warning",
        message: "Activity datetime is missing.",
        debugMessage: "Missing datetime prevents reliable timeline ordering.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: "datetime",
      })
    );
  } else if (!ISO_LIKE_DATETIME_PATTERN.test(datetime)) {
    warnings.push(
      createWarning({
        code: "INVALID_DATETIME",
        severity: "Warning",
        message: "Activity datetime is not ISO-like.",
        debugMessage: "Datetime was preserved but date grouping could not be derived safely.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: "datetime",
      })
    );
  } else {
    normalizedDate = datetime.slice(0, 10);
  }

  const isin = readIsin(raw);
  const isValidIsin = isValidSimpleIsin(isin);
  const assetKey: GlobalAssetKey | null = isValidIsin && isin ? { type: "isin", value: isin } : null;
  const holdingId = readHoldingId(raw);

  if (!isin) {
    warnings.push(
      createWarning({
        code: "MISSING_ISIN",
        severity: "Warning",
        message: "Activity has no ISIN.",
        debugMessage: "Global asset identity cannot be derived from ISIN.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        holdingId,
        fieldPath: "asset.isin",
        blockedMetrics: ["position", "cost_basis", "portfolio_breakdown"],
      })
    );
  } else if (!isValidIsin) {
    warnings.push(
      createWarning({
        code: "INVALID_ISIN",
        severity: "Warning",
        message: "Activity ISIN is invalid for the simple Phase-1 check.",
        debugMessage: "P1-4 uses a simple length-12 ISIN validation without checksum.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        holdingId,
        fieldPath: "asset.isin",
        blockedMetrics: ["position", "cost_basis", "portfolio_breakdown"],
      })
    );
  }

  if (!assetKey) {
    warnings.push(
      createWarning({
        code: "MISSING_ASSET_KEY",
        severity: "Warning",
        message: "Global asset key could not be derived.",
        debugMessage: "P1-4 only derives global asset keys from valid ISIN values.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        holdingId,
        blockedMetrics: ["position", "cost_basis", "portfolio_breakdown"],
      })
    );
  }

  const { currency: activityCurrency, usedPortfolioFallback } = readCurrency(input, raw);

  if (!activityCurrency) {
    warnings.push(
      createWarning({
        code: "MISSING_CURRENCY",
        severity: "Warning",
        message: "Activity currency is missing.",
        debugMessage: "No raw currency or portfolio currency fallback was available.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: "currency",
        blockedMetrics: ["market_value", "cost_basis"],
      })
    );
  } else if (usedPortfolioFallback) {
    warnings.push(
      createWarning({
        code: "FALLBACK_PORTFOLIO_CURRENCY_USED",
        severity: "Info",
        message: "Portfolio currency was used as activity currency fallback.",
        debugMessage: "Raw activity currency was missing.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: "currency",
      })
    );
  }

  const quantityRead = readNumber(raw, "shares");
  const quantityFallback = quantityRead.value === null ? readNumber(raw, "quantity") : { value: null, failed: false };
  const quantity = quantityRead.value ?? quantityFallback.value;

  if (quantityRead.failed || quantityFallback.failed) {
    warnings.push(
      createWarning({
        code: "NUMERIC_PARSE_FAILED",
        severity: "Warning",
        message: "Quantity could not be parsed.",
        debugMessage: "Neither shares nor quantity could be parsed safely.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: quantityRead.failed ? "shares" : "quantity",
      })
    );
  }

  if (quantity === null) {
    warnings.push(
      createWarning({
        code: "MISSING_QUANTITY",
        severity: "Info",
        message: "Activity quantity is missing.",
        debugMessage: "Some activity types, such as dividends or fees, may not provide quantity.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: "shares",
      })
    );
  }

  const priceRead = readNumber(raw, "price");
  const priceFallback = priceRead.value === null ? readNumber(raw, "pricePerShare") : { value: null, failed: false };
  const priceValue = priceRead.value ?? priceFallback.value;

  if (priceRead.failed || priceFallback.failed) {
    warnings.push(
      createWarning({
        code: "NUMERIC_PARSE_FAILED",
        severity: "Warning",
        message: "Price could not be parsed.",
        debugMessage: "Neither price nor pricePerShare could be parsed safely.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: priceRead.failed ? "price" : "pricePerShare",
      })
    );
  }

  if (priceValue === null) {
    warnings.push(
      createWarning({
        code: "MISSING_PRICE",
        severity: "Info",
        message: "Activity price is missing.",
        debugMessage: "Some activity types may not provide a price per share.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: "price",
      })
    );
  }

  const pricePerShare = priceValue !== null && activityCurrency
    ? { amount: priceValue, currency: activityCurrency }
    : null;

  if (priceValue !== null && !activityCurrency) {
    warnings.push(
      createWarning({
        code: "MONEY_FIELD_WITHOUT_CURRENCY",
        severity: "Warning",
        message: "Price has a value but no currency.",
        debugMessage: "pricePerShare could not be mapped because no currency was available.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: "price",
      })
    );
  }

  const context = { portfolioId: input.portfolioId, activityId: sourceActivityId };
  const amount = readMoney(raw, "amount", activityCurrency, warnings, context);
  const amountNet = readMoney(raw, "amountNet", activityCurrency, warnings, context);
  const fee = readMoney(raw, "fee", activityCurrency, warnings, context);
  const tax = readMoney(raw, "tax", activityCurrency, warnings, context);
  const buyAmountNet = readMoney(raw, "buyAmountNet", activityCurrency, warnings, context);
  const realizedGains = readMoney(raw, "realizedGains", activityCurrency, warnings, context);
  const realizedGainsNet = readMoney(raw, "realizedGainsNet", activityCurrency, warnings, context);
  const avgHoldingPeriodDaysRead = readNumber(raw, "avgHoldingPeriod");

  if (avgHoldingPeriodDaysRead.failed) {
    warnings.push(
      createWarning({
        code: "NUMERIC_PARSE_FAILED",
        severity: "Warning",
        message: "Average holding period could not be parsed.",
        debugMessage: "avgHoldingPeriod could not be parsed as number.",
        portfolioId: input.portfolioId,
        activityId: sourceActivityId,
        fieldPath: "avgHoldingPeriod",
      })
    );
  }

  const hasReferenceFields = Boolean(
    realizedGains || realizedGainsNet || buyAmountNet || avgHoldingPeriodDaysRead.value !== null
  );

  const parqetReference: ParqetReferenceFields | null = hasReferenceFields
    ? {
        realizedGains,
        realizedGainsNet,
        buyAmountNet,
        avgHoldingPeriodDays: avgHoldingPeriodDaysRead.value,
      }
    : null;

  const internalActivityId = sourceActivityId
    ? `source:${sourceActivityId}`
    : buildFallbackId({
        portfolioId: input.portfolioId,
        datetime,
        sourceType,
        isin,
        amount: amount?.amount ?? null,
        quantity,
        index: options?.index,
      });

  const sortKey = `${datetime ?? "unknown-date"}|${internalActivityId}`;

  const activity: NormalizedActivity = {
    ids: {
      sourceActivityId,
      internalActivityId,
    },
    activityType,
    sourceType,
    datetime,
    date: normalizedDate,
    sortKey,
    assetIdentity: {
      assetKey,
      isin,
      assetIdentifierType: readAssetIdentifierType(raw),
      holdingId,
      holdingAssetType: readString(raw, "holdingAssetType"),
    },
    portfolioContext: {
      portfolioId: input.portfolioId,
      portfolioName: input.portfolioName ?? null,
      portfolioCurrency: input.portfolioCurrency ?? null,
    },
    quantity,
    pricePerShare,
    activityCurrency,
    amounts: {
      amount,
      amountNet,
      fee,
      tax,
      buyAmountNet,
    },
    parqetReference,
  };

  return {
    activity,
    warnings,
  };
}

export function normalizeActivities(
  inputs: ParqetActivityWithPortfolioContext[]
): ActivitiesNormalizationResult {
  const results = inputs.map((input, index) => normalizeActivity(input, { index }));
  const activities = results.flatMap((result) => (result.activity ? [result.activity] : []));
  const warnings = results.flatMap((result) => result.warnings);
  const internalIdCounts = new Map<string, number>();

  for (const activity of activities) {
    internalIdCounts.set(activity.ids.internalActivityId, (internalIdCounts.get(activity.ids.internalActivityId) ?? 0) + 1);
  }

  let duplicateInternalIdCount = 0;

  for (const [internalActivityId, count] of internalIdCounts.entries()) {
    if (count <= 1) {
      continue;
    }

    duplicateInternalIdCount += 1;
    warnings.push(
      createWarning({
        code: "DUPLICATE_INTERNAL_ACTIVITY_ID",
        severity: "Warning",
        message: "Duplicate internal activity id detected.",
        debugMessage: "Internal activity ids should be unique before aggregation.",
        activityId: internalActivityId,
      })
    );
  }

  return {
    activities,
    results,
    warnings,
    summary: {
      inputCount: inputs.length,
      normalizedCount: activities.length,
      rejectedCount: results.filter((result) => result.activity === null).length,
      warningCount: warnings.length,
      blockerCount: warnings.filter((warning) => warning.severity === "Blocker").length,
      duplicateInternalIdCount,
    },
  };
}
