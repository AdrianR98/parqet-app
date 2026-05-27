import type { GlobalAssetViewModel } from "../types";

export const DEFAULT_CLOSED_POSITION_EPSILON = 1e-8;

export type ScopedAssetAggregation = {
  portfolioBreakdown: GlobalAssetViewModel["portfolioBreakdown"];
  portfolioIds: string[];
  portfolioNames: string[];
  netShares: number;
  remainingCostBasis: number;
  avgBuyPrice: number | null;
  positionValue: number | null;
  unrealizedPnL: number | null;
  totalDividendNet: number;
  latestTradePrice: number | null;
  marketPrice: number | null;
};

export type AssetValueTotals = {
  totalPositionValue: number;
  totalUnrealizedPnL: number;
  totalDividendNet: number;
  hasPositionValues: boolean;
  hasUnrealizedPnLValues: boolean;
};

export type SplitAssetsByPositionResult = {
  activeAssets: GlobalAssetViewModel[];
  closedAssets: GlobalAssetViewModel[];
};

export type PortfolioBreakdownAggregate = {
  portfolioName: string;
  activeAssets: number;
  closedAssets: number;
  positionValue: number;
  unrealizedPnL: number;
  totalDividendNet: number;
};

export type AllocationSegment = {
  label: string;
  value: number;
  color: string;
};

export type PortfolioBreakdownDisplayEntry = {
  entry: GlobalAssetViewModel["portfolioBreakdown"][number];
  hasDisplayableShares: boolean;
  hasDisplayableValue: boolean;
  sharePercent: number | null;
};

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isDisplayableMagnitude(value: number, epsilon: number): boolean {
  return Number.isFinite(value) && Math.abs(value) >= epsilon;
}

export function calculateAllocationRatioPercent(input: {
  value: number | null | undefined;
  total: number | null | undefined;
}): number {
  const value = input.value ?? 0;
  const total = input.total ?? 0;

  if (total <= 0) {
    return 0;
  }

  return (value / total) * 100;
}

export function buildPortfolioBreakdownDisplayEntries(
  entries: GlobalAssetViewModel["portfolioBreakdown"],
  options: {
    shareEpsilon: number;
    valueEpsilon: number;
  },
): PortfolioBreakdownDisplayEntry[] {
  const totalShares = entries.reduce((sum, entry) => {
    const shares = Number(entry.netShares);

    if (!isDisplayableMagnitude(shares, options.shareEpsilon) || shares <= 0) {
      return sum;
    }

    return sum + shares;
  }, 0);

  return entries.map((entry) => {
    const shares = Number(entry.netShares);
    const value = Number(entry.positionValue);
    const hasDisplayableShares = isDisplayableMagnitude(
      shares,
      options.shareEpsilon,
    );
    const hasDisplayableValue = isDisplayableMagnitude(
      value,
      options.valueEpsilon,
    );
    const sharePercent =
      hasDisplayableShares &&
      shares > 0 &&
      Number.isFinite(totalShares) &&
      totalShares > 0
        ? (shares / totalShares) * 100
        : null;

    return {
      entry,
      hasDisplayableShares,
      hasDisplayableValue,
      sharePercent,
    };
  });
}

export function buildAllocationSegmentsFromAssets(
  assets: GlobalAssetViewModel[],
  options: {
    maxIndividualSegments: number;
    palette: readonly string[];
    otherColor: string;
    getLabel: (asset: GlobalAssetViewModel) => string;
  },
): AllocationSegment[] {
  const validAssets = assets
    .map((asset) => ({
      label: options.getLabel(asset),
      value: asset.positionValue ?? 0,
    }))
    .filter((asset) => asset.value > 0)
    .sort((left, right) => right.value - left.value);

  if (validAssets.length === 0) {
    return [];
  }

  const topAssets = validAssets.slice(0, options.maxIndividualSegments);
  const remainder = validAssets
    .slice(options.maxIndividualSegments)
    .reduce((sum, asset) => sum + asset.value, 0);
  const segments: AllocationSegment[] = topAssets.map((asset, index) => ({
    label: asset.label,
    value: asset.value,
    color:
      options.palette[index] ??
      options.palette[options.palette.length - 1] ??
      options.otherColor,
  }));

  if (remainder > 0) {
    segments.push({
      label: "Weitere",
      value: remainder,
      color: options.otherColor,
    });
  }

  return segments;
}

export function splitAssetsByPosition(
  assets: GlobalAssetViewModel[],
  closedPositionEpsilon: number = DEFAULT_CLOSED_POSITION_EPSILON,
): SplitAssetsByPositionResult {
  return {
    activeAssets: assets.filter((asset) => asset.netShares > closedPositionEpsilon),
    closedAssets: assets.filter((asset) => asset.netShares <= closedPositionEpsilon),
  };
}

export function aggregateAssetValueTotals(
  assets: Pick<
    GlobalAssetViewModel,
    "positionValue" | "unrealizedPnL" | "totalDividendNet"
  >[],
): AssetValueTotals {
  let totalPositionValue = 0;
  let totalUnrealizedPnL = 0;
  let totalDividendNet = 0;
  let hasPositionValues = false;
  let hasUnrealizedPnLValues = false;

  for (const asset of assets) {
    if (asset.positionValue != null) {
      hasPositionValues = true;
      totalPositionValue += asset.positionValue;
    }

    if (asset.unrealizedPnL != null) {
      hasUnrealizedPnLValues = true;
      totalUnrealizedPnL += asset.unrealizedPnL;
    }

    totalDividendNet += asset.totalDividendNet;
  }

  return {
    totalPositionValue,
    totalUnrealizedPnL,
    totalDividendNet,
    hasPositionValues,
    hasUnrealizedPnLValues,
  };
}

