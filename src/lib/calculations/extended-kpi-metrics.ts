export type ExtendedKpiMetricStatus = "ready" | "partial" | "blocked" | "missing";

export type ExtendedKpiMoneyMetric = {
  amount: number | null;
  currency: string | null;
  status: ExtendedKpiMetricStatus;
  note: string | null;
  unconvertedCurrencies?: string[] | null;
};

export type ExtendedKpiRatioMetric = {
  value: number | null;
  status: ExtendedKpiMetricStatus;
  note: string | null;
};

export type ExtendedKpiPayoutFrequency =
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "irregular"
  | "none"
  | "unknown";

export type ExtendedKpiPayoutFrequencyMetric = {
  value: ExtendedKpiPayoutFrequency;
  status: ExtendedKpiMetricStatus;
  note: string | null;
};

export type ExtendedKpiMarketPriceFreshnessState =
  | "fresh"
  | "stale"
  | "fallback"
  | "missing"
  | "unknown";

export type ExtendedKpiMarketPriceFreshnessMetric = {
  state: ExtendedKpiMarketPriceFreshnessState;
  ageDays: number | null;
  sourceKind: string | null;
  status: ExtendedKpiMetricStatus;
};

export type ExtendedKpiActivityInput = {
  activityType: string;
  amount?: {
    amount: number | null;
    currency: string | null;
  } | null;
  amountNet?: {
    amount: number | null;
    currency: string | null;
  } | null;
  date?: string | null;
  datetime?: string | null;
};

export type ExtendedKpiAssetStructureInput = {
  positionValue: {
    amount: number | null;
    currency: string | null;
  } | null;
  assetType: string | null;
};

export type ExtendedKpiAllocationBucket = {
  key: string;
  label: string;
  assetCount: number;
  positionValue: ExtendedKpiMoneyMetric;
  weight: number | null;
};

export type ExtendedKpiAllocationByAssetTypeMetric = {
  status: ExtendedKpiMetricStatus;
  currency: string | null;
  note: string | null;
  buckets: ExtendedKpiAllocationBucket[];
};

export type ExtendedKpiAssetQualityInput = {
  displayName?: string | null;
  name?: string | null;
  isin?: string | null;
  wkn?: string | null;
  assetType?: string | null;
  currency?: string | null;
  symbol?: string | null;
  primarySymbol?: string | null;
};

export type ExtendedKpiConfidenceInput = {
  valuationSourceKind: string | null;
  freshnessState: string | null;
  metadataCompletenessScore: number;
  warningCount: number;
};

export type ExtendedKpiPortfolioConfidenceInput = {
  assetCount: number;
  marketDataAssetCount: number;
  staleAssetCount: number;
  fallbackAssetCount: number;
  missingPriceAssetCount: number;
  averageMetadataCompletenessScore: number;
  warningCount: number;
};

export type ExtendedKpiAnnualizedDividendIncomeInput = {
  activities: ExtendedKpiActivityInput[];
  fallbackCurrency?: string | null;
};

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized === "0") {
    return null;
  }

  return normalized;
}

function normalizeCurrency(value: string | null | undefined): string | null {
  return normalizeText(value)?.toUpperCase() ?? null;
}

function normalizeAssetType(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return normalized;
}

function isMeaningfulDisplayName(input: {
  displayName?: string | null;
  name?: string | null;
  isin?: string | null;
  wkn?: string | null;
  symbol?: string | null;
  primarySymbol?: string | null;
}): boolean {
  const candidate = normalizeText(input.displayName) ?? normalizeText(input.name);

  if (!candidate) {
    return false;
  }

  const upperCandidate = candidate.toUpperCase();
  const disallowed = new Set(
    [
      input.isin,
      input.wkn,
      input.symbol,
      input.primarySymbol,
      "STAMMDATEN FEHLEN",
      "UNKNOWN ASSET",
    ]
      .map((value) => normalizeText(value)?.toUpperCase() ?? null)
      .filter((value): value is string => Boolean(value)),
  );

  return !disallowed.has(upperCandidate);
}

function toUniqueCurrencies(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => normalizeCurrency(value)).filter((value): value is string => Boolean(value))),
  );
}

