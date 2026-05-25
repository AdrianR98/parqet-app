export const LOCAL_STORAGE_LIMITS = {
  maxRawPayloadChars: 4_500_000,
  maxAssets: 2_000,
  maxActivities: 20_000,
  maxWarnings: 2_000,
  maxPortfolioBreakdownRowsPerAsset: 100,
  maxPortfolioIds: 2_000,
  maxKnownPortfolios: 2_000,
  maxDisplayTextChars: 240,
  maxPortfolioNameChars: 160,
  maxIdLikeChars: 64,
  maxWarningMessageChars: 1_000,
  maxWarningCodeChars: 64,
  maxWarningListItems: 50,
  maxLogoUrlChars: 1_000,
} as const;

export function safeTrimmedString(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

export function safeStringArray(
  value: unknown,
  maxItems: number,
  maxStringLength: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];

  for (const item of value) {
    if (result.length >= maxItems) {
      break;
    }

    const next = safeTrimmedString(item, maxStringLength);
    if (next !== undefined && next.length > 0) {
      result.push(next);
    }
  }

  return result;
}

export function safeNonNegativeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

export function safeFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function safeNullableFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function safeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseJsonWithLimit(
  raw: string,
  maxRawChars: number,
): { value: unknown; oversized: boolean } | null {
  if (raw.length > maxRawChars) {
    return { value: null, oversized: true };
  }

  try {
    return { value: JSON.parse(raw) as unknown, oversized: false };
  } catch {
    return null;
  }
}
