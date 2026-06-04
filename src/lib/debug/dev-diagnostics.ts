type DevDiagnosticCategory = "valuation" | "scope" | "metadata" | "surface";

type AllowedDiagnosticValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | AllowedDiagnosticValue[]
  | { [key: string]: AllowedDiagnosticValue };

export type DevDiagnosticPayload = Record<string, AllowedDiagnosticValue>;

export type ValuationInvariantInput = {
  isin?: string | null;
  assetId?: string | null;
  assetLabel?: string | null;
  portfolioId?: string | null;
  portfolioName?: string | null;
  quantity?: number | null;
  marketPrice?: number | null;
  marketValue?: number | null;
  remainingCostBasis?: number | null;
  unrealizedPnL?: number | null;
  valuationSourceKind?: string | null;
  priceDate?: string | null;
  priceSource?: string | null;
};

export type ValuationInvariantResult = {
  checked: boolean;
  expectedMarketValue: number | null;
  diff: number | null;
  isConsistent: boolean;
};

const DEV_DIAGNOSTIC_PREFIX: Record<DevDiagnosticCategory, string> = {
  valuation: "[assettrace:valuation]",
  scope: "[assettrace:scope]",
  metadata: "[assettrace:metadata]",
  surface: "[assettrace:surface]",
};

const LOG_CAP_PER_KEY = 20;
const logCounts = new Map<string, number>();

function hasMeaningfulNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sanitizeDiagnosticValue(value: AllowedDiagnosticValue): AllowedDiagnosticValue {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeDiagnosticValue(entry));
  }

  const sanitizedEntries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .slice(0, 40)
    .map(([key, entry]) => [key, sanitizeDiagnosticValue(entry)]);

  return Object.fromEntries(sanitizedEntries);
}

function sanitizePayload(payload: DevDiagnosticPayload): DevDiagnosticPayload {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, sanitizeDiagnosticValue(value)]),
  );
}

function shouldEmitLog(category: DevDiagnosticCategory, stage: string): boolean {
  const key = `${category}:${stage}`;
  const nextCount = (logCounts.get(key) ?? 0) + 1;
  logCounts.set(key, nextCount);
  return nextCount <= LOG_CAP_PER_KEY;
}

export function isDevDiagnosticsEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function logDevDiagnostic(
  category: DevDiagnosticCategory,
  stage: string,
  payload: DevDiagnosticPayload,
  level: "info" | "warn" = "info",
): void {
  if (!isDevDiagnosticsEnabled()) {
    return;
  }

  if (!shouldEmitLog(category, stage)) {
    return;
  }

  const prefix = DEV_DIAGNOSTIC_PREFIX[category];
  const sanitized = sanitizePayload(payload);

  if (level === "warn") {
    console.warn(prefix, stage, sanitized);
    return;
  }

  console.info(prefix, stage, sanitized);
}

export function summarizeDiagnostics(
  stage: string,
  summary: DevDiagnosticPayload,
  category: DevDiagnosticCategory = "surface",
): void {
  logDevDiagnostic(category, `${stage}:summary`, summary, "info");
}

export function evaluateValuationInvariant(
  input: Pick<
    ValuationInvariantInput,
    "quantity" | "marketPrice" | "marketValue"
  >,
): ValuationInvariantResult {
  const quantity = input.quantity ?? null;
  const marketPrice = input.marketPrice ?? null;
  const marketValue = input.marketValue ?? null;

  if (
    !hasMeaningfulNumber(quantity) ||
    !hasMeaningfulNumber(marketPrice) ||
    !hasMeaningfulNumber(marketValue) ||
    quantity <= 0
  ) {
    return {
      checked: false,
      expectedMarketValue: null,
      diff: null,
      isConsistent: true,
    };
  }

  const expectedMarketValue = quantity * marketPrice;
  const diff = marketValue - expectedMarketValue;

  return {
    checked: true,
    expectedMarketValue,
    diff,
    isConsistent: Math.abs(diff) <= 0.05,
  };
}

export function logValuationInvariant(
  stage: string,
  payload: ValuationInvariantInput,
): ValuationInvariantResult {
  const result = evaluateValuationInvariant(payload);

  if (!result.checked || result.isConsistent) {
    return result;
  }

  logDevDiagnostic(
    "valuation",
    "invariant_failed",
    {
      stage,
      isin: payload.isin ?? null,
      assetId: payload.assetId ?? null,
      assetLabel: payload.assetLabel ?? null,
      portfolioId: payload.portfolioId ?? null,
      portfolioName: payload.portfolioName ?? null,
      quantity: payload.quantity ?? null,
      marketPrice: payload.marketPrice ?? null,
      marketValue: payload.marketValue ?? null,
      expectedMarketValue: result.expectedMarketValue,
      diff: result.diff,
      remainingCostBasis: payload.remainingCostBasis ?? null,
      unrealizedPnL: payload.unrealizedPnL ?? null,
      valuationSourceKind: payload.valuationSourceKind ?? null,
      priceDate: payload.priceDate ?? null,
      priceSource: payload.priceSource ?? null,
    },
    "warn",
  );

  return result;
}