function resolveGrossAmount(activity: ExtendedKpiActivityInput): {
  amount: number | null;
  currency: string | null;
} | null {
  const grossAmount = activity.amount?.amount ?? activity.amountNet?.amount ?? null;
  const currency = normalizeCurrency(activity.amount?.currency ?? activity.amountNet?.currency ?? null);

  if (grossAmount == null || currency == null) {
    return null;
  }

  return {
    amount: grossAmount,
    currency,
  };
}

function toDateCandidate(activity: ExtendedKpiActivityInput): string | null {
  return normalizeText(activity.datetime) ?? normalizeText(activity.date);
}

function toTimestampCandidate(activity: ExtendedKpiActivityInput): number | null {
  const candidate = toDateCandidate(activity);
  if (!candidate) {
    return null;
  }

  const timestamp = new Date(candidate).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function resolveDividendAmount(activity: ExtendedKpiActivityInput): {
  amount: number | null;
  currency: string | null;
} | null {
  const amount = activity.amountNet?.amount ?? activity.amount?.amount ?? null;
  const currency = normalizeCurrency(activity.amountNet?.currency ?? activity.amount?.currency ?? null);

  if (amount == null) {
    return null;
  }

  return {
    amount,
    currency,
  };
}

function getObservedIntervalsDays(timestamps: number[]): number[] {
  const sorted = [...timestamps].sort((left, right) => left - right);
  const intervals: number[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const intervalDays = Math.round((sorted[index] - sorted[index - 1]) / (24 * 60 * 60 * 1000));
    if (intervalDays > 0) {
      intervals.push(intervalDays);
    }
  }

  return intervals;
}

function inferPayoutFrequencyFromIntervals(intervalsDays: number[]): ExtendedKpiPayoutFrequency {
  if (intervalsDays.length === 0) {
    return "unknown";
  }

  const every = (minDays: number, maxDays: number): boolean =>
    intervalsDays.every((interval) => interval >= minDays && interval <= maxDays);

  if (every(20, 40)) {
    return "monthly";
  }

  if (every(70, 110)) {
    return "quarterly";
  }

  if (every(150, 220)) {
    return "semiannual";
  }

  if (every(300, 430)) {
    return "annual";
  }

  return "irregular";
}

function payoutsPerYear(frequency: ExtendedKpiPayoutFrequency): number | null {
  switch (frequency) {
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "semiannual":
      return 2;
    case "annual":
      return 1;
    default:
      return null;
  }
}

export function buildExtendedKpiMoneyMetric(input: {
  values: Array<{ amount: number | null; currency: string | null } | null | undefined>;
  mixedCurrencyNote?: string;
  missingNote?: string;
}): ExtendedKpiMoneyMetric {
  const presentValues = input.values.filter(
    (value): value is { amount: number; currency: string } =>
      value?.amount != null && normalizeCurrency(value.currency) != null,
  );

  if (presentValues.length === 0) {
    return {
      amount: null,
      currency: null,
      status: "missing",
      note: input.missingNote ?? null,
      unconvertedCurrencies: null,
    };
  }

  const currencies = toUniqueCurrencies(presentValues.map((value) => value.currency));

  if (currencies.length !== 1) {
    return {
      amount: null,
      currency: null,
      status: "partial",
      note: input.mixedCurrencyNote ?? "mixed_currency_unconverted",
      unconvertedCurrencies: currencies,
    };
  }

  return {
    amount: presentValues.reduce((sum, value) => sum + value.amount, 0),
    currency: currencies[0],
    status: "ready",
    note: null,
    unconvertedCurrencies: null,
  };
}

export function calculateActivityKpis(activities: ExtendedKpiActivityInput[]): {
  grossBuyVolume: ExtendedKpiMoneyMetric;
  grossSellVolume: ExtendedKpiMoneyMetric;
  buyCount: number;
  sellCount: number;
} {
  const buyActivities = activities.filter((activity) => activity.activityType === "buy");
  const sellActivities = activities.filter((activity) => activity.activityType === "sell");

  return {
    grossBuyVolume: buildExtendedKpiMoneyMetric({
      values: buyActivities.map(resolveGrossAmount),
      mixedCurrencyNote: "gross_buy_volume_unconverted_mixed_currencies",
      missingNote: "gross_buy_volume_missing",
    }),
    grossSellVolume: buildExtendedKpiMoneyMetric({
      values: sellActivities.map(resolveGrossAmount),
      mixedCurrencyNote: "gross_sell_volume_unconverted_mixed_currencies",
      missingNote: "gross_sell_volume_missing",
    }),
    buyCount: buyActivities.length,
    sellCount: sellActivities.length,
  };
}

export function calculateDividendKpis(activities: ExtendedKpiActivityInput[]): {
  dividendCount: number;
  lastDividendDate: string | null;
} {
  const dividendActivities = activities.filter((activity) => activity.activityType === "dividend");
  const dividendDates = dividendActivities
    .map(toDateCandidate)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right));

  return {
    dividendCount: dividendActivities.length,
    lastDividendDate: dividendDates.at(-1) ?? null,
  };
}

