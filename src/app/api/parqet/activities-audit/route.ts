// src/lib/types.ts

/**
 * Portfolio aus /api/parqet/portfolios
 */
export type Portfolio = {
    id: string;
    name: string;
    currency: string;
    createdAt: string;
    distinctBrokers: string[];
};

/**
 * Optionale Asset-Metadaten aus lokaler oder externer Quelle.
 */
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

/**
 * Positionswerte je Portfolio innerhalb eines aggregierten Assets.
 */
export type PortfolioPosition = {
    portfolioId: string;
    portfolioName: string;

    netShares: number;
    remainingCostBasis: number;
    avgBuyPrice: number | null;

    latestTradePrice: number | null;
    marketPrice: number | null;

    positionValue: number | null;
    unrealizedPnL: number | null;

    totalDividendNet: number;
};

/**
 * Konsolidierte Asset-Sicht über mehrere Portfolios.
 */
export type AssetSummary = {
    isin: string;

    portfolioIds: string[];
    portfolioNames: string[];

    portfolioBreakdown: PortfolioPosition[];

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
    marketPrice: number | null;
    marketPriceAt: string | null;
    marketPriceSource: string | null;

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

/**
 * Einzelne Konsistenzwarnung für ein Asset.
 */
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

/**
 * Konsistenzreport für das gesamte Dashboard.
 */
export type ConsistencyReport = {
    checkedAssets: number;
    warningCount: number;
    assetsWithWarnings: AssetConsistencyCheck[];
};

/**
 * Reconciliation-Warnung auf Activity-/Asset-Ebene.
 *
 * Diese Struktur ist bewusst DB-ready:
 * - eindeutige ISIN
 * - Severity
 * - menschenlesbare Nachricht
 *
 * Später kann hier problemlos z. B. eine ruleId, status, note oder overrideId
 * ergänzt werden.
 */
export type ReconciliationWarning = {
    isin: string;
    message: string;
    severity: "info" | "warning" | "error";
};

/**
 * Antwort von /api/parqet/portfolios
 */
export type PortfoliosApiResponse = {
    ok: boolean;
    portfolios?: {
        items: Portfolio[];
    };
    message?: string;
    details?: string;
};

/**
 * Antwort von /api/parqet/assets
 */
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
    reconciliationWarnings?: ReconciliationWarning[];

    message?: string;
    details?: string;
};

/**
 * Kennzahlen für Header / Hero / StatsGrid.
 */
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

/**
 * Audit-/Aktivitätenansicht:
 * vereinheitlichte Typen für die UI.
 *
 * Wichtig:
 * Diese Ebene soll künftig auch mit DB gespeicherten Activities kompatibel bleiben.
 */
export type AuditActivityType =
    | "buy"
    | "sell"
    | "dividend"
    | "transfer_in"
    | "transfer_out"
    | "unknown";

export type ActivitiesAuditItem = {
    id: string;
    datetime: string;

    year: number;
    monthKey: string;
    monthLabel: string;

    portfolioId: string | null;
    portfolioName: string;

    isin: string;
    name: string | null;
    symbol: string | null;
    wkn: string | null;

    type: AuditActivityType;
    rawType: string;

    shares: number;
    price: number;
    amount: number;
    amountNet: number;

    warningMessages: string[];
};

export type ActivitiesAuditSummary = {
    total: number;
    buyCount: number;
    sellCount: number;
    dividendCount: number;
    transferInCount: number;
    transferOutCount: number;
    unknownCount: number;
};

export type ActivitiesAuditApiResponse = {
    ok: boolean;
    generatedAt: string;
    portfolios: Portfolio[];
    items: ActivitiesAuditItem[];
    reconciliationWarnings: ReconciliationWarning[];
    summary: ActivitiesAuditSummary;
    message?: string;
    details?: string;
};