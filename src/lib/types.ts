// Zentrale Typen fuer Dashboard, API-Antworten und aggregierte Assets.

export type Portfolio = {
    id: string;
    name: string;
    currency: string | null;
    createdAt: string | null;
    distinctBrokers?: string[];
};

export type PortfoliosApiResponse = {
    ok: boolean;
    portfolios?: {
        items: Portfolio[];
    };
    message?: string;
};

export type AssetSummary = {
    // Primärer Schlüssel fuer die Aggregation ueber mehrere Portfolios hinweg
    isin: string;

    // Metadaten aus Activities / externer Metadatenquelle
    name: string | null;
    symbol: string | null;
    wkn: string | null;

    // Kontext: In welchen Portfolios kommt das Asset aktuell vor?
    portfolioIds: string[];
    portfolioNames: string[];

    // Einfache Zähler zur Kontrolle / Analyse
    activityCount: number;
    buyCount: number;
    sellCount: number;
    dividendCount: number;

    // Mengen- und Investmentdaten
    totalBoughtShares: number;
    totalSoldShares: number;
    netShares: number;
    totalInvestedGross: number;
    remainingCostBasis: number;
    avgBuyPrice: number | null;

    // Preisfelder
    latestTradePrice: number | null;
    marketPrice: number | null;
    marketPriceAt: string | null;
    marketPriceSource: string | null;

    // Bewertungsdaten
    positionValue: number | null;
    unrealizedPnL: number | null;

    // Cashflow
    totalDividendNet: number;

    // Letzte Aktivität fuer Sortierung / Anzeige
    latestActivityAt: string | null;
};

export type AssetConsistencyCheck = {
    isin: string;
    name: string | null;
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

export type AssetsApiResponse = {
    ok: boolean;
    activeAssets?: AssetSummary[];
    closedAssets?: AssetSummary[];
    rawActivityCount?: number;
    filteredActivityCount?: number;
    assetCount?: number;
    activeAssetCount?: number;
    closedAssetCount?: number;
    refreshed?: boolean;
    requestedPortfolioIds?: string[];
    consistencyReport?: ConsistencyReport;
    generatedAt?: string;
    message?: string;
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