export function calculatePayoutFrequency(
  activities: ExtendedKpiActivityInput[],
): ExtendedKpiPayoutFrequencyMetric {
  const dividendActivities = activities.filter((activity) => activity.activityType === "dividend");

  if (dividendActivities.length === 0) {
    return {
      value: "none",
      status: "ready",
      note: "no_dividend_history_observed",
    };
  }

  const timestamps = dividendActivities
    .map(toTimestampCandidate)
    .filter((value): value is number => value != null);

  if (timestamps.length === 0) {
    return {
      value: "unknown",
      status: "partial",
      note: "dividend_dates_missing",
    };
  }

  if (timestamps.length === 1) {
    return {
      value: "unknown",
      status: "partial",
      note: "insufficient_dividend_cadence_history",
    };
  }

  const intervalsDays = getObservedIntervalsDays(timestamps);
  const frequency = inferPayoutFrequencyFromIntervals(intervalsDays);

  return {
    value: frequency,
    status: "ready",
    note: frequency === "irregular" ? "observed_irregular_dividend_cadence" : null,
  };
}

export function calculateAnnualizedDividendIncome(
  input: ExtendedKpiAnnualizedDividendIncomeInput,
): ExtendedKpiMoneyMetric {
  const dividendActivities = input.activities.filter((activity) => activity.activityType === "dividend");
  const fallbackCurrency = normalizeCurrency(input.fallbackCurrency ?? null);

  if (dividendActivities.length === 0) {
    return {
      amount: 0,
      currency: fallbackCurrency,
      status: "ready",
      note: "no_dividend_history_observed",
      unconvertedCurrencies: null,
    };
  }

  const dividendAmounts = dividendActivities
    .map(resolveDividendAmount)
    .filter((value): value is { amount: number; currency: string | null } => value?.amount != null);
  const amountCurrencies = toUniqueCurrencies(dividendAmounts.map((value) => value.currency));

  if (amountCurrencies.length > 1) {
    return {
      amount: null,
      currency: null,
      status: "partial",
      note: "annualized_dividend_income_unconverted_mixed_currencies",
      unconvertedCurrencies: amountCurrencies,
    };
  }

  const payoutFrequency = calculatePayoutFrequency(dividendActivities);
  const resolvedCurrency = amountCurrencies[0] ?? fallbackCurrency ?? null;

  if (dividendAmounts.length === 0) {
    return {
      amount: null,
      currency: resolvedCurrency,
      status: "partial",
      note: "dividend_amounts_missing",
      unconvertedCurrencies: null,
    };
  }

  if (payoutFrequency.value === "none") {
    return {
      amount: 0,
      currency: resolvedCurrency,
      status: "ready",
      note: "no_dividend_history_observed",
      unconvertedCurrencies: null,
    };
  }

  const cadencePayoutsPerYear = payoutsPerYear(payoutFrequency.value);
  if (cadencePayoutsPerYear != null) {
    const averageDividendAmount =
      dividendAmounts.reduce((sum, value) => sum + value.amount, 0) / dividendAmounts.length;

    return {
      amount: averageDividendAmount * cadencePayoutsPerYear,
      currency: resolvedCurrency,
      status: payoutFrequency.status === "ready" ? "ready" : "partial",
      note: payoutFrequency.note,
      unconvertedCurrencies: null,
    };
  }

  if (payoutFrequency.value === "unknown") {
    const latestDividendAmount = dividendAmounts.at(-1)?.amount ?? 0;

    return {
      amount: latestDividendAmount,
      currency: resolvedCurrency,
      status: "partial",
      note: "insufficient_dividend_cadence_history",
      unconvertedCurrencies: null,
    };
  }

  return {
    amount: dividendAmounts.reduce((sum, value) => sum + value.amount, 0),
    currency: resolvedCurrency,
    status: "partial",
    note: "observed_irregular_dividend_cadence",
    unconvertedCurrencies: null,
  };
}

