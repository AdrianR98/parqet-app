type PositionMetricInput = {
  netShares: number;
  remainingCostBasis: number;
  latestTradePrice: number | null;
  marketPrice: number | null;
};

export type PositionMetricOutput = {
  avgBuyPrice: number | null;
  effectivePrice: number | null;
  positionValue: number | null;
  unrealizedPnL: number | null;
};

export type PositionRoundingOptions = {
  shareTolerance?: number;
  moneyTolerance?: number;
};

export const DEFAULT_SHARE_TOLERANCE = 1e-7;
export const DEFAULT_MONEY_TOLERANCE = 0.01;

export function incrementTotalBoughtShares(current: number, shares: number): number {
  return current + shares;
}

export function incrementTotalSoldShares(current: number, shares: number): number {
  return current + shares;
}

export function calculateNetShares(input: {
  totalBoughtShares: number;
  totalSoldShares: number;
  transferInShares?: number;
  transferOutShares?: number;
}): number {
  return (
    input.totalBoughtShares -
    input.totalSoldShares +
    (input.transferInShares ?? 0) -
    (input.transferOutShares ?? 0)
  );
}

export function updateLatestTradePrice(
  current: number | null,
  candidate: number,
): number | null {
  return candidate > 0 ? candidate : current;
}

export function calculateRemovedCostBasis(input: {
  netShares: number;
  remainingCostBasis: number;
  sharesToRemove: number;
}): number {
  const avgBuyPrice =
    input.netShares > 0 ? input.remainingCostBasis / input.netShares : 0;
  return avgBuyPrice * input.sharesToRemove;
}

export function applyBuyPositionDelta(
  current: Pick<PositionMetricInput, "netShares" | "remainingCostBasis">,
  input: { shares: number; amount: number },
): { netShares: number; remainingCostBasis: number } {
  return {
    netShares: current.netShares + input.shares,
    remainingCostBasis: current.remainingCostBasis + input.amount,
  };
}

export function applyTransferInPositionDelta(
  current: Pick<PositionMetricInput, "netShares" | "remainingCostBasis">,
  input: { shares: number },
): { netShares: number; remainingCostBasis: number } {
  return {
    netShares: current.netShares + input.shares,
    remainingCostBasis: current.remainingCostBasis,
  };
}

export function applySellLikePositionDelta(
  current: Pick<PositionMetricInput, "netShares" | "remainingCostBasis">,
  input: { shares: number },
): { netShares: number; remainingCostBasis: number; removedCostBasis: number } {
  const removedCostBasis = calculateRemovedCostBasis({
    netShares: current.netShares,
    remainingCostBasis: current.remainingCostBasis,
    sharesToRemove: input.shares,
  });

  return {
    netShares: current.netShares - input.shares,
    remainingCostBasis: current.remainingCostBasis - removedCostBasis,
    removedCostBasis,
  };
}

export function calculateAvgBuyPrice(
  netShares: number,
  remainingCostBasis: number,
): number | null {
  return netShares > 0 ? remainingCostBasis / netShares : null;
}

export function selectEffectivePrice(
  marketPrice: number | null,
  latestTradePrice: number | null,
): number | null {
  return marketPrice ?? latestTradePrice;
}

export function calculatePositionValue(input: {
  netShares: number;
  marketPrice: number | null;
  latestTradePrice: number | null;
}): number | null {
  const effectivePrice = selectEffectivePrice(
    input.marketPrice,
    input.latestTradePrice,
  );
  return effectivePrice !== null ? input.netShares * effectivePrice : null;
}

export function calculateUnrealizedPnL(input: {
  positionValue: number | null;
  remainingCostBasis: number;
}): number | null {
  return input.positionValue !== null
    ? input.positionValue - input.remainingCostBasis
    : null;
}

export function calculatePositionMetrics(
  input: PositionMetricInput,
): PositionMetricOutput {
  const avgBuyPrice = calculateAvgBuyPrice(
    input.netShares,
    input.remainingCostBasis,
  );
  const effectivePrice = selectEffectivePrice(
    input.marketPrice,
    input.latestTradePrice,
  );
  const positionValue =
    effectivePrice !== null ? input.netShares * effectivePrice : null;
  const unrealizedPnL =
    positionValue !== null ? positionValue - input.remainingCostBasis : null;

  return {
    avgBuyPrice,
    effectivePrice,
    positionValue,
    unrealizedPnL,
  };
}

export function sumDividendNet(input: {
  currentTotalDividendNet: number;
  amount: number;
  amountNet: number;
}): number {
  return input.currentTotalDividendNet + (input.amountNet || input.amount);
}

export function normalizePositionRounding(
  input: { netShares: number; remainingCostBasis: number },
  options: PositionRoundingOptions = {},
): { netShares: number; remainingCostBasis: number } {
  const shareTolerance = options.shareTolerance ?? DEFAULT_SHARE_TOLERANCE;
  const moneyTolerance = options.moneyTolerance ?? DEFAULT_MONEY_TOLERANCE;

  const netShares =
    input.netShares < 0 && Math.abs(input.netShares) < shareTolerance
      ? 0
      : input.netShares;
  const remainingCostBasis =
    input.remainingCostBasis < 0 &&
    Math.abs(input.remainingCostBasis) < moneyTolerance
      ? 0
      : input.remainingCostBasis;

  return {
    netShares,
    remainingCostBasis,
  };
}