export function scopeAssetAggregationToPortfolioSelection(
  asset: GlobalAssetViewModel,
  selectedPortfolioIds: string[],
): ScopedAssetAggregation | null {
  const selectedIds = new Set(selectedPortfolioIds);
  const hasManualScope = selectedIds.size > 0;
  const portfolioBreakdown = asset.portfolioBreakdown.filter((entry) => {
    return !hasManualScope || selectedIds.has(entry.portfolioId);
  });

  if (portfolioBreakdown.length === 0) {
    return null;
  }

  if (portfolioBreakdown.length === asset.portfolioBreakdown.length) {
    return {
      portfolioBreakdown,
      portfolioIds: asset.portfolioIds,
      portfolioNames: asset.portfolioNames,
      netShares: asset.netShares,
      remainingCostBasis: asset.remainingCostBasis,
      avgBuyPrice: asset.avgBuyPrice,
      positionValue: asset.positionValue,
      unrealizedPnL: asset.unrealizedPnL,
      totalDividendNet: asset.totalDividendNet,
      latestTradePrice: asset.latestTradePrice,
      marketPrice: asset.marketPrice,
    };
  }

  const netShares = portfolioBreakdown.reduce((sum, entry) => sum + entry.netShares, 0);
  const remainingCostBasis = portfolioBreakdown.reduce(
    (sum, entry) => sum + entry.remainingCostBasis,
    0,
  );
  const totalDividendNet = portfolioBreakdown.reduce(
    (sum, entry) => sum + entry.totalDividendNet,
    0,
  );
  const positionValueSum = portfolioBreakdown.reduce((sum, entry) => {
    return entry.positionValue == null ? sum : sum + entry.positionValue;
  }, 0);
  const unrealizedPnLSum = portfolioBreakdown.reduce((sum, entry) => {
    return entry.unrealizedPnL == null ? sum : sum + entry.unrealizedPnL;
  }, 0);
  const hasPositionValue = portfolioBreakdown.some((entry) => entry.positionValue != null);
  const hasUnrealizedPnL = portfolioBreakdown.some((entry) => entry.unrealizedPnL != null);

  return {
    portfolioBreakdown,
    portfolioIds: portfolioBreakdown.map((entry) => entry.portfolioId),
    portfolioNames: uniqueNonEmpty(
      portfolioBreakdown.map((entry) => entry.portfolioName),
    ),
    netShares,
    remainingCostBasis,
    avgBuyPrice: netShares > 0 ? remainingCostBasis / netShares : null,
    positionValue: hasPositionValue ? positionValueSum : null,
    unrealizedPnL: hasUnrealizedPnL ? unrealizedPnLSum : null,
    totalDividendNet,
    latestTradePrice: asset.latestTradePrice,
    marketPrice: asset.marketPrice,
  };
}

export function scopeAssetToPortfolioSelection(
  asset: GlobalAssetViewModel,
  selectedPortfolioIds: string[],
): GlobalAssetViewModel | null {
  const scoped = scopeAssetAggregationToPortfolioSelection(
    asset,
    selectedPortfolioIds,
  );

  if (!scoped) {
    return null;
  }

  return {
    ...asset,
    portfolioBreakdown: scoped.portfolioBreakdown,
    portfolioIds: scoped.portfolioIds,
    portfolioNames: scoped.portfolioNames,
    netShares: scoped.netShares,
    remainingCostBasis: scoped.remainingCostBasis,
    avgBuyPrice: scoped.avgBuyPrice,
    positionValue: scoped.positionValue,
    unrealizedPnL: scoped.unrealizedPnL,
    totalDividendNet: scoped.totalDividendNet,
    latestTradePrice: scoped.latestTradePrice,
    marketPrice: scoped.marketPrice,
  };
}

export function aggregatePortfolioBreakdownByName(
  assets: GlobalAssetViewModel[],
  selectedPortfolioIds: string[],
): PortfolioBreakdownAggregate[] {
  const selectedIds = new Set(selectedPortfolioIds);
  const hasManualScope = selectedIds.size > 0;
  const byPortfolio = new Map<string, PortfolioBreakdownAggregate>();

  for (const asset of assets) {
    for (const entry of asset.portfolioBreakdown) {
      if (hasManualScope && !selectedIds.has(entry.portfolioId)) {
        continue;
      }

      const current = byPortfolio.get(entry.portfolioName) ?? {
        portfolioName: entry.portfolioName,
        activeAssets: 0,
        closedAssets: 0,
        positionValue: 0,
        unrealizedPnL: 0,
        totalDividendNet: 0,
      };

      if (entry.netShares > 0) {
        current.activeAssets += 1;
      }

      if (entry.netShares === 0) {
        current.closedAssets += 1;
      }

      current.positionValue += entry.positionValue ?? 0;
      current.unrealizedPnL += entry.unrealizedPnL ?? 0;
      current.totalDividendNet += entry.totalDividendNet;
      byPortfolio.set(entry.portfolioName, current);
    }
  }

  return Array.from(byPortfolio.values()).sort((a, b) =>
    a.portfolioName.localeCompare(b.portfolioName, "de-DE"),
  );
}