export function calculateRatioFromMoney(input: {
  numeratorAmount: number | null;
  numeratorCurrency: string | null;
  numeratorStatus?: ExtendedKpiMetricStatus;
  denominatorAmount: number | null;
  denominatorCurrency: string | null;
  missingDenominatorNote: string;
  missingNumeratorNote: string;
  unknownCurrencyNote: string;
  mismatchedCurrencyNote: string;
  partialNote?: string | null;
}): ExtendedKpiRatioMetric {
  const numeratorStatus = input.numeratorStatus ?? "ready";
  const numeratorCurrency = normalizeCurrency(input.numeratorCurrency);
  const denominatorCurrency = normalizeCurrency(input.denominatorCurrency);

  if (input.denominatorAmount == null || input.denominatorAmount <= 0) {
    return {
      value: null,
      status: "missing",
      note: input.missingDenominatorNote,
    };
  }

  if (input.numeratorAmount == null) {
    return {
      value: null,
      status: numeratorStatus === "partial" ? "partial" : "missing",
      note: numeratorStatus === "partial" ? (input.partialNote ?? input.missingNumeratorNote) : input.missingNumeratorNote,
    };
  }

  if (!numeratorCurrency || !denominatorCurrency) {
    return {
      value: null,
      status: "partial",
      note: input.unknownCurrencyNote,
    };
  }

  if (numeratorCurrency !== denominatorCurrency) {
    return {
      value: null,
      status: "partial",
      note: input.mismatchedCurrencyNote,
    };
  }

  return {
    value: input.numeratorAmount / input.denominatorAmount,
    status: numeratorStatus === "ready" ? "ready" : "partial",
    note: numeratorStatus === "ready" ? null : input.partialNote ?? null,
  };
}

export function calculatePortfolioWeight(input: {
  assetPositionValue: { amount: number | null; currency: string | null } | null;
  portfolioValue: { amount: number | null; currency: string | null } | null;
}): ExtendedKpiRatioMetric {
  const assetAmount = input.assetPositionValue?.amount ?? null;
  const portfolioAmount = input.portfolioValue?.amount ?? null;
  const assetCurrency = normalizeCurrency(input.assetPositionValue?.currency ?? null);
  const portfolioCurrency = normalizeCurrency(input.portfolioValue?.currency ?? null);

  if (assetAmount == null || portfolioAmount == null || portfolioAmount <= 0) {
    return {
      value: null,
      status: "missing",
      note: "portfolio_value_missing_or_non_positive",
    };
  }

  if (!portfolioCurrency) {
    return {
      value: null,
      status: "partial",
      note: "portfolio_weight_unconverted_mixed_or_unknown_currency",
    };
  }

  if (!assetCurrency) {
    return {
      value: null,
      status: "partial",
      note: "portfolio_weight_unconverted_mixed_or_unknown_currency",
    };
  }

  if (assetCurrency && portfolioCurrency && assetCurrency !== portfolioCurrency) {
    return {
      value: null,
      status: "partial",
      note: "portfolio_weight_unconverted_currency_mismatch",
    };
  }

  return {
    value: assetAmount / portfolioAmount,
    status: "ready",
    note: null,
  };
}

