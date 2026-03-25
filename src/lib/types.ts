// src/lib/types.ts

export type Portfolio = {
    id: string;
    name: string;
    currency: string;
    createdAt: string;
    distinctBrokers: string[];
};

export type AssetMetadata = {
    name?: string | null;
    assetName?: string | null;
    displayName?: string | null;
    title?: string | null;

    symbol?: string | null;
    ticker?: string | null;
    tickerSymbol?: string | null;

    wkn?: string | null;

    marketPrice?: number | null;
    marketPriceAt?: string | null;
    marketPriceSource?: string | null;

    currency?: string | null;
    assetType?: string | null;
    exchange?: string | null;
};

export type AssetSummary = {
    isin: string;

    portfolioIds: string[];
    portfolioNames: string[];

    activityCount: number;
    buyCount: number;
    sellCount: number;
    dividendCount: number;

    totalBoughtShares: number;
    totalSoldShares: number;
    netShares: number;

    totalInvestedGross: number;
    remainingCostBasis: number;
    avgBuyPrice: number | null;

    latestTradePrice: number | null;
    marketPrice?: number | null;
    marketPriceAt?: string | null;
    marketPriceSource?: string | null;

    positionValue: number | null;
    unrealizedPnL: number | null;

    totalDividendNet: number;

    latestActivityAt: string | null;

    name?: string | null;
    assetName?: string | null;
    displayName?: string | null;
    title?: string | null;

    symbol?: string | null;
    ticker?: string | null;
    tickerSymbol?: string | null;

    wkn?: string | null;

    metadata?: Partial<AssetMetadata> | null;
    externalMetadata?: Partial<AssetMetadata> | null;
    assetMeta?: Partial<AssetMetadata> | null;
};

export type AssetConsistencyCheck = {
    isin: string;
    name?: string | null;

    reconstructedNetShares: number;
    remainingCostBasis: number;

    isNegativeShares: boolean;
    isNegativeCostBasis: boolean;
    hasZeroSharesButCostBasis: boolean;
    hasSharesButNoBuyHistory: boolean;
    soldMoreThanBought: boolean;

    warnings: string[];
};

export type ConsistencyReport = {
    checkedAssets: number;
    warningCount: number;
    assetsWithWarnings: AssetConsistencyCheck[];
};

export type PortfoliosApiResponse = {
    ok: boolean;
    portfolios?: {
        items: Portfolio[];
    };
    message?: string;
    details?: string;
};

export type AssetsApiResponse = {
    ok: boolean;

    rawActivityCount?: number;
    filteredActivityCount?: number;

    assetCount?: number;
    activeAssetCount?: number;
    closedAssetCount?: number;

    assets?: AssetSummary[];
    activeAssets?: AssetSummary[];
    closedAssets?: AssetSummary[];

    generatedAt?: string;
    consistencyReport?: ConsistencyReport;

    message?: string;
    details?: string;
};

export type DashboardStats = {
    rawActivityCount: number;
    filteredActivityCount: number;
    assetCount: number;
    activeAssetCount: number;
    closedAssetCount: number;
    totalDividendNet: number;
    totalPositionValue: number;
    totalUnrealizedPnL: number;
};