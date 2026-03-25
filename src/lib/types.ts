// Gemeinsame Typen fuer das Dashboard und die API-Antworten.

export type Portfolio = {
    id: string;
    name: string;
    currency: string;
    createdAt: string;
    distinctBrokers: string[];
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
    avgBuyPrice: number;
    latestTradePrice: number | null;
    positionValue: number | null;
    unrealizedPnL: number | null;
    totalDividendNet: number;
    latestActivityAt: string | null;
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
    assets?: AssetSummary[];
    message?: string;
    details?: string;
};

export type DashboardStats = {
    rawActivityCount: number;
    filteredActivityCount: number;
    assetCount: number;
    totalDividendNet: number;
    totalPositionValue: number;
    totalUnrealizedPnL: number;
};