export function calculatePortfolioStructureKpis(input: {
  assets: ExtendedKpiAssetStructureInput[];
}): {
  top5Concentration: ExtendedKpiRatioMetric;
  top10Concentration: ExtendedKpiRatioMetric;
  herfindahlIndex: ExtendedKpiRatioMetric;
  allocationByAssetType: ExtendedKpiAllocationByAssetTypeMetric;
} {
  const activeValues = input.assets.filter(
    (asset) => (asset.positionValue?.amount ?? null) != null && (asset.positionValue?.amount ?? 0) > 0,
  );
  const currencies = toUniqueCurrencies(activeValues.map((asset) => asset.positionValue?.currency ?? null));

  if (activeValues.length === 0) {
    const missingRatio: ExtendedKpiRatioMetric = {
      value: null,
      status: "missing",
      note: "portfolio_value_missing",
    };

    return {
      top5Concentration: missingRatio,
      top10Concentration: missingRatio,
      herfindahlIndex: missingRatio,
      allocationByAssetType: {
        status: "missing",
        currency: null,
        note: "portfolio_value_missing",
        buckets: [],
      },
    };
  }

  if (currencies.length !== 1) {
    const partialRatio: ExtendedKpiRatioMetric = {
      value: null,
      status: "partial",
      note: "unconverted_mixed_currencies",
    };

    const bucketCounts = new Map<string, number>();
    for (const asset of activeValues) {
      const label = normalizeAssetType(asset.assetType) ?? "Unbekannt";
      bucketCounts.set(label, (bucketCounts.get(label) ?? 0) + 1);
    }

    return {
      top5Concentration: partialRatio,
      top10Concentration: partialRatio,
      herfindahlIndex: partialRatio,
      allocationByAssetType: {
        status: "partial",
        currency: null,
        note: "unconverted_mixed_currencies",
        buckets: Array.from(bucketCounts.entries()).map(([label, assetCount]) => ({
          key: label.toLowerCase(),
          label,
          assetCount,
          positionValue: {
            amount: null,
            currency: null,
            status: "partial",
            note: "unconverted_mixed_currencies",
            unconvertedCurrencies: currencies,
          },
          weight: null,
        })),
      },
    };
  }

  const currency = currencies[0];
  const sortedAmounts = activeValues
    .map((asset) => asset.positionValue?.amount ?? 0)
    .sort((left, right) => right - left);
  const portfolioValue = sortedAmounts.reduce((sum, amount) => sum + amount, 0);

  const toRatio = (amount: number): ExtendedKpiRatioMetric => ({
    value: portfolioValue > 0 ? amount / portfolioValue : null,
    status: portfolioValue > 0 ? "ready" : "missing",
    note: portfolioValue > 0 ? null : "portfolio_value_missing_or_non_positive",
  });

  const buckets = new Map<string, { label: string; assetCount: number; amount: number }>();
  for (const asset of activeValues) {
    const label = normalizeAssetType(asset.assetType) ?? "Unbekannt";
    const bucket = buckets.get(label) ?? { label, assetCount: 0, amount: 0 };
    bucket.assetCount += 1;
    bucket.amount += asset.positionValue?.amount ?? 0;
    buckets.set(label, bucket);
  }

  return {
    top5Concentration: toRatio(sortedAmounts.slice(0, 5).reduce((sum, amount) => sum + amount, 0)),
    top10Concentration: toRatio(sortedAmounts.slice(0, 10).reduce((sum, amount) => sum + amount, 0)),
    herfindahlIndex: {
      value:
        portfolioValue > 0
          ? sortedAmounts.reduce((sum, amount) => {
              const weight = amount / portfolioValue;
              return sum + weight * weight;
            }, 0)
          : null,
      status: portfolioValue > 0 ? "ready" : "missing",
      note: portfolioValue > 0 ? null : "portfolio_value_missing_or_non_positive",
    },
    allocationByAssetType: {
      status: "ready",
      currency,
      note: null,
      buckets: Array.from(buckets.values())
        .sort((left, right) => right.amount - left.amount)
        .map((bucket) => ({
          key: bucket.label.toLowerCase(),
          label: bucket.label,
          assetCount: bucket.assetCount,
          positionValue: {
            amount: bucket.amount,
            currency,
            status: "ready",
            note: null,
            unconvertedCurrencies: null,
          },
          weight: portfolioValue > 0 ? bucket.amount / portfolioValue : null,
        })),
    },
  };
}

export function calculateDividendYieldOnCost(input: {
  annualizedDividendIncome: ExtendedKpiMoneyMetric;
  remainingCostBasisAmount: number | null;
  remainingCostBasisCurrency: string | null;
}): ExtendedKpiRatioMetric {
  return calculateRatioFromMoney({
    numeratorAmount: input.annualizedDividendIncome.amount,
    numeratorCurrency: input.annualizedDividendIncome.currency,
    numeratorStatus: input.annualizedDividendIncome.status,
    denominatorAmount: input.remainingCostBasisAmount,
    denominatorCurrency: input.remainingCostBasisCurrency,
    missingDenominatorNote: "remaining_cost_basis_missing_or_non_positive",
    missingNumeratorNote: "annualized_dividend_income_missing",
    unknownCurrencyNote: "dividend_yield_on_cost_unknown_currency",
    mismatchedCurrencyNote: "dividend_yield_on_cost_currency_mismatch",
    partialNote:
      input.annualizedDividendIncome.status === "partial"
        ? input.annualizedDividendIncome.note ?? "annualized_dividend_income_partial"
        : null,
  });
}

