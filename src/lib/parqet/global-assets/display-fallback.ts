function normalizeWeakText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

function isMeaningfulPrmDisplayName(value: string | null | undefined, input: {
  isin: string;
  wkn?: string | null;
  symbol?: string | null;
  missingTitle: string;
}): boolean {
  const normalized = normalizeWeakText(value);
  if (!normalized) {
    return false;
  }

  const normalizedUpper = normalized.toUpperCase();
  const disallowed = new Set(
    [
      input.isin,
      input.wkn,
      input.symbol,
      input.missingTitle,
      "UNKNOWN ASSET",
    ]
      .map((candidate) => normalizeWeakText(candidate)?.toUpperCase() ?? null)
      .filter((candidate): candidate is string => Boolean(candidate)),
  );

  return !disallowed.has(normalizedUpper);
}

export function selectPrmDisplayNameForMetadataOverlay(input: {
  resolutionStatus: "ok" | "missing" | "db_unavailable" | "missing_name";
  instrumentDisplayName: string | null;
  existingDisplayName: string | null;
  symbol?: string | null;
  wkn?: string | null;
  isin: string;
  missingTitle?: string;
}): string {
  const missingTitle = input.missingTitle ?? "Stammdaten fehlen";

  if (input.resolutionStatus === "ok") {
    return input.instrumentDisplayName ?? input.existingDisplayName ?? input.symbol ?? input.wkn ?? input.isin;
  }

  if (isMeaningfulPrmDisplayName(input.existingDisplayName, {
    isin: input.isin,
    wkn: input.wkn,
    symbol: input.symbol,
    missingTitle,
  })) {
    return normalizeWeakText(input.existingDisplayName) ?? missingTitle;
  }

  return (
    normalizeWeakText(input.symbol) ??
    normalizeWeakText(input.wkn) ??
    normalizeWeakText(input.isin) ??
    missingTitle
  );
}
