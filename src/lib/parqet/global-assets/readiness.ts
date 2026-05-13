export type SnapshotFreshnessState = "fresh" | "stale" | "missing" | "unknown";
export type ScopeReadinessState = "covered" | "missing" | "unknown";
export type PriceSourceReadinessState = "available" | "missing" | "provider_reference" | "unknown";

export type SnapshotFreshnessInput = {
  snapshotAt: string | Date | null | undefined;
  now: string | Date;
  staleAfterMs: number;
};

export type ScopeReadinessInput = {
  selectedPortfolioIds?: string[] | null;
  snapshotPortfolioIds?: string[] | null;
};

export type PriceSourceReadinessInput = {
  priceSource?: string | null;
  valueClassification?: string | null;
};

function toTimestamp(value: string | Date): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeIds(value: string[] | null | undefined): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((id) => id.trim()).filter((id) => id.length > 0);
}

export function classifySnapshotFreshness(input: SnapshotFreshnessInput): SnapshotFreshnessState {
  if (!Number.isFinite(input.staleAfterMs) || input.staleAfterMs < 0) {
    return "unknown";
  }

  if (input.snapshotAt === null || input.snapshotAt === undefined) {
    return "missing";
  }

  const snapshotAt = toTimestamp(input.snapshotAt);
  const now = toTimestamp(input.now);

  if (snapshotAt === null || now === null) {
    return "unknown";
  }

  return now - snapshotAt > input.staleAfterMs ? "stale" : "fresh";
}

export function classifyScopeReadiness(input: ScopeReadinessInput): ScopeReadinessState {
  const selectedIds = normalizeIds(input.selectedPortfolioIds);
  const snapshotIds = normalizeIds(input.snapshotPortfolioIds);

  if (!selectedIds || selectedIds.length === 0 || !snapshotIds) {
    return "unknown";
  }

  if (snapshotIds.length === 0) {
    return "missing";
  }

  const coveredSnapshotIds = new Set(snapshotIds);
  return selectedIds.every((id) => coveredSnapshotIds.has(id)) ? "covered" : "missing";
}

export function classifyPriceSourceReadiness(
  input: PriceSourceReadinessInput
): PriceSourceReadinessState {
  if (input.valueClassification === "provider_reference") {
    return "provider_reference";
  }

  if (input.valueClassification && input.valueClassification !== "none") {
    return "available";
  }

  if (input.priceSource === null || input.priceSource === undefined || input.priceSource.trim() === "") {
    return "missing";
  }

  if (input.priceSource === "none") {
    return "missing";
  }

  return "available";
}