export function calculateCurrentDividendYield(input: {
  annualizedDividendIncome: ExtendedKpiMoneyMetric;
  positionValueAmount: number | null;
  positionValueCurrency: string | null;
}): ExtendedKpiRatioMetric {
  return calculateRatioFromMoney({
    numeratorAmount: input.annualizedDividendIncome.amount,
    numeratorCurrency: input.annualizedDividendIncome.currency,
    numeratorStatus: input.annualizedDividendIncome.status,
    denominatorAmount: input.positionValueAmount,
    denominatorCurrency: input.positionValueCurrency,
    missingDenominatorNote: "position_value_missing_or_non_positive",
    missingNumeratorNote: "annualized_dividend_income_missing",
    unknownCurrencyNote: "current_dividend_yield_unknown_currency",
    mismatchedCurrencyNote: "current_dividend_yield_currency_mismatch",
    partialNote:
      input.annualizedDividendIncome.status === "partial"
        ? input.annualizedDividendIncome.note ?? "annualized_dividend_income_partial"
        : null,
  });
}

export function calculateIncomeReturn(input: {
  totalDividendNetAmount: number | null;
  totalDividendNetCurrency: string | null;
  remainingCostBasisAmount: number | null;
  remainingCostBasisCurrency: string | null;
}): ExtendedKpiRatioMetric {
  return calculateRatioFromMoney({
    numeratorAmount: input.totalDividendNetAmount,
    numeratorCurrency: input.totalDividendNetCurrency,
    numeratorStatus: "partial",
    denominatorAmount: input.remainingCostBasisAmount,
    denominatorCurrency: input.remainingCostBasisCurrency,
    missingDenominatorNote: "remaining_cost_basis_missing_or_non_positive",
    missingNumeratorNote: "dividend_income_missing",
    unknownCurrencyNote: "income_return_unknown_currency",
    mismatchedCurrencyNote: "income_return_currency_mismatch",
    partialNote: "income_return_denominator_semantics_not_final",
  });
}

export function calculatePriceReturnExcludingDividends(input: {
  unrealizedPnLAmount: number | null;
  unrealizedPnLCurrency: string | null;
  remainingCostBasisAmount: number | null;
  remainingCostBasisCurrency: string | null;
}): ExtendedKpiRatioMetric {
  return calculateRatioFromMoney({
    numeratorAmount: input.unrealizedPnLAmount,
    numeratorCurrency: input.unrealizedPnLCurrency,
    numeratorStatus: "ready",
    denominatorAmount: input.remainingCostBasisAmount,
    denominatorCurrency: input.remainingCostBasisCurrency,
    missingDenominatorNote: "remaining_cost_basis_missing_or_non_positive",
    missingNumeratorNote: "unrealized_pnl_missing",
    unknownCurrencyNote: "price_return_excluding_dividends_unknown_currency",
    mismatchedCurrencyNote: "price_return_excluding_dividends_currency_mismatch",
  });
}

export function calculateTotalReturnIncludingDividends(input: {
  unrealizedPnLAmount: number | null;
  unrealizedPnLCurrency: string | null;
  totalDividendNetAmount: number | null;
  totalDividendNetCurrency: string | null;
  remainingCostBasisAmount: number | null;
  remainingCostBasisCurrency: string | null;
}): ExtendedKpiRatioMetric {
  const unrealizedPnLCurrency = normalizeCurrency(input.unrealizedPnLCurrency);
  const dividendCurrency = normalizeCurrency(input.totalDividendNetCurrency);
  const denominatorCurrency = normalizeCurrency(input.remainingCostBasisCurrency);

  if (input.remainingCostBasisAmount == null || input.remainingCostBasisAmount <= 0) {
    return {
      value: null,
      status: "missing",
      note: "remaining_cost_basis_missing_or_non_positive",
    };
  }

  if (input.unrealizedPnLAmount == null) {
    return {
      value: null,
      status: "missing",
      note: "unrealized_pnl_missing",
    };
  }

  if (input.totalDividendNetAmount == null) {
    return {
      value: null,
      status: "missing",
      note: "dividend_income_missing",
    };
  }

  if (!unrealizedPnLCurrency || !dividendCurrency || !denominatorCurrency) {
    return {
      value: null,
      status: "partial",
      note: "total_return_including_dividends_unknown_currency",
    };
  }

  if (
    unrealizedPnLCurrency !== dividendCurrency ||
    unrealizedPnLCurrency !== denominatorCurrency
  ) {
    return {
      value: null,
      status: "partial",
      note: "total_return_including_dividends_currency_mismatch",
    };
  }

  return {
    value: (input.unrealizedPnLAmount + input.totalDividendNetAmount) / input.remainingCostBasisAmount,
    status: "ready",
    note: null,
  };
}

export function calculateMarketPriceFreshness(input: {
  priceDate: string | null;
  priceTimestamp: string | null;
  sourceKind: string | null;
  freshnessState: string | null;
  referenceNow?: number;
}): ExtendedKpiMarketPriceFreshnessMetric {
  const sourceKind = normalizeText(input.sourceKind);
  const freshnessState = normalizeText(input.freshnessState);

  if (sourceKind === "latest_trade_price_fallback") {
    return {
      state: "fallback",
      ageDays: null,
      sourceKind,
      status: "partial",
    };
  }

  if (sourceKind === "missing") {
    return {
      state: "missing",
      ageDays: null,
      sourceKind,
      status: "missing",
    };
  }

  const candidateDate = normalizeText(input.priceTimestamp) ?? normalizeText(input.priceDate);
  const referenceNow = input.referenceNow ?? Date.now();

  if (!candidateDate) {
    return {
      state: freshnessState === "stale" ? "stale" : "unknown",
      ageDays: null,
      sourceKind,
      status: freshnessState ? "partial" : "missing",
    };
  }

  const timestamp = new Date(candidateDate).getTime();
  if (Number.isNaN(timestamp)) {
    return {
      state: "unknown",
      ageDays: null,
      sourceKind,
      status: "partial",
    };
  }

  const ageDays = Math.max(0, Math.floor((referenceNow - timestamp) / (24 * 60 * 60 * 1000)));
  const state: ExtendedKpiMarketPriceFreshnessState =
    freshnessState === "fresh"
      ? "fresh"
      : freshnessState === "stale"
        ? "stale"
        : "unknown";

  return {
    state,
    ageDays,
    sourceKind,
    status: state === "unknown" ? "partial" : "ready",
  };
}

export function calculateMetadataCompletenessScore(
  input: ExtendedKpiAssetQualityInput,
): number {
  const checks = [
    isMeaningfulDisplayName(input),
    Boolean(normalizeText(input.wkn)),
    Boolean(normalizeAssetType(input.assetType)),
    Boolean(normalizeCurrency(input.currency)),
    Boolean(normalizeText(input.primarySymbol) ?? normalizeText(input.symbol)),
  ];
  const achieved = checks.filter(Boolean).length;
  return Math.round((achieved / checks.length) * 100);
}

export function calculateDataConfidenceScore(
  input: ExtendedKpiConfidenceInput,
): number {
  let priceScore = 20;

  if (input.valuationSourceKind === "market_data_db") {
    priceScore = input.freshnessState === "fresh"
      ? 100
      : input.freshnessState === "stale"
        ? 75
        : 70;
  } else if (input.valuationSourceKind === "latest_trade_price_fallback") {
    priceScore = 55;
  } else if (input.valuationSourceKind === "missing") {
    priceScore = 20;
  }

  const weightedScore = priceScore * 0.6 + input.metadataCompletenessScore * 0.4;
  const warningPenalty = Math.min(input.warningCount * 10, 40);

  return Math.max(0, Math.round(weightedScore - warningPenalty));
}

export function calculatePortfolioDataConfidenceScore(
  input: ExtendedKpiPortfolioConfidenceInput,
): number {
  if (input.assetCount <= 0) {
    return 0;
  }

  const marketCoverageScore =
    ((input.marketDataAssetCount * 100) +
      (input.fallbackAssetCount * 55) +
      (input.staleAssetCount * 75) +
      (input.missingPriceAssetCount * 20)) /
    input.assetCount;
  const weightedScore = marketCoverageScore * 0.6 + input.averageMetadataCompletenessScore * 0.4;
  const warningPenalty = Math.min(input.warningCount * 5, 40);

  return Math.max(0, Math.round(weightedScore - warningPenalty));
}
